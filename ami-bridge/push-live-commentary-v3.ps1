$ErrorActionPreference = 'Continue'

# VÕ HOÀNG - LIVE MARKET COMMENTARY BRIDGE V3 / LOCAL WORLD MODEL
# AFL = kỹ thuật VN-Index. Watch Lists AmiBroker = nhóm/cổ phiếu.
# Máy local giữ raw 15 giây + memory 5/15/30 phút. Cloud chỉ nhận trạng thái gọn.

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$SnapshotCsv = 'C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv'
$StockBaseUrl = 'http://127.0.0.1:8765/stock'
$BridgeHealthUrl = 'http://127.0.0.1:8765/health'
$MarketContextUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-feed'
$RelayUrl = 'https://elmrbnewlukxscbcfizg.supabase.co/functions/v1/market-live-ingest'
$IntervalSeconds = 15
$ContextRefreshSeconds = 45
$SectorRefreshSeconds = 45
$TechnicalFreshSeconds = 60
$LocalRetentionDays = 45
$LocalRoot = Join-Path $PSScriptRoot 'live-data'

$WatchListCandidates = @(
    'D:\AmiBroker\eod\WatchLists',
    'D:\AmiBroker\WatchLists',
    'C:\AmiBroker\eod\WatchLists',
    'C:\AmiBroker\WatchLists'
)

$SectorNameMap = [ordered]@{
    'BATDONGSAN'='Bất động sản'; 'BAOHIEM'='Bảo hiểm'; 'CAOSU'='Cao su'; 'CANGBIEN'='Cảng biển';
    'CHUNGKHOAN'='Chứng khoán'; 'CONGNGHEVIENTHONG'='Công nghệ viễn thông'; 'DICHVUCONGICH'='Dịch vụ công ích';
    'GIAODUC'='Giáo dục'; 'HANGKHONG'='Hàng không'; 'KHOANGSAN'='Khoáng sản'; 'NANGLUONGDIENKHI'='Năng lượng điện khí';
    'NGANHANG'='Ngân hàng'; 'THEP'='Thép'; 'DAUKHI'='Dầu khí'; 'PHANBON'='Phân bón'; 'THUCPHAM'='Thực phẩm';
    'THUONGMAI'='Thương mại'; 'THUYSAN'='Thủy sản'; 'VATLIEUXAYDUNG'='Vật liệu xây dựng'; 'XAYDUNG'='Xây dựng';
    'DAUTUPHATTRIEN'='Đầu tư phát triển'
}

$BridgeKey = [Environment]::GetEnvironmentVariable('VH_BRIDGE_KEY','User')
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { $BridgeKey = $env:VH_BRIDGE_KEY }
if ([string]::IsNullOrWhiteSpace($BridgeKey)) { Write-Host 'THIEU VH_BRIDGE_KEY.' -ForegroundColor Red; exit 3 }

$script:LastCsvWriteUtc=[DateTime]::MinValue
$script:LastContextAtUtc=[DateTime]::MinValue
$script:LastSectorAtUtc=[DateTime]::MinValue
$script:MarketContext=$null
$script:LastTechnical=$null
$script:SectorSnapshot=@()
$script:StockSnapshot=@{}
$script:WatchListRoot=$null
$script:Memory = New-Object System.Collections.ArrayList

