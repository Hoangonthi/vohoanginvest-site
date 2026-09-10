$ErrorActionPreference = 'Continue'

# VO HOANG Market Sync V2.3 + Hot Stocks + Derivatives
# Strategy: VNDIRECT realtime MI first for GT/breadth; Vnstock and DataTick/AmiBroker fallback.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$BridgeUrl = 'http://127.0.0.1:8765/market/overview'
$StockBaseUrl = 'http://127.0.0.1:8765/stock'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$HotStocksRelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/hot-stocks-feed'
$HotStocksCsv = 'C:\Users\USER\Desktop\AMIBRO\tplus_pro_snapshot.csv'
$script:LastHotStocksWriteUtc = [DateTime]::MinValue
$DerivativesRelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/derivatives-feed'
$DerivativesCsv = 'C:\Users\USER\Desktop\AMIBRO\psvn_trend_snapshot.csv'
$DerivativesIntervalSeconds = 2
$script:LastDerivativesWriteUtc = [DateTime]::MinValue
$IntervalSeconds = 60
$WatchListRoot = 'D:\AmiBroker\eod\WatchLists'
$CacheRoot = Join-Path $PSScriptRoot 'universe-cache'
$UniverseRefreshHours = 12
$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }

$vndirectEnrichPath = Join-Path $PSScriptRoot 'vndirect-enrich.ps1'
if (Test-Path $vndirectEnrichPath) { try { . $vndirectEnrichPath } catch {} }
$vnstockEnrichPath = Join-Path $PSScriptRoot 'vnstock-enrich.ps1'
if (Test-Path $vnstockEnrichPath) { try { . $vnstockEnrichPath } catch {} }
$extraIndexEnrichPath = Join-Path $PSScriptRoot 'index-extra-enrich.ps1'
if (Test-Path $extraIndexEnrichPath) { try { . $extraIndexEnrichPath } catch {} }

$UniverseSources = [ordered]@{
    HSX = 'https://raw.githubusercontent.com/minh-1105/vndirect-real-time-data-crawl/main/StockIDs/HSX.txt'
    HNX = 'https://raw.githubusercontent.com/minh-1105/vndirect-real-time-data-crawl/main/StockIDs/HNX.txt'
    UPC = 'https://raw.githubusercontent.com/minh-1105/vndirect-real-time-data-crawl/main/StockIDs/UPC.txt'
}

function Get-VnNow {
    return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time')
}

function Get-MarketSession {
    $now = Get-VnNow
    if ($now.DayOfWeek -eq [DayOfWeek]::Saturday -or $now.DayOfWeek -eq [DayOfWeek]::Sunday) { return 'closed' }
    $mins = ($now.Hour * 60) + $now.Minute
    if ($mins -ge (8*60+45) -and $mins -le (11*60+30)) { return 'morning' }
    if ($mins -ge (13*60) -and $mins -le (15*60)) { return 'afternoon' }
    if ($mins -gt (11*60+30) -and $mins -lt (13*60)) { return 'lunch' }
    return 'closed'
}

function Is-TradingWindow {
    $session = Get-MarketSession
    return ($session -eq 'morning' -or $session -eq 'afternoon')
}

function Get-ErrorDetail($err) {
    try {
        $resp = $err.Exception.Response
        if ($null -ne $resp) {
            $stream = $resp.GetResponseStream()
            if ($null -ne $stream) {
                $reader = New-Object IO.StreamReader($stream)
                $txt = $reader.ReadToEnd()
                if ($txt) { return $txt }
            }
        }
    } catch {}
    if ($err.Exception.InnerException) { return ($err.Exception.Message + ' | Inner: ' + $err.Exception.InnerException.Message) }
    return $err.Exception.Message
}

function Read-WatchList([string]$name) {
    $path = Join-Path $WatchListRoot ($name + '.tls')
    if (-not (Test-Path $path)) { return @() }
    return @(Get-Content -LiteralPath $path -ErrorAction SilentlyContinue |
        ForEach-Object { $_.Trim().ToUpperInvariant() } |
        Where-Object { $_ -match '^[A-Z0-9._-]+$' } |
        Select-Object -Unique)
}

