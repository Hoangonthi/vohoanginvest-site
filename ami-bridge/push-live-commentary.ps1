$ErrorActionPreference = 'Continue'

# VÕ HOÀNG - LIVE MARKET COMMENTARY BRIDGE V2 (LOCAL-FIRST)
# - AFL chỉ cung cấp kỹ thuật VN-Index.
# - Watch Lists của AmiBroker là nguồn nhóm ngành gốc, không sao chép danh sách mã lên cloud.
# - Dữ liệu thô 15 giây/lần được giữ trên máy.
# - Supabase chỉ nhận trạng thái gọn để phục vụ web; backend tự lưu history thưa + event/comment.
# - Không gọi AI từ máy local.

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$SnapshotCsv = 'C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv'
$StockBaseUrl = 'http://127.0.0.1:8765/stock'
$BridgeHealthUrl = 'http://127.0.0.1:8765/health'
$MarketContextUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-live-ingest'

$IntervalSeconds = 15
$ContextRefreshSeconds = 45
$SectorRefreshSeconds = 45
$TechnicalFreshSeconds = 60
$LocalRetentionDays = 45

$LocalRoot = Join-Path $PSScriptRoot 'live-data'
$WatchListCandidates = @(
    'D:\AmiBroker\eod\WatchLists',
    'D:\AmiBroker\WatchLists',
    'C:\AmiBroker\eod\WatchLists',
    'C:\AmiBroker\WatchLists'
)

# Tên file Watch List đang có trên AmiBroker của bạn -> tên hiển thị trên web.
# Normalize bỏ khoảng trắng / dấu gạch nên "Ngan Hang.tls" -> NGANHANG.
$SectorNameMap = [ordered]@{
    'BATDONGSAN'       = 'Bất động sản'
    'BAOHIEM'          = 'Bảo hiểm'
    'CAOSU'            = 'Cao su'
    'CANGBIEN'         = 'Cảng biển'
    'CHUNGKHOAN'       = 'Chứng khoán'
    'CONGNGHEVIENTHONG'= 'Công nghệ viễn thông'
    'DICHVUCONGICH'    = 'Dịch vụ công ích'
    'GIAODUC'          = 'Giáo dục'
    'HANGKHONG'        = 'Hàng không'
    'KHOANGSAN'        = 'Khoáng sản'
    'NANGLUONGDIENKHI' = 'Năng lượng điện khí'
    'NGANHANG'         = 'Ngân hàng'
    'THEP'             = 'Thép'
    'DAUKHI'           = 'Dầu khí'
    'PHANBON'          = 'Phân bón'
    'THUCPHAM'         = 'Thực phẩm'
    'THUONGMAI'        = 'Thương mại'
    'THUYSAN'          = 'Thủy sản'
    'VATLIEUXAYDUNG'   = 'Vật liệu xây dựng'
    'XAYDUNG'          = 'Xây dựng'
    'DAUTUPHATTRIEN'   = 'Đầu tư phát triển'
}

$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }
if ([string]::IsNullOrWhiteSpace($BridgeKey)) {
    Write-Host 'THIEU VH_BRIDGE_KEY. Live commentary bridge khong the gui du lieu.' -ForegroundColor Red
    exit 3
}

$script:LastCsvWriteUtc = [DateTime]::MinValue
$script:LastContextAtUtc = [DateTime]::MinValue
$script:LastSectorAtUtc = [DateTime]::MinValue
$script:MarketContext = $null
$script:LastTechnical = $null
$script:SectorSnapshot = @()
$script:StockSnapshot = @{}
$script:WatchListRoot = $null
$script:LastCloudPushUtc = [DateTime]::MinValue

function Get-VnNow {
    return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time')
}

function Is-TradingWindow {
    $now = Get-VnNow
    if ($now.DayOfWeek -eq [DayOfWeek]::Saturday -or $now.DayOfWeek -eq [DayOfWeek]::Sunday) { return $false }
    $m = $now.Hour * 60 + $now.Minute
    return (($m -ge (8*60+45) -and $m -le (11*60+31)) -or ($m -ge (13*60) -and $m -le (15*60+1)))
}