function Get-VnNow { return [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'SE Asia Standard Time') }
function Is-TradingWindow {
    $now=Get-VnNow
    if($now.DayOfWeek -in @([DayOfWeek]::Saturday,[DayOfWeek]::Sunday)){return $false}
    $m=$now.Hour*60+$now.Minute
    return (($m -ge 525 -and $m -le 691) -or ($m -ge 780 -and $m -le 901))
}
function Convert-LiveNum($value){
    if($null -eq $value){return $null}; $s=([string]$value).Trim(); if(!$s){return $null}; $x=0.0
    if([double]::TryParse($s,[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$x)){return $x}
    if([double]::TryParse($s,[ref]$x)){return $x}; return $null
}
function Remove-Diacritics([string]$text){
    if([string]::IsNullOrWhiteSpace($text)){return ''}
    $s=$text.Replace('Đ','D').Replace('đ','d').Normalize([Text.NormalizationForm]::FormD)
    $sb=New-Object Text.StringBuilder
    foreach($ch in $s.ToCharArray()){
        if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark){[void]$sb.Append($ch)}
    }
    return $sb.ToString().Normalize([Text.NormalizationForm]::FormC)
}
function Normalize-WatchName([string]$name){ return ((Remove-Diacritics $name).ToUpperInvariant() -replace '[^A-Z0-9]','') }
function Resolve-WatchListRoot {
    $best=$null; $bestCount=-1
    foreach($p in $WatchListCandidates){
        if(-not(Test-Path -LiteralPath $p)){continue}
        $c=@(Get-ChildItem -LiteralPath $p -Filter '*.tls' -File -ErrorAction SilentlyContinue).Count
        if($c -gt $bestCount){$best=$p;$bestCount=$c}
    }
    return $best
}
function Read-WatchListFile([string]$path){
    if(-not(Test-Path -LiteralPath $path)){return @()}
    return @(Get-Content -LiteralPath $path -ErrorAction SilentlyContinue | ForEach-Object{$_.Trim().ToUpperInvariant()} | Where-Object{$_ -match '^[A-Z0-9._-]+$'} | Select-Object -Unique)
}
function Get-SectorWatchLists {
    $root=$script:WatchListRoot; if(!$root){return @()}; $rows=@()
    foreach($file in @(Get-ChildItem -LiteralPath $root -Filter '*.tls' -File -ErrorAction SilentlyContinue)){
        $key=Normalize-WatchName([IO.Path]::GetFileNameWithoutExtension($file.Name)); if(-not $SectorNameMap.Contains($key)){continue}
        $symbols=Read-WatchListFile $file.FullName; if($symbols.Count -lt 1){continue}
        $rows += [pscustomobject]@{key=$key;name=$SectorNameMap[$key];file=$file.Name;symbols=@($symbols)}
    }
    return @($rows)
}
function Test-LocalBridge { try{$r=Invoke-RestMethod -UseBasicParsing -Uri $BridgeHealthUrl -TimeoutSec 2; return [bool]$r.ok}catch{return $false} }
function Get-StockQuote([string]$symbol,[string]$today){
    try{
        $p=Invoke-RestMethod -UseBasicParsing -Uri ($StockBaseUrl+'/'+[Uri]::EscapeDataString($symbol)) -TimeoutSec 2
        if(-not $p.ok -or $null -eq $p.quote -or [string]$p.quote.date -ne $today){return $null}
        $pct=Convert-LiveNum $p.quote.change_pct; if($null -eq $pct){return $null}
        return [pscustomobject]@{symbol=$symbol;price=Convert-LiveNum $p.quote.close;change=Convert-LiveNum $p.quote.change;change_pct=[Math]::Round([double]$pct,3);volume=Convert-LiveNum $p.quote.volume;date=[string]$p.quote.date;source_updated_at=[string]$p.quote.source_updated_at}
    }catch{return $null}
}
function Refresh-SectorSnapshot {
    $nowUtc=[DateTime]::UtcNow
    if($script:SectorSnapshot.Count -gt 0 -and ($nowUtc-$script:LastSectorAtUtc).TotalSeconds -lt $SectorRefreshSeconds){return}
    if(-not(Test-LocalBridge)){Write-Host ('[{0}] Watch Lists: AmiBridge local chua san sang.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkYellow;return}
    $groups=@(Get-SectorWatchLists)
    if($groups.Count -lt 1){Write-Host ('[{0}] Watch Lists: khong match duoc nhom nganh tai {1}' -f (Get-Date -Format 'HH:mm:ss'),$script:WatchListRoot) -ForegroundColor Yellow;return}
    $allSymbols=@($groups|ForEach-Object{$_.symbols}|Select-Object -Unique);$today=(Get-VnNow).ToString('yyyy-MM-dd');$quotes=@{}
    foreach($symbol in $allSymbols){$q=Get-StockQuote $symbol $today;if($null -ne $q){$quotes[$symbol]=$q}}
    $sectorRows=@()
    foreach($g in $groups){
        $valid=@();foreach($symbol in $g.symbols){if($quotes.ContainsKey($symbol)){$valid+=$quotes[$symbol]}}
        if($valid.Count -lt 1){continue}
        $adv=@($valid|Where-Object{[double]$_.change_pct -gt .001}).Count;$dec=@($valid|Where-Object{[double]$_.change_pct -lt -.001}).Count;$flat=$valid.Count-$adv-$dec
        $avg=($valid|Measure-Object -Property change_pct -Average).Average;$sorted=@($valid|Sort-Object change_pct -Descending)
        $coverage=if($g.symbols.Count){$valid.Count/[double]$g.symbols.Count}else{0}
        $sectorRows += [pscustomobject]@{key=$g.key;name=$g.name;watchlist_file=$g.file;member_count=$g.symbols.Count;valid_count=$valid.Count;coverage=[Math]::Round($coverage,3);adv=$adv;flat=$flat;dec=$dec;breadth_balance=[Math]::Round(($adv-$dec)/[double]$valid.Count,3);change_pct=[Math]::Round([double]$avg,3);top_gainers=@($sorted|Where-Object{[double]$_.change_pct -gt 0}|Select-Object -First 3);top_losers=@($sorted|Where-Object{[double]$_.change_pct -lt 0}|Sort-Object change_pct|Select-Object -First 3)}
    }
    $script:StockSnapshot=$quotes;$script:SectorSnapshot=@($sectorRows|Sort-Object change_pct -Descending);$script:LastSectorAtUtc=$nowUtc
    $topText=@($script:SectorSnapshot|Select-Object -First 3|ForEach-Object{'{0} {1:+0.00;-0.00;0.00}%' -f $_.name,[double]$_.change_pct}) -join ' | '
    Write-Host ('[{0}] Watch Lists: {1} nhom, {2}/{3} ma co du lieu. {4}' -f (Get-Date -Format 'HH:mm:ss'),$script:SectorSnapshot.Count,$quotes.Count,$allSymbols.Count,$topText) -ForegroundColor DarkCyan
}
function Refresh-MarketContext {
    $nowUtc=[DateTime]::UtcNow;if($null -ne $script:MarketContext -and ($nowUtc-$script:LastContextAtUtc).TotalSeconds -lt $ContextRefreshSeconds){return}
    try{$ctx=Invoke-RestMethod -UseBasicParsing -Uri $MarketContextUrl -TimeoutSec 8;if($null -ne $ctx -and $ctx.ok){$script:MarketContext=$ctx;$script:LastContextAtUtc=$nowUtc}}catch{Write-Host ('[{0}] Market context chua cap nhat: {1}' -f (Get-Date -Format 'HH:mm:ss'),$_.Exception.Message) -ForegroundColor DarkYellow}
}
function Read-TechnicalSnapshot {
    if(-not(Test-Path -LiteralPath $SnapshotCsv)){return $null}
    try{
        $file=Get-Item -LiteralPath $SnapshotCsv -ErrorAction Stop;if(([DateTime]::UtcNow-$file.LastWriteTimeUtc).TotalSeconds -gt $TechnicalFreshSeconds){return $null}
        if($file.LastWriteTimeUtc -le $script:LastCsvWriteUtc){return $script:LastTechnical}
        $before=$file.LastWriteTimeUtc;Start-Sleep -Milliseconds 200;$row=@(Import-Csv -LiteralPath $SnapshotCsv)|Select-Object -First 1;$after=(Get-Item -LiteralPath $SnapshotCsv).LastWriteTimeUtc
        if($after -ne $before -or $null -eq $row){return $script:LastTechnical};$script:LastCsvWriteUtc=$after
        $t=[ordered]@{symbol=([string]$row.symbol).Trim();value=Convert-LiveNum $row.value;reference=Convert-LiveNum $row.reference;change=Convert-LiveNum $row.change;change_pct=Convert-LiveNum $row.change_pct;open=Convert-LiveNum $row.open;high=Convert-LiveNum $row.high;low=Convert-LiveNum $row.low;rebound_from_low=Convert-LiveNum $row.rebound_from_low;drop_from_high=Convert-LiveNum $row.drop_from_high;ma10=Convert-LiveNum $row.ma10;ma20=Convert-LiveNum $row.ma20;ma50=Convert-LiveNum $row.ma50;vwap=Convert-LiveNum $row.vwap;rsi14=Convert-LiveNum $row.rsi14;macd=Convert-LiveNum $row.macd;macd_signal=Convert-LiveNum $row.macd_signal;prev_high=Convert-LiveNum $row.prev_high;prev_low=Convert-LiveNum $row.prev_low;high20=Convert-LiveNum $row.high20;low20=Convert-LiveNum $row.low20;support_near=Convert-LiveNum $row.support_near;resistance_near=Convert-LiveNum $row.resistance_near;updated_at=([string]$row.updated_at).Trim()}
        $script:LastTechnical=$t;return $t
    }catch{return $script:LastTechnical}
}
function Is-TechnicalFresh { try{return (([DateTime]::UtcNow-(Get-Item -LiteralPath $SnapshotCsv).LastWriteTimeUtc).TotalSeconds -le $TechnicalFreshSeconds)}catch{return $false} }
function Get-CloudMarketContext {
    $ctx=$script:MarketContext;if($null -eq $ctx){return $null}
    return [ordered]@{ok=$ctx.ok;updated_at=$ctx.updated_at;relay_received_at=$ctx.relay_received_at;relay_source_updated_at=$ctx.relay_source_updated_at;indexes=$ctx.indexes;market_intelligence=$ctx.market_intelligence;vn30_stocks=$ctx.vn30_stocks}
}
function Get-BreadthBalance {
    try{$b=$script:MarketContext.market_intelligence.breadth.balance;if($null -ne $b){return [double]$b}}catch{}
    try{$idx=@($script:MarketContext.indexes|Where-Object{$_.symbol -eq 'VN-INDEX'})|Select-Object -First 1;if($null -ne $idx.adv -and $null -ne $idx.dec -and $null -ne $idx.flat){$tot=[double]$idx.adv+[double]$idx.dec+[double]$idx.flat;if($tot -gt 0){return ([double]$idx.adv-[double]$idx.dec)/$tot}}}catch{}
    return $null
}
function Add-MemoryPoint($technical,[bool]$technicalAvailable){
    $point=[pscustomobject]@{captured_at=[DateTimeOffset]::UtcNow.ToString('o');value=if($technicalAvailable){$technical.value}else{$null};change=if($technicalAvailable){$technical.change}else{$null};pct=if($technicalAvailable){$technical.change_pct}else{$null};breadth_balance=Get-BreadthBalance;sectors=@($script:SectorSnapshot|ForEach-Object{[pscustomobject]@{key=$_.key;name=$_.name;change_pct=$_.change_pct;breadth_balance=$_.breadth_balance}})}
    [void]$script:Memory.Add($point)
    $cut=[DateTime]::UtcNow.AddMinutes(-35);for($i=$script:Memory.Count-1;$i -ge 0;$i--){if([DateTime]$script:Memory[$i].captured_at -lt $cut){$script:Memory.RemoveAt($i)}}
}
function Get-MemoryPoint([int]$minutes){
    if($script:Memory.Count -lt 1){return $null};$target=[DateTime]::UtcNow.AddMinutes(-$minutes);$best=$null;$bestDiff=[double]::MaxValue
    foreach($p in $script:Memory){$d=[Math]::Abs((([DateTime]$p.captured_at)-$target).TotalSeconds);if($d -lt $bestDiff -and $d -le 150){$best=$p;$bestDiff=$d}}
    return $best
}
function Get-LocalMemory { return [ordered]@{m5=Get-MemoryPoint 5;m15=Get-MemoryPoint 15;m30=Get-MemoryPoint 30} }
function Save-LocalRaw($technical,[bool]$technicalAvailable){
    try{
        $now=Get-VnNow;$day=$now.ToString('yyyy-MM-dd');$dir=Join-Path $LocalRoot $day;if(-not(Test-Path $dir)){New-Item -ItemType Directory -Path $dir -Force|Out-Null}
        $stocks=@();foreach($k in $script:StockSnapshot.Keys){$stocks+=$script:StockSnapshot[$k]}
        $raw=[ordered]@{captured_at=[DateTimeOffset]::UtcNow.ToString('o');market_date=$day;technical_available=$technicalAvailable;technical=if($technicalAvailable){$technical}else{@{}};sector_watchlists=@($script:SectorSnapshot);stocks=@($stocks);local_memory=Get-LocalMemory;market_context=Get-CloudMarketContext}
        $line=$raw|ConvertTo-Json -Depth 18 -Compress;Add-Content -LiteralPath (Join-Path $dir 'market-live.ndjson') -Value $line -Encoding UTF8;$line|Set-Content -LiteralPath (Join-Path $LocalRoot 'latest.json') -Encoding UTF8
    }catch{Write-Host ('[{0}] Local history loi: {1}' -f (Get-Date -Format 'HH:mm:ss'),$_.Exception.Message) -ForegroundColor DarkYellow}
}
function Cleanup-LocalHistory {
    try{if(-not(Test-Path $LocalRoot)){New-Item -ItemType Directory -Path $LocalRoot -Force|Out-Null;return};$cut=(Get-VnNow).Date.AddDays(-$LocalRetentionDays);foreach($d in @(Get-ChildItem $LocalRoot -Directory -ErrorAction SilentlyContinue)){$x=[DateTime]::MinValue;if([DateTime]::TryParseExact($d.Name,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$x) -and $x -lt $cut){Remove-Item $d.FullName -Recurse -Force -ErrorAction SilentlyContinue}}}catch{}
}
function Push-CloudState($technical,[bool]$technicalAvailable){
    if($null -eq $script:MarketContext -and -not $technicalAvailable -and $script:SectorSnapshot.Count -lt 1){return}
    $sourceUpdatedAt=if($technicalAvailable -and $script:LastCsvWriteUtc -gt [DateTime]::MinValue){([DateTimeOffset]$script:LastCsvWriteUtc).ToString('o')}else{$null}
    $payload=[ordered]@{ok=$true;captured_at=[DateTimeOffset]::UtcNow.ToString('o');source_updated_at=$sourceUpdatedAt;source=if($technicalAvailable){'amibroker-afl+watchlists+market-feed-v3'}else{'watchlists+market-feed-v3'};technical_available=$technicalAvailable;technical=if($technicalAvailable){$technical}else{@{}};sector_watchlists=@($script:SectorSnapshot);local_memory=Get-LocalMemory;market_context=Get-CloudMarketContext;local_first=$true;engine_version='3.0';local_history_interval_seconds=$IntervalSeconds;cloud_history_target_seconds=60}
    try{$headers=@{'x-bridge-key'=$BridgeKey};$body=$payload|ConvertTo-Json -Depth 20 -Compress;$r=Invoke-RestMethod -UseBasicParsing -Uri $RelayUrl -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 18
        if($r.ok){if($null -ne $r.published_comment){Write-Host ('[{0}] LIVE COMMENT V3: {1}' -f (Get-Date -Format 'HH:mm:ss'),$r.published_comment.headline) -ForegroundColor Green}elseif($r.history_stored){Write-Host ('[{0}] Live V3 current + cloud history.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray}else{Write-Host ('[{0}] Live V3 current OK.' -f (Get-Date -Format 'HH:mm:ss')) -ForegroundColor DarkGray}}
    }catch{Write-Host ('[{0}] Live V3 push loi: {1}' -f (Get-Date -Format 'HH:mm:ss'),$_.Exception.Message) -ForegroundColor DarkYellow}
}

$script:WatchListRoot=Resolve-WatchListRoot;Cleanup-LocalHistory
Write-Host 'VO HOANG - LIVE MARKET COMMENTARY V3 / LOCAL WORLD MODEL' -ForegroundColor Cyan
Write-Host ('AFL CSV: '+$SnapshotCsv)
Write-Host ('Watch Lists: '+$(if($script:WatchListRoot){$script:WatchListRoot}else{'CHUA TIM THAY'}))
Write-Host ('Local history: '+$LocalRoot)
Write-Host 'Mo hinh: VN-Index -> the tran -> nhom -> ma -> vung ky thuat -> kich ban tiep theo.' -ForegroundColor DarkCyan
Write-Host ''
while($true){
    if(-not(Is-TradingWindow)){Start-Sleep -Seconds 20;continue}
    Refresh-MarketContext;Refresh-SectorSnapshot;$technical=Read-TechnicalSnapshot;$technicalAvailable=($null -ne $technical -and (Is-TechnicalFresh))
    Add-MemoryPoint $technical $technicalAvailable;Save-LocalRaw $technical $technicalAvailable;Push-CloudState $technical $technicalAvailable
    Start-Sleep -Seconds $IntervalSeconds
}
