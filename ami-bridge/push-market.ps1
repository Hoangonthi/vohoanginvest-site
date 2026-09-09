$ErrorActionPreference = 'Continue'

$BridgeUrl = 'http://127.0.0.1:8765/market/overview'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$IntervalSeconds = 60
$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }

function Is-TradingWindow {
    $now = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time')
    if ($now.DayOfWeek -eq [DayOfWeek]::Saturday -or $now.DayOfWeek -eq [DayOfWeek]::Sunday) { return $false }
    $mins = ($now.Hour * 60) + $now.Minute
    return ($mins -ge (8*60+45) -and $mins -le (15*60))
}

function Push-Once {
    try {
        $data = Invoke-RestMethod -UseBasicParsing -Uri $BridgeUrl -Method Get -TimeoutSec 10
        if (-not $data.ok -or -not $data.indexes -or $data.indexes.Count -lt 1) {
            Write-Host ('[{0}] Bridge chua co du lieu chi so.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor Yellow
            return
        }
        $json = $data | ConvertTo-Json -Depth 10 -Compress
        $headers = @{ 'x-bridge-key' = $BridgeKey }
        $result = Invoke-RestMethod -UseBasicParsing -Uri $RelayUrl -Method Post -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 15
        if ($result.ok) {
            Write-Host ('[{0}] Da dong bo {1} chi so len website.' -f (Get-Date -Format 'HH:mm:ss'), $data.indexes.Count) -ForegroundColor Green
        } else {
            Write-Host ('[{0}] Relay tu choi du lieu.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor Yellow
        }
    } catch {
        Write-Host ('[{0}] Dong bo loi: {1}' -f (Get-Date -Format 'HH:mm:ss'), $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host 'VO HOANG Market Sync V1.0' -ForegroundColor Cyan
Write-Host ('Bridge: ' + $BridgeUrl)
Write-Host ('Relay:  ' + $RelayUrl)
Write-Host ('Chu ky:  {0} giay | chi gui 08:45-15:00, Thu 2-Thu 6' -f $IntervalSeconds)

if ([string]::IsNullOrWhiteSpace($BridgeKey)) {
    Write-Host 'THIEU VH_BRIDGE_KEY. Chay lenh setup 1 lan theo huong dan.' -ForegroundColor Red
    Write-Host 'Nhan Enter de dong.'
    [void](Read-Host)
    exit 2
}

while ($true) {
    if (Is-TradingWindow) {
        Push-Once
        Start-Sleep -Seconds $IntervalSeconds
    } else {
        Write-Host ('[{0}] Ngoai gio 08:45-15:00, tam dung dong bo.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray
        Start-Sleep -Seconds 300
    }
}