function Convert-LiveNum($value) {
    if ($null -eq $value) { return $null }
    $s = ([string]$value).Trim()
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    $x = 0.0
    if ([double]::TryParse($s, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$x)) { return $x }
    if ([double]::TryParse($s, [ref]$x)) { return $x }
    return $null
}

function Normalize-WatchName([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return '' }
    return (($name.ToUpperInvariant()) -replace '[^A-Z0-9]','')
}

function Resolve-WatchListRoot {
    foreach ($p in $WatchListCandidates) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

function Read-WatchListFile([string]$path) {
    if (-not (Test-Path -LiteralPath $path)) { return @() }
    return @(
        Get-Content -LiteralPath $path -ErrorAction SilentlyContinue |
        ForEach-Object { $_.Trim().ToUpperInvariant() } |
        Where-Object { $_ -match '^[A-Z0-9._-]+$' } |
        Select-Object -Unique
    )
}

function Get-SectorWatchLists {
    $root = $script:WatchListRoot
    if ([string]::IsNullOrWhiteSpace($root) -or -not (Test-Path -LiteralPath $root)) { return @() }

    $rows = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $root -Filter '*.tls' -File -ErrorAction SilentlyContinue)) {
        $key = Normalize-WatchName ([IO.Path]::GetFileNameWithoutExtension($file.Name))
        if (-not $SectorNameMap.Contains($key)) { continue }
        $symbols = Read-WatchListFile $file.FullName
        if ($symbols.Count -lt 1) { continue }
        $rows += [pscustomobject]@{
            key = $key
            name = $SectorNameMap[$key]
            file = $file.Name
            symbols = @($symbols)
        }
    }
    return @($rows)
}

function Test-LocalBridge {
    try {
        $r = Invoke-RestMethod -UseBasicParsing -Uri $BridgeHealthUrl -Method Get -TimeoutSec 2
        return ($null -ne $r -and $r.ok)
    } catch { return $false }
}

function Get-StockQuote([string]$symbol, [string]$today) {
    try {
        $p = Invoke-RestMethod -UseBasicParsing -Uri ($StockBaseUrl + '/' + [Uri]::EscapeDataString($symbol)) -Method Get -TimeoutSec 2
        if (-not $p.ok -or $null -eq $p.quote) { return $null }
        # Chỉ dùng quote của đúng ngày giao dịch hiện tại. Nếu mã chưa có tick hôm nay thì bỏ qua,
        # tránh nhầm biến động của phiên trước.
        if ([string]$p.quote.date -ne $today) { return $null }
        $pct = Convert-LiveNum $p.quote.change_pct
        if ($null -eq $pct) { return $null }
        return [pscustomobject]@{
            symbol = $symbol
            price = Convert-LiveNum $p.quote.close
            change = Convert-LiveNum $p.quote.change
            change_pct = [Math]::Round([double]$pct, 3)
            volume = Convert-LiveNum $p.quote.volume
            date = [string]$p.quote.date
            source_updated_at = [string]$p.quote.source_updated_at
        }
    } catch {
        return $null
    }
}

