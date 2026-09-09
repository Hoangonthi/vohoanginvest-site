$ErrorActionPreference = 'Continue'

# VO HOANG Market Sync V1.3
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$BridgeUrl = 'http://127.0.0.1:8765/market/overview'
$StockBaseUrl = 'http://127.0.0.1:8765/stock'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$IntervalSeconds = 60
$WatchListRoot = 'D:\AmiBroker\eod\WatchLists'
$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }

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
    return @(Get-Content -LiteralPath $path -ErrorAction SilentlyContinue | ForEach-Object { $_.Trim().ToUpperInvariant() } | Where-Object { $_ -match '^[A-Z0-9._-]+$' } | Select-Object -Unique)
}

function Get-Breadth([string[]]$symbols) {
    $adv = 0; $flat = 0; $dec = 0; $missing = 0
    foreach ($symbol in $symbols) {
        try {
            $p = Invoke-RestMethod -UseBasicParsing -Uri ($StockBaseUrl + '/' + [Uri]::EscapeDataString($symbol)) -Method Get -TimeoutSec 5
            if (-not $p.ok -or $null -eq $p.quote) { $missing++; continue }
            $chg = [double]$p.quote.change
            if ($chg -gt 0) { $adv++ }
            elseif ($chg -lt 0) { $dec++ }
            else { $flat++ }
        } catch { $missing++ }
    }
    return [pscustomobject]@{ adv=$adv; flat=$flat; dec=$dec; missing=$missing; total=$symbols.Count }
}

function Enrich-MarketData($data) {
    try {
        $vn30Symbols = Read-WatchList 'VN30'
        if ($vn30Symbols.Count -gt 0) {
            $b = Get-Breadth $vn30Symbols
            foreach ($idx in @($data.indexes)) {
                if ($idx.symbol -eq 'VN30') {
                    $idx.adv = $b.adv
                    $idx.flat = $b.flat
                    $idx.dec = $b.dec
                    $idx | Add-Member -NotePropertyName breadth_total -NotePropertyValue $b.total -Force
                    $idx | Add-Member -NotePropertyName breadth_missing -NotePropertyValue $b.missing -Force
                    $idx | Add-Member -NotePropertyName breadth_source -NotePropertyValue 'AmiBroker WatchLists/VN30.tls' -Force
                }
            }
        }
    } catch {
        Write-Host ('[{0}] Khong tinh duoc breadth VN30: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor DarkYellow
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
        $result = Invoke-RestMethod -UseBasicParsing -Uri $RelayUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 20
        if ($result.ok) {
            $elapsed = [Math]::Round(((Get-Date) - $started).TotalSeconds, 1)
            $vn30 = @($data.indexes | Where-Object { $_.symbol -eq 'VN30' }) | Select-Object -First 1
            $breadthText = ''
            if ($null -ne $vn30 -and $null -ne $vn30.adv) { $breadthText = (' | VN30: +{0} ={1} -{2}' -f $vn30.adv, $vn30.flat, $vn30.dec) }
            Write-Host ('[{0}] Da dong bo {1} chi so len website. ({2}s){3}' -f (Get-Date -Format 'HH:mm:ss'), $data.indexes.Count, $elapsed, $breadthText) -ForegroundColor Green
        } else {
            Write-Host ('[{0}] Relay tu choi du lieu: {1}' -f (Get-Date -Format 'HH:mm:ss'), ($result | ConvertTo-Json -Compress)) -ForegroundColor Yellow
        }
    } catch {
        Write-Host ('[{0}] Dong bo loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), (Get-ErrorDetail $_)) -ForegroundColor Red
    }
}

Write-Host 'VO HOANG Market Sync V1.3' -ForegroundColor Cyan
Write-Host ('Bridge: ' + $BridgeUrl)
Write-Host ('Relay:  ' + $RelayUrl)
Write-Host ('Chu ky:  {0} giay | chi gui 08:45-15:00, Thu 2-Thu 6' -f $IntervalSeconds)
Write-Host ('TLS:     ' + [Net.ServicePointManager]::SecurityProtocol)
Write-Host 'VN30 breadth: tinh tu D:\AmiBroker\eod\WatchLists\VN30.tls' -ForegroundColor Cyan
Write-Host 'GIU CUA SO NAY MO TRONG GIO GIAO DICH.' -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($BridgeKey)) {
    Write-Host 'THIEU VH_BRIDGE_KEY. Chay lenh setup 1 lan theo huong dan.' -ForegroundColor Red
    exit 2
}

$nextOutsideNotice = [DateTime]::MinValue
while ($true) {
    try {
        if (Is-TradingWindow) {
            Push-Once
            $next = (Get-Date).AddSeconds($IntervalSeconds)
            Write-Host ('          Lan tiep theo: {0}' -f $next.ToString('HH:mm:ss')) -ForegroundColor DarkGray
            Start-Sleep -Seconds $IntervalSeconds
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
