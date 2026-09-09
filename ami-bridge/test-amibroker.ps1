$ErrorActionPreference = 'Stop'

$DatabasePath = 'D:\AmiBroker\eod'
$SymbolsToTry = @('VN-INDEX','VNINDEX','VN30','VN100','HNX-INDEX','HNXINDEX','FPT')

function Get-LastQuote($stock) {
    if ($null -eq $stock) { return $null }
    $quotes = $stock.Quotations
    if ($null -eq $quotes -or $quotes.Count -lt 1) { return $null }

    $lastIndex = $quotes.Count - 1
    $q = $quotes.Item($lastIndex)
    $prev = if ($lastIndex -ge 1) { $quotes.Item($lastIndex - 1) } else { $null }

    $close = [double]$q.Close
    $prevClose = if ($null -ne $prev) { [double]$prev.Close } else { $close }
    $change = $close - $prevClose
    $changePct = if ($prevClose -ne 0) { ($change / $prevClose) * 100 } else { 0 }

    [pscustomobject]@{
        symbol = [string]$stock.Ticker
        date = [string]$q.Date
        open = [double]$q.Open
        high = [double]$q.High
        low = [double]$q.Low
        close = $close
        prev_close = $prevClose
        change = $change
        change_pct = $changePct
        volume = [double]$q.Volume
        quotations_count = [int]$quotes.Count
    }
}

try {
    $AB = New-Object -ComObject 'Broker.Application'
    Write-Host "AmiBroker version: $($AB.Version)" -ForegroundColor Cyan
    Write-Host "Database currently open: $($AB.DatabasePath)" -ForegroundColor DarkGray

    if ($AB.DatabasePath -ne $DatabasePath) {
        Write-Host "Loading database: $DatabasePath" -ForegroundColor Yellow
        $loaded = $AB.LoadDatabase($DatabasePath)
        if (-not $loaded) { throw "Không thể LoadDatabase($DatabasePath)" }
    }

    $AB.RefreshAll()
    Start-Sleep -Milliseconds 350

    $rows = @()
    foreach ($symbol in $SymbolsToTry) {
        try {
            $stock = $AB.Stocks.Item($symbol)
            $row = Get-LastQuote $stock
            if ($null -ne $row) { $rows += $row }
        } catch {
        }
    }

    $result = [pscustomobject]@{
        ok = $true
        database_path = [string]$AB.DatabasePath
        amibroker_version = [string]$AB.Version
        generated_at = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        data = $rows
    }

    $json = $result | ConvertTo-Json -Depth 5
    $out = Join-Path $PSScriptRoot 'amibroker-test-output.json'
    [System.IO.File]::WriteAllText($out, $json, [System.Text.UTF8Encoding]::new($false))
    Write-Host "`nĐã đọc $($rows.Count) mã. Kết quả: $out" -ForegroundColor Green
    $json
}
catch {
    Write-Host "LỖI: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
