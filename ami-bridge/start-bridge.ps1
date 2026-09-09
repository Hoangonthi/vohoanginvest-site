$ErrorActionPreference = 'Stop'

# VO HOANG AmiBridge V2.0
# Read-only bridge: D:\DataTick\eod MetaStock files -> local JSON HTTP API
# No AmiBroker COM dependency.

$Config = @{
    DataRoot = 'D:\DataTick\eod'
    ListenPrefix = 'http://127.0.0.1:8765/'
    CacheMs = 1500
    SymbolMapCacheMs = 300000
    MarketAliases = [ordered]@{
        'VN-INDEX' = @('VN-INDEX','VNINDEX','VNINDEX_INDEX')
        'VN30' = @('VN30','VN30-INDEX','VN30INDEX')
        'VN100' = @('VN100','VN100-INDEX','VN100INDEX')
        'HNX-INDEX' = @('HNX-INDEX','HNXINDEX','HNX-INDEX_INDEX')
    }
}

$script:Cache = @{}
$script:CacheTime = @{}
$script:SymbolMap = $null
$script:SymbolMapLoadedAt = 0

function JsonResponse($context, $statusCode, $obj) {
    $json = $obj | ConvertTo-Json -Depth 10 -Compress
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

function Read-AsciiTrim([byte[]]$bytes, [int]$offset, [int]$length) {
    if ($offset -lt 0 -or ($offset + $length) -gt $bytes.Length) { return '' }
    return ([System.Text.Encoding]::ASCII.GetString($bytes,$offset,$length)).Trim([char]0,' ')
}

function Convert-Mbf4ToSingle([byte[]]$b) {
    if ($b.Count -ne 4) { throw 'MBF value must contain 4 bytes' }
    if (($b[0] -bor $b[1] -bor $b[2] -bor $b[3]) -eq 0) { return 0.0 }
    [uint16]$man = [BitConverter]::ToUInt16($b,2)
    if ($man -eq 0) { return 0.0 }
    [int]$exp = ([int]($man -band 0xFF00)) - 0x0200
    [int]$m = ([int]($man -band 0x007F)) -bor (([int]$man -shl 8) -band 0x8000)
    $m = $m -bor ($exp -shr 1)
    $ieee = New-Object byte[] 4
    $ieee[0]=$b[0]; $ieee[1]=$b[1]
    $ieee[2]=[byte]($m -band 0xFF)
    $ieee[3]=[byte](($m -shr 8) -band 0xFF)
    return [BitConverter]::ToSingle($ieee,0)
}

function Convert-MsDate($value) {
    $n = [int][Math]::Round([double]$value)
    if ($n -le 0) { return '' }
    $yy=[int]($n/10000); $mm=[int](($n%10000)/100); $dd=[int]($n%100)
    $yyyy=1900+$yy
    if ($yyyy -lt 1950) { $yyyy += 100 }
    try { return (Get-Date -Year $yyyy -Month $mm -Day $dd -Hour 0 -Minute 0 -Second 0).ToString('yyyy-MM-dd') } catch { return "RAW:$n" }
}

function Get-NowMs { return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

function Get-Cached([string]$key,[scriptblock]$factory) {
    $now=Get-NowMs
    if ($script:Cache.ContainsKey($key) -and $script:CacheTime.ContainsKey($key)) {
        if (($now-[int64]$script:CacheTime[$key]) -lt $Config.CacheMs) { return $script:Cache[$key] }
    }
    $v=& $factory
    $script:Cache[$key]=$v; $script:CacheTime[$key]=$now
    return $v
}

function Load-SymbolMap {
    $now=Get-NowMs
    if ($null -ne $script:SymbolMap -and ($now-$script:SymbolMapLoadedAt) -lt $Config.SymbolMapCacheMs) { return $script:SymbolMap }
    $map=@{}
    $emaster=Join-Path $Config.DataRoot 'EMASTER'
    if (Test-Path $emaster) {
        [byte[]]$b=[IO.File]::ReadAllBytes($emaster)
        if ($b.Length -ge 192) {
            $total=[BitConverter]::ToUInt16($b,0)
            $max=[Math]::Floor(($b.Length-192)/192)
            $n=[Math]::Min([int]$total,[int]$max)
            if ($n -le 0) { $n=[int]$max }
            for ($i=0;$i -lt $n;$i++) {
                $o=192+($i*192)
                $fileNo=[int]$b[$o+2]
                $fields=[int]$b[$o+6]
                $symbol=(Read-AsciiTrim $b ($o+11) 14).ToUpperInvariant()
                $desc=Read-AsciiTrim $b ($o+32) 16
                $period=Read-AsciiTrim $b ($o+60) 1
                if ($symbol) {
                    $path=Join-Path $Config.DataRoot ("F{0}.DAT" -f $fileNo)
                    $map[$symbol]=[pscustomobject]@{ symbol=$symbol; description=$desc; file_number=$fileNo; fields=$fields; period=$period; format='DAT'; data_file=$path; exists=(Test-Path $path) }
                }
            }
        }
    }
    $script:SymbolMap=$map; $script:SymbolMapLoadedAt=$now
    return $map
}

function Resolve-Symbol([string[]]$aliases) {
    $map=Load-SymbolMap
    foreach ($a in $aliases) {
        $k=$a.Trim().ToUpperInvariant()
        if ($map.ContainsKey($k)) { return $map[$k] }
    }
    return $null
}

function Read-DatRecord([byte[]]$bytes,[int]$offset,[int]$fields,[int]$recordIndex) {
    $vals=@()
    for ($f=0;$f -lt $fields;$f++) {
        $chunk=New-Object byte[] 4
        [Array]::Copy($bytes,$offset+($f*4),$chunk,0,4)
        $vals += Convert-Mbf4ToSingle $chunk
    }
    return [pscustomobject]@{
        record=$recordIndex
        raw_date=$vals[0]
        date=Convert-MsDate $vals[0]
        open=if($fields -gt 1){[double]$vals[1]}else{$null}
        high=if($fields -gt 2){[double]$vals[2]}else{$null}
        low=if($fields -gt 3){[double]$vals[3]}else{$null}
        close=if($fields -gt 4){[double]$vals[4]}else{$null}
        volume=if($fields -gt 5){[double]$vals[5]}else{$null}
        open_interest=if($fields -gt 6){[double]$vals[6]}else{$null}
    }
}

function Get-DatQuote($entry) {
    if ($null -eq $entry -or -not $entry.exists) { return $null }
    $fields=[int]$entry.fields
    if ($fields -lt 5) { throw "Unsupported DAT field count: $fields" }
    $recordSize=$fields*4
    [byte[]]$bytes=[IO.File]::ReadAllBytes($entry.data_file)
    if ($bytes.Length -lt ($recordSize*2)) { return $null }
    $headerSize=$recordSize
    $count=[int](($bytes.Length-$headerSize)/$recordSize)
    if ($count -lt 1) { return $null }
    $lastIndex=$count-1
    $last=Read-DatRecord $bytes ($headerSize+($lastIndex*$recordSize)) $fields $lastIndex
    $prev=$null
    if ($count -gt 1) { $prev=Read-DatRecord $bytes ($headerSize+(($lastIndex-1)*$recordSize)) $fields ($lastIndex-1) }
    $prevClose=if($null -ne $prev){[double]$prev.close}else{[double]$last.close}
    $change=[double]$last.close-$prevClose
    $pct=if($prevClose -ne 0){($change/$prevClose)*100}else{0}
    return [pscustomobject]@{
        symbol=$entry.symbol
        description=$entry.description
        date=$last.date
        open=$last.open
        high=$last.high
        low=$last.low
        close=$last.close
        prev_close=$prevClose
        change=$change
        change_pct=$pct
        volume=$last.volume
        source_file=$entry.data_file
        source_updated_at=(Get-Item $entry.data_file).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
    }
}

function Get-StockPayload([string]$symbol) {
    $symbol=$symbol.Trim().ToUpperInvariant()
    return Get-Cached "stock:$symbol" {
        $entry=Resolve-Symbol @($symbol)
        if ($null -eq $entry) { return [pscustomobject]@{ ok=$false; error='SYMBOL_NOT_FOUND_IN_EMASTER'; symbol=$symbol; source='metastock-direct' } }
        $q=Get-DatQuote $entry
        if ($null -eq $q) { return [pscustomobject]@{ ok=$false; error='QUOTE_NOT_AVAILABLE'; symbol=$symbol; map=$entry } }
        return [pscustomobject]@{ ok=$true; mode='direct-file'; updated_at=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss'); quote=$q; fundamentals=$null }
    }
}

function Get-MarketOverview {
    return Get-Cached 'market-overview' {
        $indexes=@()
        foreach ($name in $Config.MarketAliases.Keys) {
            $entry=Resolve-Symbol $Config.MarketAliases[$name]
            if ($null -ne $entry) {
                $q=Get-DatQuote $entry
                if ($null -ne $q) {
                    $indexes += [pscustomobject]@{ symbol=$name; source_symbol=$q.symbol; value=$q.close; change=$q.change; change_pct=$q.change_pct; volume=$q.volume; volume_m=if($q.volume -gt 0){$q.volume/1000000}else{0}; value_b=$null; adv=$null; flat=$null; dec=$null; date=$q.date; source_updated_at=$q.source_updated_at }
                }
            }
        }
        return [pscustomobject]@{ ok=$true; mode='direct-file'; updated_at=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss'); source_root=$Config.DataRoot; indexes=$indexes }
    }
}

function Get-Diagnostics {
    $map=Load-SymbolMap
    $emaster=Join-Path $Config.DataRoot 'EMASTER'
    return [pscustomobject]@{
        ok=$true
        version='2.0'
        source='metastock-direct'
        data_root=$Config.DataRoot
        data_root_exists=(Test-Path $Config.DataRoot)
        emaster_exists=(Test-Path $emaster)
        emaster_updated_at=if(Test-Path $emaster){(Get-Item $emaster).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')}else{$null}
        emaster_symbol_count=$map.Count
        fpt_mapped=$map.ContainsKey('FPT')
        fpt_file=if($map.ContainsKey('FPT')){$map['FPT'].data_file}else{$null}
    }
}

$listener=$null
try {
    $diag=Get-Diagnostics
    Write-Host 'VO HOANG AmiBridge V2.0 - MetaStock direct reader' -ForegroundColor Cyan
    Write-Host "Data root: $($Config.DataRoot)" -ForegroundColor Cyan
    Write-Host "EMASTER symbols: $($diag.emaster_symbol_count)" -ForegroundColor Cyan
    Write-Host "FPT mapped: $($diag.fpt_mapped) -> $($diag.fpt_file)" -ForegroundColor Cyan
    $fpt=Get-StockPayload 'FPT'
    if ($fpt.ok) { Write-Host ("FPT latest: {0} close={1} volume={2}" -f $fpt.quote.date,$fpt.quote.close,$fpt.quote.volume) -ForegroundColor Green }

    $listener=[System.Net.HttpListener]::new()
    $listener.Prefixes.Add($Config.ListenPrefix)
    $listener.Start()
    Write-Host "AmiBridge dang chay: $($Config.ListenPrefix)" -ForegroundColor Green
    Write-Host 'Health: http://127.0.0.1:8765/health' -ForegroundColor DarkGray
    Write-Host 'Diag:   http://127.0.0.1:8765/debug/diagnostics' -ForegroundColor DarkGray
    Write-Host 'Market: http://127.0.0.1:8765/market/overview' -ForegroundColor DarkGray
    Write-Host 'Stock:  http://127.0.0.1:8765/stock/FPT' -ForegroundColor DarkGray
    Write-Host 'Dong cua so nay de dung Bridge.' -ForegroundColor Yellow

    while ($listener.IsListening) {
        $ctx=$listener.GetContext()
        try {
            if ($ctx.Request.HttpMethod -eq 'OPTIONS') { $ctx.Response.AddHeader('Access-Control-Allow-Origin','*'); $ctx.Response.AddHeader('Access-Control-Allow-Methods','GET,OPTIONS'); $ctx.Response.StatusCode=204; $ctx.Response.Close(); continue }
            if ($ctx.Request.HttpMethod -ne 'GET') { JsonResponse $ctx 405 @{ok=$false;error='METHOD_NOT_ALLOWED'}; continue }
            $path=$ctx.Request.Url.AbsolutePath
            if ($path -eq '/health') { JsonResponse $ctx 200 @{ok=$true;service='vohoang-amibridge';version='2.0';source='metastock-direct';time=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')} }
            elseif ($path -eq '/debug/diagnostics') { JsonResponse $ctx 200 (Get-Diagnostics) }
            elseif ($path -eq '/market/overview') { JsonResponse $ctx 200 (Get-MarketOverview) }
            elseif ($path -match '^/stock/([A-Za-z0-9._-]+)$') { $payload=Get-StockPayload $Matches[1]; JsonResponse $ctx ($(if($payload.ok){200}else{404})) $payload }
            else { JsonResponse $ctx 404 @{ok=$false;error='NOT_FOUND'} }
        } catch { try { JsonResponse $ctx 500 @{ok=$false;error='BRIDGE_ERROR';message=$_.Exception.Message} } catch {} }
    }
} catch {
    Write-Host "AmiBridge loi: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($null -ne $listener) { try { $listener.Stop() } catch {} }
}