function Ensure-UniverseCache {
    if (-not (Test-Path $CacheRoot)) { New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null }
    foreach ($name in $UniverseSources.Keys) {
        $path = Join-Path $CacheRoot ($name + '.txt')
        $need = -not (Test-Path $path)
        if (-not $need) {
            try { $need = ((Get-Date) - (Get-Item $path).LastWriteTime).TotalHours -ge $UniverseRefreshHours } catch { $need = $true }
        }
        if ($need) {
            try {
                $tmp = $path + '.tmp'
                Invoke-WebRequest -UseBasicParsing -Uri $UniverseSources[$name] -OutFile $tmp -TimeoutSec 20
                Move-Item -Force $tmp $path
                Write-Host ('[{0}] Da cap nhat danh sach {1}.' -f (Get-Date -Format 'HH:mm:ss'), $name) -ForegroundColor DarkCyan
            } catch {
                Write-Host ('[{0}] Khong cap nhat duoc danh sach {1}, dung cache cu neu co.' -f (Get-Date -Format 'HH:mm:ss'), $name) -ForegroundColor DarkYellow
            }
        }
    }
}

function Read-Universe([string]$name) {
    $path = Join-Path $CacheRoot ($name + '.txt')
    if (-not (Test-Path $path)) { return @() }
    return @(Get-Content -LiteralPath $path -ErrorAction SilentlyContinue |
        ForEach-Object { $_.Trim().ToUpperInvariant() } |
        Where-Object { $_ -match '^[A-Z0-9]{3}$' } |
        Select-Object -Unique)
}

function Get-Breadth([string[]]$symbols) {
    $adv = 0; $flat = 0; $dec = 0; $missing = 0; $stale = 0
    $today = (Get-VnNow).ToString('yyyy-MM-dd')
    foreach ($symbol in $symbols) {
        try {
            $p = Invoke-RestMethod -UseBasicParsing -Uri ($StockBaseUrl + '/' + [Uri]::EscapeDataString($symbol)) -Method Get -TimeoutSec 4
            if (-not $p.ok -or $null -eq $p.quote) { $missing++; continue }
            if ($p.quote.date -ne $today) { $stale++; continue }
            $chg = [double]$p.quote.change
            if ($chg -gt 0) { $adv++ }
            elseif ($chg -lt 0) { $dec++ }
            else { $flat++ }
        } catch { $missing++ }
    }
    return [pscustomobject]@{
        adv=$adv; flat=$flat; dec=$dec; missing=$missing; stale=$stale;
        total=$symbols.Count; counted=($adv+$flat+$dec)
    }
}

function Set-Breadth($data, [string]$indexSymbol, $breadth, [string]$source) {
    foreach ($idx in @($data.indexes)) {
        if ($idx.symbol -eq $indexSymbol) {
            $idx.adv = $breadth.adv
            $idx.flat = $breadth.flat
            $idx.dec = $breadth.dec
            $idx | Add-Member -NotePropertyName breadth_total -NotePropertyValue $breadth.total -Force
            $idx | Add-Member -NotePropertyName breadth_counted -NotePropertyValue $breadth.counted -Force
            $idx | Add-Member -NotePropertyName breadth_missing -NotePropertyValue $breadth.missing -Force
            $idx | Add-Member -NotePropertyName breadth_stale -NotePropertyValue $breadth.stale -Force
            $idx | Add-Member -NotePropertyName breadth_source -NotePropertyValue $source -Force
        }
    }
}

function Needs-Breadth($data, [string]$symbol) {
    $idx = @($data.indexes | Where-Object { $_.symbol -eq $symbol }) | Select-Object -First 1
    if ($null -eq $idx) { return $false }
    return ($null -eq $idx.adv -or $null -eq $idx.flat -or $null -eq $idx.dec)
}

