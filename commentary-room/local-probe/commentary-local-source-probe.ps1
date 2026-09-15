param(
    [string]$CsvPath = 'C:\Users\USER\Desktop\AMIBRO\vh_market_live_snapshot.csv',
    [string]$ArchiveDate = '2026-09-15',
    [string]$ArchivePath = '',
    [string]$StockBaseUrl = 'http://127.0.0.1:8765/stock',
    [string[]]$Symbols = @('VCB','VIC','FPT','HPG','SSI','PVD'),
    [string]$OutputPath = '.\commentary-local-source-audit.json'
)

$ErrorActionPreference = 'Stop'

function Get-VnNowIso {
    $tz = [TimeZoneInfo]::FindSystemTimeZoneById('SE Asia Standard Time')
    $vn = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz)
    return $vn.ToString('yyyy-MM-ddTHH:mm:ss.fff') + '+07:00'
}
function Get-ScalarType($Value) {
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) { return 'NULL' }
    $d = 0.0
    if ([double]::TryParse([string]$Value, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$d)) { return 'NUMBER' }
    $dt = [DateTime]::MinValue
    if ([DateTime]::TryParse([string]$Value, [ref]$dt)) { return 'DATETIME_OR_DATE' }
    if ([string]$Value -match '^(true|false)$') { return 'BOOLEAN' }
    return 'STRING'
}
function Get-PropertyNames($Object) {
    if ($null -eq $Object) { return @() }
    return @($Object.PSObject.Properties | ForEach-Object { $_.Name })
}
function Get-FieldPaths($Object, [string]$Prefix = '') {
    $out = New-Object System.Collections.Generic.List[string]
    if ($null -eq $Object) { return @($out) }
    if ($Object -is [string] -or $Object -is [ValueType]) { return @($out) }
    if ($Object -is [System.Collections.IEnumerable] -and -not ($Object -is [System.Collections.IDictionary])) {
        $arr = @($Object)
        if ($Prefix) { [void]$out.Add($Prefix + '[]') }
        if ($arr.Count -gt 0) {
            foreach ($p in @(Get-FieldPaths $arr[0] ($Prefix + '[]'))) { [void]$out.Add($p) }
        }
        return @($out)
    }
    foreach ($prop in $Object.PSObject.Properties) {
        $path = if ($Prefix) { $Prefix + '.' + $prop.Name } else { $prop.Name }
        [void]$out.Add($path)
        foreach ($p in @(Get-FieldPaths $prop.Value $path)) { [void]$out.Add($p) }
    }
    return @($out)
}
function Get-Median([double[]]$Values) {
    if ($null -eq $Values -or $Values.Count -eq 0) { return $null }
    $s = @($Values | Sort-Object)
    $n = $s.Count
    if ($n % 2 -eq 1) { return [Math]::Round([double]$s[[int]($n/2)], 3) }
    return [Math]::Round(([double]$s[$n/2-1] + [double]$s[$n/2]) / 2, 3)
}
function Test-Horizon($CurrentTimestamp, $PointTimestamp, [string]$Horizon) {
    $rules = @{ m5=@{min=210;max=450}; m15=@{min=660;max=1140}; m30=@{min=1440;max=2160} }
    if (-not $PointTimestamp) { return [ordered]@{ status='MISSING'; gap_seconds=$null } }
    try {
        $gap = (([DateTimeOffset]::Parse([string]$CurrentTimestamp)) - ([DateTimeOffset]::Parse([string]$PointTimestamp))).TotalSeconds
        $r = $rules[$Horizon]
        if ($gap -lt $r.min -or $gap -gt $r.max) { return [ordered]@{ status='INVALID_HORIZON'; gap_seconds=[Math]::Round($gap,1) } }
        return [ordered]@{ status='VALID'; gap_seconds=[Math]::Round($gap,1) }
    } catch { return [ordered]@{ status='INVALID_HORIZON'; gap_seconds=$null } }
}
function Audit-Csv([string]$Path) {
    $result = [ordered]@{ path=$Path; exists=$false; last_write_time=$null; headers=@(); sample_row=$null; field_types=[ordered]@{}; null_fields=@(); requested_fields=[ordered]@{}; error=$null }
    if (-not (Test-Path -LiteralPath $Path)) { $result.error='FILE_NOT_FOUND'; return $result }
    try {
        $item = Get-Item -LiteralPath $Path
        $row = @(Import-Csv -LiteralPath $Path | Select-Object -First 1)[0]
        $result.exists=$true; $result.last_write_time=$item.LastWriteTime.ToString('o')
        if ($null -eq $row) { $result.error='NO_DATA_ROW'; return $result }
        $headers = @(Get-PropertyNames $row); $result.headers=$headers
        $sample=[ordered]@{}; $nulls=@()
        foreach($h in $headers){$v=$row.$h;$sample[$h]=$v;$result.field_types[$h]=Get-ScalarType $v;if($null -eq $v -or [string]::IsNullOrWhiteSpace([string]$v)){$nulls+=$h}}
        $result.sample_row=$sample; $result.null_fields=$nulls
        $aliases=[ordered]@{
            open=@('open'); high=@('high'); low=@('low'); last=@('last','close','value'); reference=@('reference','ref');
            ma10=@('ma10'); ma20=@('ma20'); ma50=@('ma50'); ma100=@('ma100'); ma200=@('ma200'); vwap=@('vwap');
            rsi=@('rsi','rsi14'); macd=@('macd'); support=@('support','support_near'); resistance=@('resistance','resistance_near');
            previous_high=@('prev_high','previous_high'); previous_low=@('prev_low','previous_low'); high20=@('high20'); low20=@('low20')
        }
        foreach($k in $aliases.Keys){$match=@($aliases[$k]|Where-Object{$headers -contains $_}|Select-Object -First 1);$result.requested_fields[$k]=if($match.Count){[ordered]@{status='PRESENT';raw_field=$match[0];sample=$sample[$match[0]]}}else{[ordered]@{status='MISSING';raw_field=$null;sample=$null}}}
    } catch { $result.error=$_.Exception.Message }
    return $result
}
function Audit-Archive([string]$Path) {
    $result=[ordered]@{path=$Path;exists=$false;frame_count=0;first_timestamp=$null;last_timestamp=$null;interval_seconds=[ordered]@{min=$null;median=$null;max=$null};stable_field_paths=@();sometimes_missing_field_paths=@();technical_available=[ordered]@{true=0;false=0;missing=0};memory_horizons=[ordered]@{m5=[ordered]@{valid=0;invalid=0;missing=0};m15=[ordered]@{valid=0;invalid=0;missing=0};m30=[ordered]@{valid=0;invalid=0;missing=0}};sector_structure_fields=@();stock_structure_fields=@();error=$null}
    if(-not(Test-Path -LiteralPath $Path)){$result.error='FILE_NOT_FOUND';return $result}
    try{
        $lines=@(Get-Content -LiteralPath $Path | Where-Object{ -not [string]::IsNullOrWhiteSpace($_) });$frames=@();$counts=@{};$sectorFields=New-Object System.Collections.Generic.HashSet[string];$stockFields=New-Object System.Collections.Generic.HashSet[string]
        foreach($line in $lines){try{$f=$line|ConvertFrom-Json}catch{continue};$frames+=$f;$paths=@(Get-FieldPaths $f|Select-Object -Unique);foreach($p in $paths){if(-not $counts.ContainsKey($p)){$counts[$p]=0};$counts[$p]++}
            if($f.technical_available -eq $true){$result.technical_available.true++}elseif($f.technical_available -eq $false){$result.technical_available.false++}else{$result.technical_available.missing++}
            foreach($h in @('m5','m15','m30')){$pt=$f.local_memory.$h;$chk=Test-Horizon $f.captured_at $pt.captured_at $h;if($chk.status -eq 'VALID'){$result.memory_horizons[$h].valid++}elseif($chk.status -eq 'MISSING'){$result.memory_horizons[$h].missing++}else{$result.memory_horizons[$h].invalid++}}
            $sec=@($f.sector_watchlists|Select-Object -First 1);if($sec.Count){foreach($n in Get-PropertyNames $sec[0]){[void]$sectorFields.Add($n)}}
            $st=@($f.stocks|Select-Object -First 1);if($st.Count){foreach($n in Get-PropertyNames $st[0]){[void]$stockFields.Add($n)}}
        }
        $result.exists=$true;$result.frame_count=$frames.Count
        if($frames.Count){$result.first_timestamp=[string]$frames[0].captured_at;$result.last_timestamp=[string]$frames[-1].captured_at}
        $diffs=@();for($i=1;$i -lt $frames.Count;$i++){try{$diffs+=(([DateTimeOffset]::Parse([string]$frames[$i].captured_at))-([DateTimeOffset]::Parse([string]$frames[$i-1].captured_at))).TotalSeconds}catch{}}
        if($diffs.Count){$result.interval_seconds.min=[Math]::Round(($diffs|Measure-Object -Minimum).Minimum,3);$result.interval_seconds.median=Get-Median $diffs;$result.interval_seconds.max=[Math]::Round(($diffs|Measure-Object -Maximum).Maximum,3)}
        if($frames.Count){$result.stable_field_paths=@($counts.Keys|Where-Object{$counts[$_] -eq $frames.Count}|Sort-Object);$result.sometimes_missing_field_paths=@($counts.Keys|Where-Object{$counts[$_] -lt $frames.Count}|Sort-Object)}
        $result.sector_structure_fields=@($sectorFields|Sort-Object);$result.stock_structure_fields=@($stockFields|Sort-Object)
    }catch{$result.error=$_.Exception.Message}
    return $result
}
function Probe-Stocks([string]$BaseUrl,[string[]]$ProbeSymbols) {
    $out=@()
    $wanted=@('reference','ceiling','floor','open','high','low','close','last','change','change_pct','volume','value','date','source_updated_at')
    foreach($symbol in $ProbeSymbols){$row=[ordered]@{symbol=$symbol;ok=$false;field_names=@();sample=[ordered]@{};requested_fields=[ordered]@{};error=$null};try{$r=Invoke-RestMethod -UseBasicParsing -Method Get -Uri ($BaseUrl.TrimEnd('/')+'/'+[Uri]::EscapeDataString($symbol)) -TimeoutSec 3;$q=$r.quote;if($null -eq $q){$row.error='NO_QUOTE'}else{$row.ok=$true;$names=@(Get-PropertyNames $q);$row.field_names=$names;foreach($n in $names){$row.sample[$n]=$q.$n};foreach($w in $wanted){$present=$names -contains $w;if($w -eq 'last' -and ($names -contains 'close')){$present=$true};$row.requested_fields[$w]=if($present){'PRESENT'}else{'MISSING'}}}}catch{$row.error=$_.Exception.Message};$out+=[pscustomobject]$row}
    return @($out)
}

