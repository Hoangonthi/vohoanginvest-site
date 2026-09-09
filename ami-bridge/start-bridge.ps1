$ErrorActionPreference = 'Stop'

# VO HOANG AmiBridge V1.2
# Read-only bridge: AmiBroker COM -> local JSON HTTP API

$Config = @{
    DatabasePath = 'D:\AmiBroker\eod'
    ListenPrefix = 'http://127.0.0.1:8765/'
    CacheMs = 1500
    SymbolAliases = @{
        'VN-INDEX' = @('VN-INDEX','VNINDEX','VNINDEX_INDEX')
        'VN30' = @('VN30','VN30-INDEX','VN30INDEX')
        'VN100' = @('VN100','VN100-INDEX','VN100INDEX')
        'HNX-INDEX' = @('HNX-INDEX','HNXINDEX','HNX-INDEX_INDEX')
    }
}

$script:AB = $null
$script:ConnectionMode = 'unknown'
$script:LoadDatabaseResult = $null
$script:LoadDatabaseError = $null
$script:StocksBeforeLoad = 0
$script:StocksAfterLoad = 0
$script:RefreshError = $null
$script:Cache = @{}
$script:CacheTime = @{}

function JsonResponse($context, $statusCode, $obj) {
    $json = $obj | ConvertTo-Json -Depth 8 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response = $context.Response
    $response.StatusCode = $statusCode
    $response.ContentType = 'application/json; charset=utf-8'
    $response.ContentEncoding = [System.Text.Encoding]::UTF8
    $response.AddHeader('Cache-Control','no-store')
    $response.AddHeader('Access-Control-Allow-Origin','*')
    $response.AddHeader('Access-Control-Allow-Methods','GET,OPTIONS')
    $response.OutputStream.Write($bytes,0,$bytes.Length)
    $response.Close()
}

function Get-StockCount($ab) {
    try { return [int]$ab.Stocks.Count } catch { return 0 }
}

function Get-DatabasePathSafe($ab) {
    try {
        $p = [string]$ab.DatabasePath
        if (-not [string]::IsNullOrWhiteSpace($p)) { return $p }
    } catch {}
    return ''
}

