$ErrorActionPreference = 'Stop'

# VO HOANG AmiBridge V2.2
# Read-only bridge: D:\DataTick\eod MetaStock files -> local JSON HTTP API
# Supports legacy EMASTER/DAT and XMASTER/MWD.

$Config = @{
    DataRoot = 'D:\DataTick\eod'
    ListenPrefix = 'http://127.0.0.1:8765/'
    CacheMs = 1500
    SymbolMapCacheMs = 300000
    MarketAliases = [ordered]@{
        'VN-INDEX'    = @('VNINDEX','VN-INDEX','VNINDEX_INDEX')
        'VN30'        = @('VN30','VN30-INDEX','VN30INDEX')
        'VN100'       = @('VN100','VN100-INDEX','VN100INDEX')
        'VNXALL'      = @('VNXALL','VNX-ALL')
        'VNMidcap'    = @('VNMIDCAP','VN-MIDCAP')
        'VNSmallcap'  = @('VNSML','VNSMALLCAP','VN-SMALLCAP')
        'VNFIN LEAD'  = @('VNFINLEAD','VNFIN-LEAD')
        'VNFIN'       = @('VNFIN','VN-FIN')
        'VNREAL'      = @('VNREAL','VN-REAL')
        'VNIND'       = @('VNIND','VN-IND')
        'VNIT'        = @('VNIT','VN-IT')
        'VNMAT'       = @('VNMAT','VN-MAT')
        'VNCONS'      = @('VNCONS','VN-CONS')
        'VNCOND'      = @('VNCOND','VN-COND')
        'VNENE'       = @('VNENE','VN-ENE')
        'VNHEAL'      = @('VNHEAL','VN-HEAL')
        'VNUTI'       = @('VNUTI','VN-UTI')
        'HNX-INDEX'   = @('HNXINDEX','HNX-INDEX','HNX-INDEX_INDEX')
        'UPCOM-INDEX' = @('UPCOMINDEX','UPCOM-INDEX')
    }
}

$script:Cache=@{}
$script:CacheTime=@{}
$script:SymbolMap=$null
$script:SymbolMapLoadedAt=0

function JsonResponse($context,$statusCode,$obj){
    $json=$obj|ConvertTo-Json -Depth 10 -Compress
    $bytes=[Text.Encoding]::UTF8.GetBytes($json)
    $r=$context.Response
    $r.StatusCode=$statusCode
    $r.ContentType='application/json; charset=utf-8'
    $r.ContentEncoding=[Text.Encoding]::UTF8
    $r.AddHeader('Cache-Control','no-store')
    $r.AddHeader('Access-Control-Allow-Origin','*')
    $r.AddHeader('Access-Control-Allow-Methods','GET,OPTIONS')
    $r.OutputStream.Write($bytes,0,$bytes.Length)
    $r.Close()
}

function Read-AsciiZ([byte[]]$bytes,[int]$offset,[int]$length){
    if($offset -lt 0 -or ($offset+$length) -gt $bytes.Length){return ''}
    $slice=New-Object byte[] $length
    [Array]::Copy($bytes,$offset,$slice,0,$length)
    $zero=[Array]::IndexOf($slice,[byte]0)
    if($zero -ge 0){$length=$zero}
    if($length -le 0){return ''}
    return ([Text.Encoding]::ASCII.GetString($slice,0,$length)).Trim()
}

function Convert-Mbf4ToSingle([byte[]]$b){
    if(($b[0]-bor$b[1]-bor$b[2]-bor$b[3])-eq 0){return 0.0}
    [uint16]$man=[BitConverter]::ToUInt16($b,2)
    if($man -eq 0){return 0.0}
    [int]$exp=([int]($man-band 0xFF00))-0x0200
    [int]$m=([int]($man-band 0x007F))-bor(([int]$man-shl 8)-band 0x8000)
    $m=$m-bor($exp-shr 1)
    $ieee=New-Object byte[] 4
    $ieee[0]=$b[0];$ieee[1]=$b[1];$ieee[2]=[byte]($m-band 0xFF);$ieee[3]=[byte](($m-shr 8)-band 0xFF)
    return [BitConverter]::ToSingle($ieee,0)
}

function Convert-MsDate($value){
    $n=[int][Math]::Round([double]$value)
    if($n-le 0){return ''}
    $yy=[int]($n/10000);$mm=[int](($n%10000)/100);$dd=[int]($n%100)
    $yyyy=1900+$yy;if($yyyy-lt 1950){$yyyy+=100}
    try{return (Get-Date -Year $yyyy -Month $mm -Day $dd -Hour 0 -Minute 0 -Second 0).ToString('yyyy-MM-dd')}catch{return "RAW:$n"}
}

function Get-NowMs{return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()}
function Get-Cached([string]$key,[scriptblock]$factory){
    $now=Get-NowMs
    if($script:Cache.ContainsKey($key)-and$script:CacheTime.ContainsKey($key)){
        if(($now-[int64]$script:CacheTime[$key]) -lt $Config.CacheMs){return $script:Cache[$key]}
    }
    $v=&$factory;$script:Cache[$key]=$v;$script:CacheTime[$key]=$now;return $v
}

