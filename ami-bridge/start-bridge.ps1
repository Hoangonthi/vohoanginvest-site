$ErrorActionPreference = 'Stop'

# VO HOANG AmiBridge V1.1
# Local read-only bridge: AmiBroker COM -> JSON HTTP API
# Prefer the AmiBroker instance already opened by the user so plugin/database state is preserved.

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

    # First attach to the AmiBroker window the user already has open.
    try {
        $active = [Runtime.InteropServices.Marshal]::GetActiveObject('Broker.Application')
        if ($null -ne $active) {
            $script:AB = $active
            $script:ConnectionMode = 'active-instance'
        }
    } catch {}

    # Fallback: create an automation instance.
    if ($null -eq $script:AB) {
        $script:AB = New-Object -ComObject 'Broker.Application'
        $script:ConnectionMode = 'new-com-instance'
    }

    # Only force-load the configured DB when the attached instance has no symbols.
    $count = Get-StockCount $script:AB
    if ($count -lt 1) {
        try {
            [void]$script:AB.LoadDatabase($Config.DatabasePath)
            Start-Sleep -Milliseconds 500
            try { [void]$script:AB.RefreshAll() } catch {}
            Start-Sleep -Milliseconds 500
        } catch {
            Write-Host "Khong the nap database $($Config.DatabasePath): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

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
            configured_database = $Config.DatabasePath
            active_database = Get-DatabasePathSafe (Connect-AmiBroker)
            connection_mode = $script:ConnectionMode
            stock_count = Get-StockCount (Connect-AmiBroker)
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
                stock_count=Get-StockCount (Connect-AmiBroker)
                connection_mode=$script:ConnectionMode
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
        connection_mode = $script:ConnectionMode
        configured_database = $Config.DatabasePath
        active_database = Get-DatabasePathSafe $ab
        stock_count = $count
        sample_symbols = $symbols
    }
}

$listener = $null
try {
    $ab = Connect-AmiBroker
    $db = Get-DatabasePathSafe $ab
    $count = Get-StockCount $ab
    Write-Host "AmiBroker ket noi: $($script:ConnectionMode)" -ForegroundColor Cyan
    Write-Host "Database dang mo: $db" -ForegroundColor Cyan
    Write-Host "So ma AmiBroker thay: $count" -ForegroundColor Cyan

    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add($Config.ListenPrefix)
    $listener.Start()
    Write-Host "AmiBridge dang chay: $($Config.ListenPrefix)" -ForegroundColor Green
    Write-Host "Health: http://127.0.0.1:8765/health" -ForegroundColor DarkGray
    Write-Host "Debug:  http://127.0.0.1:8765/debug/stocks" -ForegroundColor DarkGray
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
                $abNow = Connect-AmiBroker
                JsonResponse $ctx 200 @{
                    ok=$true
                    service='vohoang-amibridge'
                    connection_mode=$script:ConnectionMode
                    configured_database=$Config.DatabasePath
                    active_database=Get-DatabasePathSafe $abNow
                    stock_count=Get-StockCount $abNow
                    time=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
                }
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