function Refresh-SectorSnapshot {
    $nowUtc = [DateTime]::UtcNow
    if ($script:SectorSnapshot.Count -gt 0 -and ($nowUtc - $script:LastSectorAtUtc).TotalSeconds -lt $SectorRefreshSeconds) { return }
    if (-not (Test-LocalBridge)) {
        Write-Host ('[{0}] Watch Lists: AmiBridge local chua san sang.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkYellow
        return
    }

    $groups = @(Get-SectorWatchLists)
    if ($groups.Count -lt 1) {
        Write-Host ('[{0}] Watch Lists: chua tim thay nhom nganh tai {1}' -f (Get-Date -Format 'HH:mm:ss'), $script:WatchListRoot) -ForegroundColor DarkYellow
        return
    }

    $allSymbols = @($groups | ForEach-Object { $_.symbols } | Select-Object -Unique)
    $today = (Get-VnNow).ToString('yyyy-MM-dd')
    $quotes = @{}

    foreach ($symbol in $allSymbols) {
        $q = Get-StockQuote $symbol $today
        if ($null -ne $q) { $quotes[$symbol] = $q }
    }

    $sectorRows = @()
    foreach ($g in $groups) {
        $valid = @()
        foreach ($symbol in $g.symbols) {
            if ($quotes.ContainsKey($symbol)) { $valid += $quotes[$symbol] }
        }
        if ($valid.Count -lt 1) { continue }

        $adv = @($valid | Where-Object { [double]$_.change_pct -gt 0.001 }).Count
        $dec = @($valid | Where-Object { [double]$_.change_pct -lt -0.001 }).Count
        $flat = $valid.Count - $adv - $dec
        $avg = ($valid | Measure-Object -Property change_pct -Average).Average
        $sorted = @($valid | Sort-Object -Property change_pct -Descending)
        $gainers = @($sorted | Where-Object { [double]$_.change_pct -gt 0 } | Select-Object -First 3)
        $losers = @($sorted | Where-Object { [double]$_.change_pct -lt 0 } | Sort-Object -Property change_pct | Select-Object -First 3)
        $coverage = if ($g.symbols.Count -gt 0) { $valid.Count / [double]$g.symbols.Count } else { 0 }

        $sectorRows += [pscustomobject]@{
            key = $g.key
            name = $g.name
            watchlist_file = $g.file
            member_count = $g.symbols.Count
            valid_count = $valid.Count
            coverage = [Math]::Round($coverage, 3)
            adv = $adv
            flat = $flat
            dec = $dec
            breadth_balance = if ($valid.Count -gt 0) { [Math]::Round(($adv - $dec) / [double]$valid.Count, 3) } else { $null }
            change_pct = [Math]::Round([double]$avg, 3)
            top_gainers = @($gainers)
            top_losers = @($losers)
        }
    }

    $script:StockSnapshot = $quotes
    $script:SectorSnapshot = @($sectorRows | Sort-Object -Property change_pct -Descending)
    $script:LastSectorAtUtc = $nowUtc

    $topText = @($script:SectorSnapshot | Select-Object -First 3 | ForEach-Object { '{0} {1:+0.00;-0.00;0.00}%%' -f $_.name, [double]$_.change_pct }) -join ' | '
    Write-Host ('[{0}] Watch Lists: {1} nhom, {2}/{3} ma co du lieu. {4}' -f (Get-Date -Format 'HH:mm:ss'), $script:SectorSnapshot.Count, $quotes.Count, $allSymbols.Count, $topText) -ForegroundColor DarkCyan
}

function Refresh-MarketContext {
    $nowUtc = [DateTime]::UtcNow
    if ($null -ne $script:MarketContext -and ($nowUtc - $script:LastContextAtUtc).TotalSeconds -lt $ContextRefreshSeconds) { return }
    try {
        $ctx = Invoke-RestMethod -UseBasicParsing -Uri $MarketContextUrl -Method Get -TimeoutSec 8
        if ($null -ne $ctx -and $ctx.ok) {
            $script:MarketContext = $ctx
            $script:LastContextAtUtc = $nowUtc
        }
    } catch {
        Write-Host ('[{0}] Live context chua cap nhat duoc: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
    }
}

function Read-TechnicalSnapshot {
    if (-not (Test-Path -LiteralPath $SnapshotCsv)) { return $null }
    try {
        $file = Get-Item -LiteralPath $SnapshotCsv -ErrorAction Stop
        $age = ([DateTime]::UtcNow - $file.LastWriteTimeUtc).TotalSeconds
        if ($age -gt $TechnicalFreshSeconds) { return $null }

        if ($file.LastWriteTimeUtc -le $script:LastCsvWriteUtc) {
            if ($null -ne $script:LastTechnical) { return $script:LastTechnical }
            return $null
        }

        $before = $file.LastWriteTimeUtc
        Start-Sleep -Milliseconds 250
        $row = @(Import-Csv -LiteralPath $SnapshotCsv -ErrorAction Stop) | Select-Object -First 1
        $after = (Get-Item -LiteralPath $SnapshotCsv -ErrorAction Stop).LastWriteTimeUtc
        if ($after -ne $before -or $null -eq $row) { return $script:LastTechnical }
        $script:LastCsvWriteUtc = $after

        $technical = [ordered]@{
            symbol = ([string]$row.symbol).Trim()
            value = Convert-LiveNum $row.value
            reference = Convert-LiveNum $row.reference
            change = Convert-LiveNum $row.change
            change_pct = Convert-LiveNum $row.change_pct
            open = Convert-LiveNum $row.open
            high = Convert-LiveNum $row.high
            low = Convert-LiveNum $row.low
            rebound_from_low = Convert-LiveNum $row.rebound_from_low
            drop_from_high = Convert-LiveNum $row.drop_from_high
            ma10 = Convert-LiveNum $row.ma10
            ma20 = Convert-LiveNum $row.ma20
            ma50 = Convert-LiveNum $row.ma50
            vwap = Convert-LiveNum $row.vwap
            rsi14 = Convert-LiveNum $row.rsi14
            macd = Convert-LiveNum $row.macd
            macd_signal = Convert-LiveNum $row.macd_signal
            prev_high = Convert-LiveNum $row.prev_high
            prev_low = Convert-LiveNum $row.prev_low
            high20 = Convert-LiveNum $row.high20
            low20 = Convert-LiveNum $row.low20
            support_near = Convert-LiveNum $row.support_near
            resistance_near = Convert-LiveNum $row.resistance_near
            updated_at = ([string]$row.updated_at).Trim()
        }
        $script:LastTechnical = $technical
        return $technical
    } catch {
        Write-Host ('[{0}] Khong doc duoc AFL snapshot: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
        return $script:LastTechnical
    }
}

function Is-TechnicalFresh {
    if (-not (Test-Path -LiteralPath $SnapshotCsv)) { return $false }
    try {
        $age = ([DateTime]::UtcNow - (Get-Item -LiteralPath $SnapshotCsv -ErrorAction Stop).LastWriteTimeUtc).TotalSeconds
        return ($age -le $TechnicalFreshSeconds)
    } catch { return $false }
}

function Get-CloudMarketContext {
    $ctx = $script:MarketContext
    if ($null -eq $ctx) { return $null }
    return [ordered]@{
        ok = $ctx.ok
        updated_at = $ctx.updated_at
        relay_received_at = $ctx.relay_received_at
        relay_source_updated_at = $ctx.relay_source_updated_at
        indexes = $ctx.indexes
        market_intelligence = $ctx.market_intelligence
        vn30_stocks = $ctx.vn30_stocks
    }
}

function Save-LocalRaw($technical, [bool]$technicalAvailable) {
    try {
        $now = Get-VnNow
        $day = $now.ToString('yyyy-MM-dd')
        $dir = Join-Path $LocalRoot $day
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

        $stockRows = @()
        foreach ($key in $script:StockSnapshot.Keys) { $stockRows += $script:StockSnapshot[$key] }

        $raw = [ordered]@{
            captured_at = [DateTimeOffset]::UtcNow.ToString('o')
            market_date = $day
            technical_available = $technicalAvailable
            technical = if ($technicalAvailable) { $technical } else { @{} }
            sector_watchlists = @($script:SectorSnapshot)
            stocks = @($stockRows)
            market_context = Get-CloudMarketContext
        }

        $line = $raw | ConvertTo-Json -Depth 16 -Compress
        $historyFile = Join-Path $dir 'market-live.ndjson'
        Add-Content -LiteralPath $historyFile -Value $line -Encoding UTF8
        $latestFile = Join-Path $LocalRoot 'latest.json'
        $line | Set-Content -LiteralPath $latestFile -Encoding UTF8
    } catch {
        Write-Host ('[{0}] Khong luu duoc local history: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
    }
}

function Cleanup-LocalHistory {
    try {
        if (-not (Test-Path -LiteralPath $LocalRoot)) { New-Item -ItemType Directory -Path $LocalRoot -Force | Out-Null; return }
        $cutoff = (Get-VnNow).Date.AddDays(-$LocalRetentionDays)
        foreach ($dir in @(Get-ChildItem -LiteralPath $LocalRoot -Directory -ErrorAction SilentlyContinue)) {
            $d = [DateTime]::MinValue
            if ([DateTime]::TryParseExact($dir.Name, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$d)) {
                if ($d -lt $cutoff) { Remove-Item -LiteralPath $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue }
            }
        }
    } catch {}
}

function Push-CloudState($technical, [bool]$technicalAvailable) {
    if ($null -eq $script:MarketContext -and -not $technicalAvailable -and $script:SectorSnapshot.Count -lt 1) { return }

    $sourceUpdatedAt = $null
    if ($technicalAvailable -and $script:LastCsvWriteUtc -gt [DateTime]::MinValue) {
        $sourceUpdatedAt = ([DateTimeOffset]$script:LastCsvWriteUtc).ToString('o')
    }

    $payload = [ordered]@{
        ok = $true
        captured_at = [DateTimeOffset]::UtcNow.ToString('o')
        source_updated_at = $sourceUpdatedAt
        source = if ($technicalAvailable) { 'amibroker-afl+watchlists+market-feed' } else { 'watchlists+market-feed-fallback' }
        technical_available = $technicalAvailable
        technical = if ($technicalAvailable) { $technical } else { @{} }
        sector_watchlists = @($script:SectorSnapshot)
        market_context = Get-CloudMarketContext
        local_first = $true
        local_history_interval_seconds = $IntervalSeconds
        cloud_history_target_seconds = 60
    }

    try {
        $headers = @{ 'x-bridge-key' = $BridgeKey }
        $body = $payload | ConvertTo-Json -Depth 18 -Compress
        $r = Invoke-RestMethod -UseBasicParsing -Uri $RelayUrl -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 15
        if ($r.ok) {
            if ($null -ne $r.published_comment) {
                Write-Host ('[{0}] LIVE COMMENT: {1}' -f (Get-Date -Format 'HH:mm:ss'), $r.published_comment.headline) -ForegroundColor Green
            } elseif ($r.history_stored) {
                Write-Host ('[{0}] Live current OK + cloud history.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
            } else {
                Write-Host ('[{0}] Live current OK (raw history local).' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Host ('[{0}] Live push loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
    }
}

$script:WatchListRoot = Resolve-WatchListRoot
Cleanup-LocalHistory

Write-Host 'VO HOANG - LIVE MARKET COMMENTARY BRIDGE V2 / LOCAL-FIRST' -ForegroundColor Cyan
Write-Host ('AFL CSV: ' + $SnapshotCsv)
Write-Host ('Watch Lists: ' + $(if ($script:WatchListRoot) { $script:WatchListRoot } else { 'CHUA TIM THAY' }))
Write-Host ('Local history: ' + $LocalRoot)
Write-Host ('Raw local: {0}s | Watch Lists: {1}s | Market context: {2}s' -f $IntervalSeconds, $SectorRefreshSeconds, $ContextRefreshSeconds)
Write-Host 'Cloud chi giu current + history thua + event/comment; du lieu tung ma day du nam tren may.' -ForegroundColor DarkCyan
Write-Host ''

while ($true) {
    if (-not (Is-TradingWindow)) {
        Start-Sleep -Seconds 20
        continue
    }

    Refresh-MarketContext
    Refresh-SectorSnapshot
    $technical = Read-TechnicalSnapshot
    $technicalAvailable = ($null -ne $technical -and (Is-TechnicalFresh))

    Save-LocalRaw $technical $technicalAvailable
    Push-CloudState $technical $technicalAvailable
    $script:LastCloudPushUtc = [DateTime]::UtcNow

    Start-Sleep -Seconds $IntervalSeconds
}