function Load-SymbolMap{
    $now=Get-NowMs
    if($null-ne$script:SymbolMap -and ($now-$script:SymbolMapLoadedAt)-lt$Config.SymbolMapCacheMs){return $script:SymbolMap}
    $map=@{}

    $emaster=Join-Path $Config.DataRoot 'EMASTER'
    if(Test-Path $emaster){
        [byte[]]$b=[IO.File]::ReadAllBytes($emaster)
        if($b.Length-ge 192){
            $total=[BitConverter]::ToUInt16($b,0);$max=[Math]::Floor(($b.Length-192)/192);$n=[Math]::Min([int]$total,[int]$max);if($n-le 0){$n=[int]$max}
            for($i=0;$i-lt$n;$i++){
                $o=192+($i*192);$fileNo=[int]$b[$o+2];$fields=[int]$b[$o+6]
                $symbol=(Read-AsciiZ $b ($o+11) 14).ToUpperInvariant();$desc=Read-AsciiZ $b ($o+32) 16;$period=Read-AsciiZ $b ($o+60) 1
                if($symbol){$path=Join-Path $Config.DataRoot ("F{0}.DAT"-f$fileNo);$map[$symbol]=[pscustomobject]@{symbol=$symbol;description=$desc;file_number=$fileNo;fields=$fields;period=$period;format='DAT';data_file=$path;exists=(Test-Path $path)}}
            }
        }
    }

    $xmaster=Join-Path $Config.DataRoot 'XMASTER'
    if(Test-Path $xmaster){
        [byte[]]$x=[IO.File]::ReadAllBytes($xmaster)
        if($x.Length-ge 150){
            $total=[BitConverter]::ToUInt16($x,10);$max=[Math]::Floor(($x.Length-150)/150);$n=[Math]::Min([int]$total,[int]$max);if($n-le 0){$n=[int]$max}
            for($i=0;$i-lt$n;$i++){
                $o=150+($i*150);$symbol=(Read-AsciiZ $x ($o+1) 15).ToUpperInvariant();$desc=Read-AsciiZ $x ($o+16) 46;$period=Read-AsciiZ $x ($o+62) 1;$fileNo=[BitConverter]::ToUInt16($x,$o+65)
                if($symbol){$path=Join-Path $Config.DataRoot ("F{0}.MWD"-f$fileNo);$map[$symbol]=[pscustomobject]@{symbol=$symbol;description=$desc;file_number=$fileNo;fields=7;period=$period;format='MWD';data_file=$path;exists=(Test-Path $path)}}
            }
        }
    }

    $script:SymbolMap=$map;$script:SymbolMapLoadedAt=$now;return $map
}

function Resolve-Symbol([string[]]$aliases){$map=Load-SymbolMap;foreach($a in $aliases){$k=$a.Trim().ToUpperInvariant();if($map.ContainsKey($k)){return $map[$k]}};return $null}

function Read-Record([byte[]]$bytes,[int]$offset,[int]$fields,[int]$recordIndex){
    $vals=@();for($f=0;$f-lt$fields;$f++){$chunk=New-Object byte[] 4;[Array]::Copy($bytes,$offset+($f*4),$chunk,0,4);$vals+=Convert-Mbf4ToSingle $chunk}
    return [pscustomobject]@{record=$recordIndex;date=Convert-MsDate $vals[0];open=[double]$vals[1];high=[double]$vals[2];low=[double]$vals[3];close=[double]$vals[4];volume=if($fields-gt 5){[double]$vals[5]}else{0};open_interest=if($fields-gt 6){[double]$vals[6]}else{0}}
}

