$ErrorActionPreference = 'Continue'

$DatabasePath = 'D:\AmiBroker\eod'
$Symbol = 'FPT'

Write-Host '=== VO HOANG AMIBROKER SYMBOL ADD PROBE ===' -ForegroundColor Cyan
Write-Host ('PowerShell bitness: ' + ([IntPtr]::Size * 8) + '-bit')
Write-Host ('Database path: ' + $DatabasePath)
Write-Host ('Symbol: ' + $Symbol)

try {
    $ab = New-Object -ComObject 'Broker.Application'
    Write-Host 'COM: OK' -ForegroundColor Green
    try { $ab.Visible = 1 } catch {}

    try {
        $loaded = $ab.LoadDatabase($DatabasePath)
        Write-Host ('LoadDatabase result: ' + $loaded)
    } catch {
        Write-Host ('LoadDatabase ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
    try { Write-Host ('Stocks before add: ' + [int]$ab.Stocks.Count) } catch { Write-Host 'Stocks before add: ERROR' }

    $added = $null
    try {
        $added = $ab.Stocks.Add($Symbol)
        if ($null -ne $added) {
            Write-Host ('Stocks.Add: OK ticker=' + [string]$added.Ticker) -ForegroundColor Green
        } else {
            Write-Host 'Stocks.Add: returned NULL' -ForegroundColor Yellow
        }
    } catch {
        Write-Host ('Stocks.Add ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
    try { [void]$ab.RefreshAll() } catch { Write-Host ('RefreshAll ERROR: ' + $_.Exception.Message) -ForegroundColor Yellow }
    Start-Sleep -Seconds 3

    try { Write-Host ('Stocks after add: ' + [int]$ab.Stocks.Count) } catch { Write-Host 'Stocks after add: ERROR' }

    try {
        $s = $ab.Stocks.Item($Symbol)
        if ($null -eq $s) {
            Write-Host 'FPT lookup after add: NULL' -ForegroundColor Yellow
        } else {
            Write-Host ('FPT lookup after add: OK ticker=' + [string]$s.Ticker) -ForegroundColor Green
            try { Write-Host ('DataSource: ' + [string]$s.DataSource) } catch {}
            try { Write-Host ('DataLocalMode: ' + [string]$s.DataLocalMode) } catch {}
            try {
                $qc = [int]$s.Quotations.Count
                Write-Host ('FPT quotations: ' + $qc)
                if ($qc -gt 0) {
                    $q = $s.Quotations.Item($qc - 1)
                    Write-Host ('Last quote date: ' + [string]$q.Date)
                    Write-Host ('Last close: ' + [string]$q.Close)
                    Write-Host ('Last volume: ' + [string]$q.Volume)
                }
            } catch {
                Write-Host ('FPT quotations ERROR: ' + $_.Exception.Message) -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host ('FPT lookup ERROR: ' + $_.Exception.Message) -ForegroundColor Yellow
    }

    Write-Host ''
    Write-Host 'Khong goi SaveDatabase. Symbol chi ton tai trong phien test neu AmiBroker khong tu save.' -ForegroundColor DarkGray
    Write-Host 'Nhan Enter de dong probe.'
    [void](Read-Host)

    try {
        $removed = $ab.Stocks.Remove($Symbol)
        Write-Host ('Cleanup Stocks.Remove: ' + $removed)
    } catch {}

    try { $ab.Quit() } catch {}
} catch {
    Write-Host ('COM ERROR: ' + $_.Exception.Message) -ForegroundColor Red
}