function Connect-AmiBroker {
    if ($null -ne $script:AB) { return $script:AB }

    try {
        $active = [Runtime.InteropServices.Marshal]::GetActiveObject('Broker.Application')
        if ($null -ne $active) {
            $script:AB = $active
            $script:ConnectionMode = 'active-instance'
        }
    } catch {}

    if ($null -eq $script:AB) {
        $script:AB = New-Object -ComObject 'Broker.Application'
        $script:ConnectionMode = 'new-com-instance'
    }

    $script:StocksBeforeLoad = Get-StockCount $script:AB
    if ($script:StocksBeforeLoad -lt 1) {
        try {
            $result = $script:AB.LoadDatabase($Config.DatabasePath)
            $script:LoadDatabaseResult = $result
        } catch {
            $script:LoadDatabaseError = $_.Exception.Message
        }

        Start-Sleep -Milliseconds 1000
        try {
            [void]$script:AB.RefreshAll()
        } catch {
            $script:RefreshError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 1500
    }

    $script:StocksAfterLoad = Get-StockCount $script:AB
    return $script:AB
}

function Get-StockSafe([string]$symbol) {
    $ab = Connect-AmiBroker
    try { return $ab.Stocks.Item($symbol) } catch { return $null }
}

function Resolve-Symbol([string[]]$aliases) {
    foreach ($candidate in $aliases) {
        $stock = Get-StockSafe $candidate
        if ($null -ne $stock) { return $stock }
    }
    return $null
}

function Get-LastQuote($stock) {
    if ($null -eq $stock) { return $null }
    $quotes = $stock.Quotations
    if ($null -eq $quotes -or $quotes.Count -lt 1) { return $null }
    $i = $quotes.Count - 1
    $q = $quotes.Item($i)
    $prev = if ($i -ge 1) { $quotes.Item($i-1) } else { $null }
    $close = [double]$q.Close
    $prevClose = if ($null -ne $prev) { [double]$prev.Close } else { $close }
    $change = $close - $prevClose
    $changePct = if ($prevClose -ne 0) { ($change / $prevClose) * 100 } else { 0 }
    return [pscustomobject]@{
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
    }
}

function Get-Fundamentals($stock) {
    if ($null -eq $stock) { return $null }
    $fields = @('FullName','SharesOut','BookValuePerShare','DividendPerShare','EPS','ForwardEPS','PEGRatio','ProfitMargin','OperatingMargin','ROA','ROE','QtrlyRevenueGrowth','QtrlyEarningsGrowth')
    $out = [ordered]@{ symbol = [string]$stock.Ticker }
    foreach ($f in $fields) {
        try { $out[$f] = $stock.$f } catch { $out[$f] = $null }
    }
    return [pscustomobject]$out
}

function Get-Cached([string]$key, [scriptblock]$factory) {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    if ($script:Cache.ContainsKey($key) -and $script:CacheTime.ContainsKey($key)) {
        if (($now - [int64]$script:CacheTime[$key]) -lt $Config.CacheMs) { return $script:Cache[$key] }
    }
    $value = & $factory
    $script:Cache[$key] = $value
    $script:CacheTime[$key] = $now
    return $value
}

function Get-Diagnostics {
    $ab = Connect-AmiBroker
    return [pscustomobject]@{
        ok = $true
        connection_mode = $script:ConnectionMode
        configured_database = $Config.DatabasePath
        active_database = Get-DatabasePathSafe $ab
        load_database_result = $script:LoadDatabaseResult
        load_database_error = $script:LoadDatabaseError
        refresh_error = $script:RefreshError
        stocks_before_load = $script:StocksBeforeLoad
        stocks_after_load = $script:StocksAfterLoad
        current_stock_count = Get-StockCount $ab
    }
}

function Get-MarketOverview {
    return Get-Cached 'market-overview' {
        $indexes = @()
        foreach ($name in @('VN-INDEX','VN30','VN100','HNX-INDEX')) {
            $stock = Resolve-Symbol $Config.SymbolAliases[$name]
            $q = Get-LastQuote $stock
            if ($null -ne $q) {
                $indexes += [pscustomobject]@{
                    symbol = $name
                    source_symbol = $q.symbol
                    value = $q.close
                    change = $q.change
                    change_pct = $q.change_pct
                    volume = $q.volume
                    volume_m = if ($q.volume -gt 0) { $q.volume / 1000000 } else { 0 }
                    value_b = $null
                    adv = $null
                    flat = $null
                    dec = $null
                }
            }
        }
        [pscustomobject]@{
            ok = $true
            mode = 'realtime'
            updated_at = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
            diagnostics = Get-Diagnostics
            indexes = $indexes
        }
    }
}

function Get-StockPayload([string]$symbol) {
    $symbol = $symbol.Trim().ToUpperInvariant()
    return Get-Cached "stock:$symbol" {
        $stock = Get-StockSafe $symbol
        if ($null -eq $stock) {
            return [pscustomobject]@{
                ok=$false
                error='SYMBOL_NOT_FOUND'
                symbol=$symbol
                diagnostics=Get-Diagnostics
            }
        }
        [pscustomobject]@{
            ok = $true
            mode = 'realtime'
            updated_at = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
            quote = Get-LastQuote $stock
            fundamentals = Get-Fundamentals $stock
        }
    }
}

function Get-DebugStocks {
    $ab = Connect-AmiBroker
    $count = Get-StockCount $ab
    $symbols = @()
    $max = [Math]::Min($count, 30)
    for ($i = 0; $i -lt $max; $i++) {
        try {
            $s = $ab.Stocks.Item($i)
            if ($null -ne $s) { $symbols += [string]$s.Ticker }
        } catch {}
    }
    return [pscustomobject]@{
        ok = $true
        diagnostics = Get-Diagnostics
        sample_symbols = $symbols
    }
}

$listener = $null
try {
    $ab = Connect-AmiBroker
    Write-Host "AmiBroker ket noi: $($script:ConnectionMode)" -ForegroundColor Cyan
    Write-Host "Database cau hinh: $($Config.DatabasePath)" -ForegroundColor Cyan
    Write-Host "Database dang mo: $(Get-DatabasePathSafe $ab)" -ForegroundColor Cyan
    Write-Host "LoadDatabase result: $($script:LoadDatabaseResult)" -ForegroundColor Cyan
    if ($script:LoadDatabaseError) { Write-Host "LoadDatabase error: $($script:LoadDatabaseError)" -ForegroundColor Yellow }
    if ($script:RefreshError) { Write-Host "RefreshAll error: $($script:RefreshError)" -ForegroundColor Yellow }
    Write-Host "Stocks before: $($script:StocksBeforeLoad)" -ForegroundColor Cyan
    Write-Host "Stocks after:  $($script:StocksAfterLoad)" -ForegroundColor Cyan

    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add($Config.ListenPrefix)
    $listener.Start()
    Write-Host "AmiBridge dang chay: $($Config.ListenPrefix)" -ForegroundColor Green
    Write-Host "Health: http://127.0.0.1:8765/health" -ForegroundColor DarkGray
    Write-Host "Diag:   http://127.0.0.1:8765/debug/diagnostics" -ForegroundColor DarkGray
    Write-Host "Stocks: http://127.0.0.1:8765/debug/stocks" -ForegroundColor DarkGray
    Write-Host "Market: http://127.0.0.1:8765/market/overview" -ForegroundColor DarkGray
    Write-Host "Stock:  http://127.0.0.1:8765/stock/FPT" -ForegroundColor DarkGray
    Write-Host "Nhan Ctrl+C de dung." -ForegroundColor Yellow

    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        try {
            if ($ctx.Request.HttpMethod -eq 'OPTIONS') {
                $ctx.Response.AddHeader('Access-Control-Allow-Origin','*')
                $ctx.Response.AddHeader('Access-Control-Allow-Methods','GET,OPTIONS')
                $ctx.Response.StatusCode = 204
                $ctx.Response.Close()
                continue
            }
            if ($ctx.Request.HttpMethod -ne 'GET') {
                JsonResponse $ctx 405 @{ ok=$false; error='METHOD_NOT_ALLOWED' }
                continue
            }
            $path = $ctx.Request.Url.AbsolutePath
            if ($path -eq '/health') {
                JsonResponse $ctx 200 @{ ok=$true; service='vohoang-amibridge'; diagnostics=Get-Diagnostics; time=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss') }
            }
            elseif ($path -eq '/debug/diagnostics') {
                JsonResponse $ctx 200 (Get-Diagnostics)
            }
            elseif ($path -eq '/debug/stocks') {
                JsonResponse $ctx 200 (Get-DebugStocks)
            }
            elseif ($path -eq '/market/overview') {
                JsonResponse $ctx 200 (Get-MarketOverview)
            }
            elseif ($path -match '^/stock/([A-Za-z0-9._-]+)$') {
                $payload = Get-StockPayload $Matches[1]
                JsonResponse $ctx ($(if($payload.ok){200}else{404})) $payload
            }
            else {
                JsonResponse $ctx 404 @{ ok=$false; error='NOT_FOUND' }
            }
        }
        catch {
            JsonResponse $ctx 500 @{ ok=$false; error='BRIDGE_ERROR'; message=$_.Exception.Message }
        }
    }
}
catch {
    Write-Host "AmiBridge loi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if ($null -ne $listener) { try { $listener.Stop() } catch {} }
}