function Get-Quote($entry){
    if($null-eq$entry -or -not$entry.exists){return $null}
    $fields=[int]$entry.fields;if($fields-lt 5){$fields=7};$recordSize=$fields*4
    [byte[]]$bytes=[IO.File]::ReadAllBytes($entry.data_file);if($bytes.Length-lt($recordSize*2)){return $null}
    $headerSize=$recordSize
    $countFromHeader=if($bytes.Length-ge 4){[BitConverter]::ToUInt16($bytes,2)}else{0}
    $countByLength=[int](($bytes.Length-$headerSize)/$recordSize)
    $count=if($countFromHeader-gt 1 -and ($countFromHeader-1)-le$countByLength){$countFromHeader-1}else{$countByLength}
    if($count-lt 1){return $null}
    $lastIndex=$count-1;$last=Read-Record $bytes ($headerSize+($lastIndex*$recordSize)) $fields $lastIndex
    $prev=if($count-gt 1){Read-Record $bytes ($headerSize+(($lastIndex-1)*$recordSize)) $fields ($lastIndex-1)}else{$last}
    $prevClose=[double]$prev.close;$change=[double]$last.close-$prevClose;$pct=if($prevClose-ne 0){($change/$prevClose)*100}else{0}
    return [pscustomobject]@{symbol=$entry.symbol;description=$entry.description;date=$last.date;open=[Math]::Round($last.open,4);high=[Math]::Round($last.high,4);low=[Math]::Round($last.low,4);close=[Math]::Round($last.close,4);prev_close=[Math]::Round($prevClose,4);change=[Math]::Round($change,4);change_pct=[Math]::Round($pct,4);volume=[Math]::Round($last.volume,0);source_file=$entry.data_file;source_format=$entry.format;source_updated_at=(Get-Item $entry.data_file).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')}
}

function Get-StockPayload([string]$symbol){
    $symbol=$symbol.Trim().ToUpperInvariant();return Get-Cached "stock:$symbol" {
        $entry=Resolve-Symbol @($symbol);if($null-eq$entry){return [pscustomobject]@{ok=$false;error='SYMBOL_NOT_FOUND';symbol=$symbol;source='metastock-direct'}}
        $q=Get-Quote $entry;if($null-eq$q){return [pscustomobject]@{ok=$false;error='QUOTE_NOT_AVAILABLE';symbol=$symbol}}
        return [pscustomobject]@{ok=$true;mode='direct-file';updated_at=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');quote=$q;fundamentals=$null}
    }
}

function Get-MarketOverview{
    return Get-Cached 'market-overview' {
        $indexes=@();foreach($name in $Config.MarketAliases.Keys){$entry=Resolve-Symbol $Config.MarketAliases[$name];if($null-ne$entry){$q=Get-Quote $entry;if($null-ne$q){$indexes+=[pscustomobject]@{symbol=$name;source_symbol=$q.symbol;value=$q.close;change=$q.change;change_pct=$q.change_pct;volume=$q.volume;volume_m=if($q.volume-gt 0){[Math]::Round($q.volume/1000000,3)}else{0};value_b=$null;adv=$null;flat=$null;dec=$null;date=$q.date;source_updated_at=$q.source_updated_at}}}}
        return [pscustomobject]@{ok=$true;mode='direct-file';updated_at=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');source_root=$Config.DataRoot;indexes=$indexes}
    }
}

function Get-Diagnostics{$map=Load-SymbolMap;return [pscustomobject]@{ok=$true;version='2.2';source='metastock-direct';data_root=$Config.DataRoot;symbol_count=$map.Count;has_vnindex=$map.ContainsKey('VNINDEX');has_vn30=$map.ContainsKey('VN30');has_hnxindex=$map.ContainsKey('HNXINDEX');has_upcomindex=$map.ContainsKey('UPCOMINDEX');fpt_mapped=$map.ContainsKey('FPT')}}

$listener=$null
try{
    $diag=Get-Diagnostics
    Write-Host 'VO HOANG AmiBridge V2.2 - MetaStock DAT/MWD direct reader' -ForegroundColor Cyan
    Write-Host "Data root: $($Config.DataRoot)" -ForegroundColor Cyan
    Write-Host "Symbols: $($diag.symbol_count) | VNINDEX=$($diag.has_vnindex) VN30=$($diag.has_vn30) HNX=$($diag.has_hnxindex) UPCOM=$($diag.has_upcomindex)" -ForegroundColor Cyan
    $listener=[Net.HttpListener]::new();$listener.Prefixes.Add($Config.ListenPrefix);$listener.Start()
    Write-Host "AmiBridge dang chay: $($Config.ListenPrefix)" -ForegroundColor Green
    Write-Host 'Market: http://127.0.0.1:8765/market/overview' -ForegroundColor DarkGray
    Write-Host 'Stock:  http://127.0.0.1:8765/stock/FPT' -ForegroundColor DarkGray
    while($listener.IsListening){$ctx=$listener.GetContext();try{$path=$ctx.Request.Url.AbsolutePath;if($ctx.Request.HttpMethod-eq'OPTIONS'){$ctx.Response.AddHeader('Access-Control-Allow-Origin','*');$ctx.Response.StatusCode=204;$ctx.Response.Close();continue};if($path-eq'/health'){JsonResponse $ctx 200 @{ok=$true;service='vohoang-amibridge';version='2.2';time=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')}}elseif($path-eq'/debug/diagnostics'){JsonResponse $ctx 200 (Get-Diagnostics)}elseif($path-eq'/market/overview'){JsonResponse $ctx 200 (Get-MarketOverview)}elseif($path-match'^/stock/([A-Za-z0-9._-]+)$'){$p=Get-StockPayload $Matches[1];JsonResponse $ctx ($(if($p.ok){200}else{404})) $p}else{JsonResponse $ctx 404 @{ok=$false;error='NOT_FOUND'}}}catch{try{JsonResponse $ctx 500 @{ok=$false;error='BRIDGE_ERROR';message=$_.Exception.Message}}catch{}}}
}catch{Write-Host "AmiBridge loi: $($_.Exception.Message)" -ForegroundColor Red;exit 1}finally{if($null-ne$listener){try{$listener.Stop()}catch{}}}