function Enrich-MarketData($data) {
    # Primary source: VNDIRECT realtime MI. It provides GT and breadth for the six main indexes.
    if (Get-Command Apply-VndirectMarketSummary -ErrorAction SilentlyContinue) {
        try { $data = Apply-VndirectMarketSummary $data } catch {
            Write-Host ('[{0}] VNDIRECT realtime bo qua: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }

    # Vnstock remains a fallback only when the VNDIRECT feed is unavailable.
    if ($script:VndirectLastStatus -ne 'ok' -and (Get-Command Apply-VnstockSummary -ErrorAction SilentlyContinue)) {
        try { $data = Apply-VnstockSummary $data } catch {
            Write-Host ('[{0}] Vnstock API bo qua: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }

    # Broader enrichment for VN100/VNXALL/mid-small/sector indices.
    if (Get-Command Apply-IndexExtraEnrichment -ErrorAction SilentlyContinue) {
        try { $data = Apply-IndexExtraEnrichment $data } catch {
            Write-Host ('[{0}] Extra index enrichment bo qua: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }

    if (Needs-Breadth $data 'VN30') {
        try {
            $vn30Symbols = Read-WatchList 'VN30'
            if ($vn30Symbols.Count -gt 0) {
                $b = Get-Breadth $vn30Symbols
                Set-Breadth $data 'VN30' $b 'AmiBroker WatchLists/VN30.tls + DataTick quotes'
            }
        } catch {
            Write-Host ('[{0}] Khong tinh duoc breadth VN30 fallback: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }

    $needExchangeFallback = (Needs-Breadth $data 'VN-INDEX') -or (Needs-Breadth $data 'HNX-INDEX') -or (Needs-Breadth $data 'UPCOM-INDEX')
    if ($needExchangeFallback) { Ensure-UniverseCache }

    $jobs = @(
        @{ universe='HSX'; index='VN-INDEX' },
        @{ universe='HNX'; index='HNX-INDEX' },
        @{ universe='UPC'; index='UPCOM-INDEX' }
    )
    foreach ($j in $jobs) {
        if (-not (Needs-Breadth $data $j.index)) { continue }
        try {
            $symbols = Read-Universe $j.universe
            if ($symbols.Count -gt 0) {
                $b = Get-Breadth $symbols
                Set-Breadth $data $j.index $b ('Fallback exchange universe/' + $j.universe + ' + DataTick quotes')
            }
        } catch {
            Write-Host ('[{0}] Khong tinh duoc breadth {1} fallback: {2}' -f (Get-Date -Format 'HH:mm:ss'), $j.index, $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }

    return $data
}


function Convert-HotNum($value) {
    if ($null -eq $value) { return $null }
    $s = [string]$value
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    $n = 0.0
    if ([double]::TryParse($s, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) {
        return $n
    }
    if ([double]::TryParse($s, [ref]$n)) { return $n }
    return $null
}

function Push-HotStocksOnce {
    try {
        if (-not (Test-Path -LiteralPath $HotStocksCsv)) {
            Write-Host ('[{0}] Hot Stocks: chua thay CSV AmiBroker.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkYellow
            return
        }

        $file = Get-Item -LiteralPath $HotStocksCsv -ErrorAction Stop

        # Chi day khi AmiBroker vua tao snapshot moi.
        if ($file.LastWriteTimeUtc -le $script:LastHotStocksWriteUtc) { return }

        # Tranh doc dung luc AmiBroker dang ghi file.
        $beforeWrite = $file.LastWriteTimeUtc
        Start-Sleep -Milliseconds 700
        $rows = @(Import-Csv -LiteralPath $HotStocksCsv -ErrorAction Stop)
        $afterWrite = (Get-Item -LiteralPath $HotStocksCsv -ErrorAction Stop).LastWriteTimeUtc
        if ($afterWrite -ne $beforeWrite) {
            Write-Host ('[{0}] Hot Stocks: CSV dang duoc AmiBroker cap nhat, doi vong sau.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
            return
        }

        # Snapshot AFL binh thuong co nhieu ma. Neu chi co header thi xem nhu file dang ghi do.
        if ($rows.Count -eq 0) {
            Write-Host ('[{0}] Hot Stocks: CSV chua co dong du lieu, doi vong sau.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
            return
        }

        # Bam sat AFL hien tai:
        # - signalClass MANH / THAM GIA = tScore dat nguong va khong mua duoi
        # - reason DAT = cac dieu kien gia, RVOL, vol/phien truoc, GTGD, market filter deu dat
        $selected = @(
            $rows |
            Where-Object {
                $cls = ([string]$_.signalClass).Trim().ToUpperInvariant()
                $reason = ([string]$_.reason).Trim().ToUpperInvariant()
                (($cls -eq 'MANH') -or ($cls -eq 'THAM GIA')) -and ($reason -eq 'DAT')
            } |
            Sort-Object `
                @{ Expression = { [double](Convert-HotNum $_.tScore) }; Descending = $true }, `
                @{ Expression = { [double](Convert-HotNum $_.changePct) }; Descending = $true }, `
                @{ Expression = { [double](Convert-HotNum $_.valueTradedBn) }; Descending = $true }
        )

        $stocks = @()
        foreach ($r in $selected) {
            $symbol = ([string]$r.symbol).Trim().ToUpperInvariant()
            if ([string]::IsNullOrWhiteSpace($symbol)) { continue }

            $stocks += [ordered]@{
                symbol                = $symbol
                signalClass           = ([string]$r.signalClass).Trim()
                reason                = ([string]$r.reason).Trim()
                baseType              = ([string]$r.baseType).Trim()
                tScore                = Convert-HotNum $r.tScore
                price                 = Convert-HotNum $r.price
                changePct             = Convert-HotNum $r.changePct
                projectedVolRatio     = Convert-HotNum $r.projectedVolRatio
                projectedPrevVolRatio = Convert-HotNum $r.projectedPrevVolRatio
                valueTradedBn         = Convert-HotNum $r.valueTradedBn
                riskRewardRatio       = Convert-HotNum $r.riskRewardRatio
                stopLoss              = Convert-HotNum $r.stopLoss
                stopLossPct           = Convert-HotNum $r.stopLossPct
                marketText            = ([string]$r.marketText).Trim()
                updatedAt             = ([string]$r.updatedAt).Trim()
            }
        }

        $sourceUpdated = ([DateTimeOffset]$afterWrite.ToLocalTime()).ToString('o')
        $body = [ordered]@{
            stocks = $stocks
            source_updated_at = $sourceUpdated
        } | ConvertTo-Json -Depth 8 -Compress

        $headers = @{ 'x-bridge-key' = $BridgeKey }
        $result = Invoke-RestMethod -UseBasicParsing -Uri $HotStocksRelayUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 20

        if ($result.ok) {
            $script:LastHotStocksWriteUtc = $afterWrite
            $symbols = @($stocks | ForEach-Object { $_.symbol })
            $list = if ($symbols.Count -gt 0) { $symbols -join ', ' } else { '(khong co ma)' }
            Write-Host ('[{0}] Hot Stocks: da dong bo {1} ma | {2}' -f (Get-Date -Format 'HH:mm:ss'), $symbols.Count, $list) -ForegroundColor Cyan
        } else {
            Write-Host ('[{0}] Hot Stocks: relay tu choi du lieu.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor Yellow
        }
    } catch {
        Write-Host ('[{0}] Hot Stocks loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), (Get-ErrorDetail $_)) -ForegroundColor DarkYellow
    }
}


function Push-DerivativesOnce {
    try {
        if (-not (Test-Path -LiteralPath $DerivativesCsv)) {
            return
        }

        $file = Get-Item -LiteralPath $DerivativesCsv -ErrorAction Stop
        if ($file.LastWriteTimeUtc -le $script:LastDerivativesWriteUtc) { return }

        # AFL ghi lai file moi giay; doi rat ngan de tranh doc trung luc dang ghi.
        $beforeWrite = $file.LastWriteTimeUtc
        Start-Sleep -Milliseconds 120
        $rows = @(Import-Csv -LiteralPath $DerivativesCsv -ErrorAction Stop)
        $afterWrite = (Get-Item -LiteralPath $DerivativesCsv -ErrorAction Stop).LastWriteTimeUtc
        if ($afterWrite -ne $beforeWrite -or $rows.Count -lt 1) { return }

        $r = $rows[0]
        $symbol = ([string]$r.symbol).Trim().ToUpperInvariant()
        $trend = ([string]$r.trend).Trim().ToUpperInvariant()
        if ([string]::IsNullOrWhiteSpace($symbol) -or (($trend -ne 'TANG') -and ($trend -ne 'GIAM'))) {
            Write-Host ('[{0}] Phai sinh: snapshot khong hop le.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkYellow
            return
        }

        $body = [ordered]@{
            symbol = $symbol
            trend = $trend
            system_price = Convert-HotNum $r.systemPrice
            t1 = Convert-HotNum $r.t1
            t2 = Convert-HotNum $r.t2
            t3 = Convert-HotNum $r.t3
            reversal_price = Convert-HotNum $r.reversalPrice
            last_price = Convert-HotNum $r.lastPrice
            source_updated_at = ([DateTimeOffset]$afterWrite.ToLocalTime()).ToString('o')
        } | ConvertTo-Json -Depth 6 -Compress

        $headers = @{ 'x-bridge-key' = $BridgeKey }
        $result = Invoke-RestMethod -UseBasicParsing -Uri $DerivativesRelayUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 10

        if ($result.ok) {
            $script:LastDerivativesWriteUtc = $afterWrite
            $trendUi = if ($trend -eq 'TANG') { 'TANG' } else { 'GIAM' }
            Write-Host ('[{0}] PS {1}: {2} | He thong {3} | T1 {4} | T2 {5} | T3 {6} | Dao chieu {7}' -f `
                (Get-Date -Format 'HH:mm:ss'), $symbol, $trendUi, $r.systemPrice, $r.t1, $r.t2, $r.t3, $r.reversalPrice) -ForegroundColor Magenta
        }
    } catch {
        Write-Host ('[{0}] Phai sinh loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), (Get-ErrorDetail $_)) -ForegroundColor DarkYellow
    }
}

function Push-Once {
    $started = Get-Date
    try {
        $data = Invoke-RestMethod -UseBasicParsing -Uri $BridgeUrl -Method Get -TimeoutSec 10
        if (-not $data.ok -or -not $data.indexes -or $data.indexes.Count -lt 1) {
            Write-Host ('[{0}] Bridge chua co du lieu chi so.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor Yellow
            return
        }

        $data = Enrich-MarketData $data
        $json = $data | ConvertTo-Json -Depth 10 -Compress
        $headers = @{ 'x-bridge-key' = $BridgeKey }
        $result = Invoke-RestMethod -UseBasicParsing -Uri $RelayUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 25
        if ($result.ok) {
            $elapsed = [Math]::Round(((Get-Date) - $started).TotalSeconds, 1)
            $parts = @()
            foreach ($sym in @('VN-INDEX','VN30','VN100','VNXALL','VNMidcap','VNSmallcap','VNFIN LEAD','HNX-INDEX','UPCOM-INDEX')) {
                $x = @($data.indexes | Where-Object { $_.symbol -eq $sym }) | Select-Object -First 1
                if ($null -ne $x) {
                    $breadth = if ($null -ne $x.adv) { (' +{0} ={1} -{2}' -f $x.adv,$x.flat,$x.dec) } else { '' }
                    $gt = if ($null -ne $x.value_b) { (' GT={0}ty' -f ([Math]::Round([double]$x.value_b,1))) } else { '' }
                    if ($breadth -or $gt) { $parts += ($sym + $breadth + $gt) }
                }
            }
            $detailText = if ($parts.Count) { ' | ' + ($parts -join ' | ') } else { '' }
            if ($null -ne $data.market_metrics_provider) {
                $providerText = ' | API=' + $data.market_metrics_provider
            } elseif ($script:VndirectLastStatus) {
                $providerText = ' | API=VNDIRECT(' + $script:VndirectLastStatus + ')'
            } else {
                $providerText = ' | API=fallback-local'
            }
            if ($script:ExtraIndexLastStatus) { $providerText += (' | Extra=' + $script:ExtraIndexLastStatus) }
            Write-Host ('[{0}] Da dong bo {1} chi so len website. ({2}s){3}{4}' -f (Get-Date -Format 'HH:mm:ss'), $data.indexes.Count, $elapsed, $detailText, $providerText) -ForegroundColor Green
        } else {
            Write-Host ('[{0}] Relay tu choi du lieu: {1}' -f (Get-Date -Format 'HH:mm:ss'), ($result | ConvertTo-Json -Compress)) -ForegroundColor Yellow
        }
    } catch {
        Write-Host ('[{0}] Dong bo loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), (Get-ErrorDetail $_)) -ForegroundColor Red
    }
}

Write-Host 'VO HOANG Market Sync V2.3 + Hot Stocks + Derivatives' -ForegroundColor Cyan
Write-Host ('Bridge: ' + $BridgeUrl)
Write-Host ('Relay:  ' + $RelayUrl)
Write-Host ('Hot:    ' + $HotStocksRelayUrl)
Write-Host ('CSV:    ' + $HotStocksCsv)
Write-Host ('PS:     ' + $DerivativesRelayUrl)
Write-Host ('PS CSV: ' + $DerivativesCsv)
Write-Host ('PS realtime: kiem tra snapshot moi moi {0}s' -f $DerivativesIntervalSeconds)
Write-Host ('Chu ky muc tieu: {0} giay | phien sang 08:45-11:30 | phien chieu 13:00-15:00 | Thu 2-Thu 6' -f $IntervalSeconds)
Write-Host ('TLS:     ' + [Net.ServicePointManager]::SecurityProtocol)
if (Get-Command Test-VndirectAvailable -ErrorAction SilentlyContinue) {
    if (Test-VndirectAvailable) { Write-Host 'Market metrics: VNDIRECT realtime GT + breadth; local fallback.' -ForegroundColor Green }
    else { Write-Host 'Market metrics: VNDIRECT chua san sang; dung fallback neu co.' -ForegroundColor DarkYellow }
}
Write-Host 'GT cho VN-INDEX/VN30/UPCOM/HNX/VN100/VNXALL lay tu VNDIRECT realtime MI.' -ForegroundColor Cyan
Write-Host 'GIU CUA SO NAY MO TRONG GIO GIAO DICH.' -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($BridgeKey)) {
    Write-Host 'THIEU VH_BRIDGE_KEY. Chay lenh setup 1 lan theo huong dan.' -ForegroundColor Red
    exit 2
}

$nextOutsideNotice = [DateTime]::MinValue
$nextMarketSync = [DateTime]::MinValue

while ($true) {
    try {
        if (Is-TradingWindow) {
            $nowLoop = Get-Date

            # Phai sinh doc snapshot AmiBroker thuong xuyen, doc lap chu ky market 60s.
            Push-DerivativesOnce

            if ($nowLoop -ge $nextMarketSync) {
                $cycleStart = Get-Date
                Push-Once
                Push-HotStocksOnce
                Push-DerivativesOnce
                $spent = ((Get-Date) - $cycleStart).TotalSeconds
                $nextMarketSync = $cycleStart.AddSeconds($IntervalSeconds)
                if ($nextMarketSync -lt (Get-Date)) {
                    $nextMarketSync = (Get-Date).AddSeconds(1)
                }
                Write-Host ('          Market lan tiep theo: {0} | PS van theo doi realtime' -f $nextMarketSync.ToString('HH:mm:ss')) -ForegroundColor DarkGray
            }

            Start-Sleep -Seconds $DerivativesIntervalSeconds
        } else {
            if ((Get-Date) -ge $nextOutsideNotice) {
                $session = Get-MarketSession
                if ($session -eq 'lunch') {
                    Write-Host ('[{0}] Nghi trua 11:30-13:00, tam dung dong bo. Se tu chay lai luc 13:00.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
                } else {
                    Write-Host ('[{0}] Ngoai gio giao dich, tam dung dong bo.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
                }
                $nextOutsideNotice = (Get-Date).AddMinutes(5)
            }
            Start-Sleep -Seconds 30
        }
    } catch {
        Write-Host ('[{0}] Vong dong bo gap loi, se thu lai sau 5 giay: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
}
