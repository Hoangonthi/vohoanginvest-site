$ErrorActionPreference = 'Continue'

# VÕ HOÀNG - LIVE MARKET COMMENTARY BRIDGE V1
# Đọc snapshot kỹ thuật do AFL xuất, ghép market context đang có trên cloud,
# rồi gửi sang market-live-ingest. Không gọi AI từ máy local.

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$SnapshotCsv = 'C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv'
$MarketContextUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-live-ingest'
$IntervalSeconds = 15
$ContextRefreshSeconds = 45
$TechnicalFreshSeconds = 50

$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }
if ([string]::IsNullOrWhiteSpace($BridgeKey)) {
    Write-Host 'THIEU VH_BRIDGE_KEY. Live commentary bridge khong the gui du lieu.' -ForegroundColor Red
    exit 3
}

$script:LastCsvWriteUtc = [DateTime]::MinValue
$script:LastContextAtUtc = [DateTime]::MinValue
$script:LastFallbackPushUtc = [DateTime]::MinValue
$script:MarketContext = $null
$script:LastTechnical = $null

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

        if ($file.LastWriteTimeUtc -le $script:LastCsvWriteUtc) { return '__UNCHANGED__' }
        $before = $file.LastWriteTimeUtc
        Start-Sleep -Milliseconds 250
        $row = @(Import-Csv -LiteralPath $SnapshotCsv -ErrorAction Stop) | Select-Object -First 1
        $after = (Get-Item -LiteralPath $SnapshotCsv -ErrorAction Stop).LastWriteTimeUtc
        if ($after -ne $before -or $null -eq $row) { return '__UNCHANGED__' }
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
        return $null
    }
}

function Is-TechnicalFresh {
    if (-not (Test-Path -LiteralPath $SnapshotCsv)) { return $false }
    try {
        $age = ([DateTime]::UtcNow - (Get-Item -LiteralPath $SnapshotCsv -ErrorAction Stop).LastWriteTimeUtc).TotalSeconds
        return ($age -le $TechnicalFreshSeconds)
    } catch { return $false }
}

function Push-LiveSnapshot($technical, [bool]$technicalAvailable) {
    if ($null -eq $script:MarketContext -and -not $technicalAvailable) { return }

    $sourceUpdatedAt = $null
    if ($technicalAvailable -and $script:LastCsvWriteUtc -gt [DateTime]::MinValue) {
        $sourceUpdatedAt = ([DateTimeOffset]$script:LastCsvWriteUtc).ToString('o')
    }

    $payload = [ordered]@{
        ok = $true
        captured_at = [DateTimeOffset]::UtcNow.ToString('o')
        source_updated_at = $sourceUpdatedAt
        source = if ($technicalAvailable) { 'amibroker-afl+market-feed' } else { 'market-feed-fallback' }
        technical_available = $technicalAvailable
        technical = if ($technicalAvailable) { $technical } else { @{} }
        market_context = $script:MarketContext
    }

    try {
        $headers = @{ 'x-bridge-key' = $BridgeKey }
        $body = $payload | ConvertTo-Json -Depth 20 -Compress
        $r = Invoke-RestMethod -UseBasicParsing -Uri $RelayUrl -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 12
        if ($r.ok) {
            if ($null -ne $r.published_comment) {
                Write-Host ('[{0}] LIVE COMMENT: {1}' -f (Get-Date -Format 'HH:mm:ss'), $r.published_comment.headline) -ForegroundColor Green
            } else {
                Write-Host ('[{0}] Live snapshot OK.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
            }
        }
    } catch {
        Write-Host ('[{0}] Live push loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
    }
}

Write-Host 'VO HOANG - LIVE MARKET COMMENTARY BRIDGE V1' -ForegroundColor Cyan
Write-Host ('AFL CSV: ' + $SnapshotCsv)
Write-Host ('Chu ky: {0}s | Context: {1}s' -f $IntervalSeconds, $ContextRefreshSeconds)
Write-Host 'Neu AFL chua chay, he thong van gui market context fallback de kiem tra pipeline.' -ForegroundColor DarkCyan
Write-Host ''

while ($true) {
    if (-not (Is-TradingWindow)) {
        Start-Sleep -Seconds 20
        continue
    }

    Refresh-MarketContext
    $technical = Read-TechnicalSnapshot

    if ($technical -is [string] -and $technical -eq '__UNCHANGED__') {
        if (([DateTime]::UtcNow - $script:LastFallbackPushUtc).TotalSeconds -ge 30) {
            if ($null -ne $script:LastTechnical -and (Is-TechnicalFresh)) {
                Push-LiveSnapshot $script:LastTechnical $true
            } else {
                Push-LiveSnapshot $null $false
            }
            $script:LastFallbackPushUtc = [DateTime]::UtcNow
        }
    }
    elseif ($null -ne $technical) {
        Push-LiveSnapshot $technical $true
        $script:LastFallbackPushUtc = [DateTime]::UtcNow
    }
    elseif (([DateTime]::UtcNow - $script:LastFallbackPushUtc).TotalSeconds -ge 30) {
        Push-LiveSnapshot $null $false
        $script:LastFallbackPushUtc = [DateTime]::UtcNow
    }

    Start-Sleep -Seconds $IntervalSeconds
}
