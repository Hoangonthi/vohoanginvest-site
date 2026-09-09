$ErrorActionPreference = 'Continue'

$DatabasePath = 'D:\AmiBroker\eod'

Write-Host '=== VO HOANG AMIBROKER METASTOCK PROBE ===' -ForegroundColor Cyan
Write-Host ('PowerShell bitness: ' + ([IntPtr]::Size * 8) + '-bit')
Write-Host ('Database path: ' + $DatabasePath)
Write-Host ('Database exists: ' + (Test-Path $DatabasePath))
Write-Host ('broker.master exists: ' + (Test-Path (Join-Path $DatabasePath 'broker.master')))
Write-Host ('data_location.conf exists: ' + (Test-Path (Join-Path $DatabasePath 'data_location.conf')))

$conf = Join-Path $DatabasePath 'data_location.conf'
if (Test-Path $conf) {
    Write-Host ''
    Write-Host '--- data_location.conf ---' -ForegroundColor DarkCyan
    try { Get-Content -LiteralPath $conf -ErrorAction Stop | Select-Object -First 100 | ForEach-Object { Write-Host $_ } }
    catch { Write-Host ('Khong doc duoc data_location.conf: ' + $_.Exception.Message) -ForegroundColor Yellow }
}

try {
    $ab = New-Object -ComObject 'Broker.Application'
    Write-Host ''
    Write-Host 'COM: OK' -ForegroundColor Green

    try {
        $ab.Visible = 1
        Write-Host 'Visible=1: OK' -ForegroundColor Green
    } catch {
        Write-Host ('Visible=1: FAIL - ' + $_.Exception.Message) -ForegroundColor Yellow
    }

    try { $before = [int]$ab.Stocks.Count } catch { $before = -1 }
    Write-Host ('Stocks before LoadDatabase: ' + $before)

    try {
        $loaded = $ab.LoadDatabase($DatabasePath)
        Write-Host ('LoadDatabase result: ' + $loaded) -ForegroundColor Cyan
    } catch {
        Write-Host ('LoadDatabase ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    }

    Start-Sleep -Seconds 3
    try { $ab.RefreshAll() } catch { Write-Host ('RefreshAll ERROR: ' + $_.Exception.Message) -ForegroundColor Yellow }
    Start-Sleep -Seconds 2

    try { $after = [int]$ab.Stocks.Count } catch { $after = -1 }
    Write-Host ('Stocks after LoadDatabase: ' + $after)

    try {
        $db = [string]$ab.DatabasePath
        Write-Host ('DatabasePath property: ' + $db)
    } catch { Write-Host ('DatabasePath ERROR: ' + $_.Exception.Message) -ForegroundColor Yellow }

    Write-Host ''
    Write-Host '--- GetTickerList probes ---' -ForegroundColor DarkCyan
    foreach ($type in 0..4) {
        try {
            $list = [string]$ab.Stocks.GetTickerList($type)
            $preview = if ($list.Length -gt 300) { $list.Substring(0,300) + '...' } else { $list }
            Write-Host ('Type ' + $type + ': length=' + $list.Length + ' preview=' + $preview)
        } catch {
            Write-Host ('Type ' + $type + ': ERROR - ' + $_.Exception.Message) -ForegroundColor Yellow
        }
    }

    Write-Host ''
    Write-Host '--- FPT direct lookup ---' -ForegroundColor DarkCyan
    try {
        $fpt = $ab.Stocks.Item('FPT')
        if ($null -eq $fpt) { Write-Host 'FPT Item: NULL' -ForegroundColor Yellow }
        else {
            Write-Host ('FPT Item: OK ticker=' + [string]$fpt.Ticker) -ForegroundColor Green
            try { Write-Host ('FPT quotations: ' + [int]$fpt.Quotations.Count) } catch { Write-Host ('FPT quotations ERROR: ' + $_.Exception.Message) }
        }
    } catch {
        Write-Host ('FPT Item: ERROR - ' + $_.Exception.Message) -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'Probe xong. De cua so AmiBroker ma probe mo ra neu co; KHONG Save Database.' -ForegroundColor Cyan
} catch {
    Write-Host ('COM ERROR: ' + $_.Exception.Message) -ForegroundColor Red
}

Write-Host ''
Write-Host 'Nhan Enter de dong probe.'
[void](Read-Host)
