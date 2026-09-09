$ErrorActionPreference = 'Continue'

# VO HOANG Market Sync V1.5
# DataTick remains the quote source. Public exchange symbol lists are used only
# as membership metadata to calculate market breadth for HOSE/HNX/UPCOM.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$BridgeUrl = 'http://127.0.0.1:8765/market/overview'
$StockBaseUrl = 'http://127.0.0.1:8765/stock'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$IntervalSeconds = 60
$WatchListRoot = 'D:\AmiBroker\eod\WatchLists'
$CacheRoot = Join-Path $PSScriptRoot 'universe-cache'
$UniverseRefreshHours = 12
$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }

$UniverseSources = [ordered]@{
    HSX = 'https://raw.githubusercontent.com/minh-1105/vndirect-real-time-data-crawl/main/StockIDs/HSX.txt'
    HNX = 'https://raw.githubusercontent.com/minh-1105/vndirect-real-time-data-crawl/main/StockIDs/HNX.txt'
    UPC = 'https://raw.githubusercontent.com/minh-1105/vndirect-real-time-data-crawl/main/StockIDs/UPC.txt'
}

function Get-VnNow {
    return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time')
}

function Is-TradingWindow {
    $now = Get-VnNow
    if ($now.DayOfWeek -eq [DayOfWeek]::Saturday -or $now.DayOfWeek -eq [DayOfWeek]::Sunday) { return $false }
    $mins = ($now.Hour * 60) + $now.Minute
    return ($mins -ge (8*60+45) -and $mins -le (15*60))
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

function Enrich-MarketData($data) {
    Ensure-UniverseCache

    try {
        $vn30Symbols = Read-WatchList 'VN30'
        if ($vn30Symbols.Count -gt 0) {
            $b = Get-Breadth $vn30Symbols
            Set-Breadth $data 'VN30' $b 'AmiBroker WatchLists/VN30.tls'
        }
    } catch {
        Write-Host ('[{0}] Khong tinh duoc breadth VN30: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
    }

    $jobs = @(
        @{ universe='HSX'; index='VN-INDEX' },
        @{ universe='HNX'; index='HNX-INDEX' },
        @{ universe='UPC'; index='UPCOM-INDEX' }
    )
    foreach ($j in $jobs) {
        try {
            $symbols = Read-Universe $j.universe
            if ($symbols.Count -gt 0) {
                $b = Get-Breadth $symbols
                Set-Breadth $data $j.index $b ('Exchange universe metadata/' + $j.universe + ' + DataTick quotes')
            }
        } catch {
            Write-Host ('[{0}] Khong tinh duoc breadth {1}: {2}' -f (Get-Date -Format 'HH:mm:ss'), $j.index, $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }
    return $data
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
            foreach ($sym in @('VN-INDEX','VN30','HNX-INDEX','UPCOM-INDEX')) {
                $x = @($data.indexes | Where-Object { $_.symbol -eq $sym }) | Select-Object -First 1
                if ($null -ne $x -and $null -ne $x.adv) { $parts += ('{0} +{1} ={2} -{3}' -f $sym,$x.adv,$x.flat,$x.dec) }
            }
            $breadthText = if ($parts.Count) { ' | ' + ($parts -join ' | ') } else { '' }
            Write-Host ('[{0}] Da dong bo {1} chi so len website. ({2}s){3}' -f (Get-Date -Format 'HH:mm:ss'), $data.indexes.Count, $elapsed, $breadthText) -ForegroundColor Green
        } else {
            Write-Host ('[{0}] Relay tu choi du lieu: {1}' -f (Get-Date -Format 'HH:mm:ss'), ($result | ConvertTo-Json -Compress)) -ForegroundColor Yellow
        }
    } catch {
        Write-Host ('[{0}] Dong bo loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), (Get-ErrorDetail $_)) -ForegroundColor Red
    }
}

Write-Host 'VO HOANG Market Sync V1.5' -ForegroundColor Cyan
Write-Host ('Bridge: ' + $BridgeUrl)
Write-Host ('Relay:  ' + $RelayUrl)
Write-Host ('Chu ky muc tieu: {0} giay | chi gui 08:45-15:00, Thu 2-Thu 6' -f $IntervalSeconds)
Write-Host ('TLS:     ' + [Net.ServicePointManager]::SecurityProtocol)
Write-Host 'Breadth: VN30 tu WatchList; VN-INDEX/HNX/UPCOM tu danh sach san + gia DataTick.' -ForegroundColor Cyan
Write-Host 'GIU CUA SO NAY MO TRONG GIO GIAO DICH.' -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($BridgeKey)) {
    Write-Host 'THIEU VH_BRIDGE_KEY. Chay lenh setup 1 lan theo huong dan.' -ForegroundColor Red
    exit 2
}

$nextOutsideNotice = [DateTime]::MinValue
while ($true) {
    try {
        if (Is-TradingWindow) {
            $cycleStart = Get-Date
            Push-Once
            $spent = ((Get-Date) - $cycleStart).TotalSeconds
            $sleepSeconds = [Math]::Max(1, [Math]::Ceiling($IntervalSeconds - $spent))
            $next = (Get-Date).AddSeconds($sleepSeconds)
            Write-Host ('          Lan tiep theo: {0} | nghi {1}s' -f $next.ToString('HH:mm:ss'), $sleepSeconds) -ForegroundColor DarkGray
            Start-Sleep -Seconds $sleepSeconds
        } else {
            if ((Get-Date) -ge $nextOutsideNotice) {
                Write-Host ('[{0}] Ngoai gio 08:45-15:00, tam dung dong bo.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
                $nextOutsideNotice = (Get-Date).AddMinutes(5)
            }
            Start-Sleep -Seconds 30
        }
    } catch {
        Write-Host ('[{0}] Vong dong bo gap loi, se thu lai sau 10 giay: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor Red
        Start-Sleep -Seconds 10
    }
}