if([string]::IsNullOrWhiteSpace($ArchivePath)){
    $archiveRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\ami-bridge\live-data'))
    $ArchivePath=Join-Path (Join-Path $archiveRoot $ArchiveDate) 'market-live.ndjson'
}

$audit=[ordered]@{
    schema='COMMENTARY_LOCAL_SOURCE_AUDIT_V1'; generated_at=Get-VnNowIso; read_only=$true;
    afl_csv=Audit-Csv $CsvPath; local_archive=Audit-Archive $ArchivePath; stock_endpoint=[ordered]@{base_url=$StockBaseUrl;probes=Probe-Stocks $StockBaseUrl $Symbols};
    safety=[ordered]@{supabase_called=$false;production_pushed=$false;ami_modified=$false;source_files_modified=$false;secrets_included=$false}
}
$json=$audit|ConvertTo-Json -Depth 30
$json|Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host ''
Write-Host 'COMMENTARY LOCAL SOURCE PROBE — READ ONLY' -ForegroundColor Cyan
Write-Host ('AFL CSV: {0} | headers={1}' -f $audit.afl_csv.exists,$audit.afl_csv.headers.Count)
Write-Host ('Archive: {0} | frames={1} | {2} -> {3}' -f $audit.local_archive.exists,$audit.local_archive.frame_count,$audit.local_archive.first_timestamp,$audit.local_archive.last_timestamp)
Write-Host ('Memory invalid: m5={0}, m15={1}, m30={2}' -f $audit.local_archive.memory_horizons.m5.invalid,$audit.local_archive.memory_horizons.m15.invalid,$audit.local_archive.memory_horizons.m30.invalid)
foreach($s in $audit.stock_endpoint.probes){Write-Host ('/stock/{0}: {1} | fields={2}' -f $s.symbol,$s.ok,$s.field_names.Count)}
Write-Host ('Audit JSON: ' + ([IO.Path]::GetFullPath($OutputPath))) -ForegroundColor Green
