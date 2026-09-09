$ErrorActionPreference='Continue'
$roots=@('D:\DataTick','D:\AmiBroker\eod')
$patterns=@('VNINDEX','VN30','VN100','HNXINDEX','UPCOMINDEX','ADV','DECL','UP','DOWN','CEIL','FLOOR','VALUE','TURN','GTGD','KLGD','VOLUME','HOSE','HSX','HNX','UPCOM')
Write-Host 'VO HOANG - Market Metrics Probe' -ForegroundColor Cyan

function Read-AsciiZ([byte[]]$bytes,[int]$offset,[int]$length){
  if($offset-lt 0 -or ($offset+$length)-gt$bytes.Length){return ''}
  $slice=New-Object byte[] $length; [Array]::Copy($bytes,$offset,$slice,0,$length)
  $zero=[Array]::IndexOf($slice,[byte]0); if($zero-ge 0){$length=$zero}
  if($length-le 0){return ''}; ([Text.Encoding]::ASCII.GetString($slice,0,$length)).Trim()
}

$eod='D:\DataTick\eod'; $rows=@()
$xmaster=Join-Path $eod 'XMASTER'
if(Test-Path $xmaster){
 [byte[]]$x=[IO.File]::ReadAllBytes($xmaster); $total=[BitConverter]::ToUInt16($x,10); $max=[Math]::Floor(($x.Length-150)/150); $n=[Math]::Min([int]$total,[int]$max)
 for($i=0;$i-lt$n;$i++){
   $o=150+$i*150; $s=(Read-AsciiZ $x ($o+1) 15).ToUpperInvariant(); $d=Read-AsciiZ $x ($o+16) 46; $fn=[BitConverter]::ToUInt16($x,$o+65)
   if($s){$rows += [pscustomobject]@{symbol=$s;description=$d;file=$fn;format='MWD'}}
 }
}
$emaster=Join-Path $eod 'EMASTER'
if(Test-Path $emaster){
 [byte[]]$b=[IO.File]::ReadAllBytes($emaster); $total=[BitConverter]::ToUInt16($b,0); $max=[Math]::Floor(($b.Length-192)/192); $n=[Math]::Min([int]$total,[int]$max)
 for($i=0;$i-lt$n;$i++){
   $o=192+$i*192; $s=(Read-AsciiZ $b ($o+11) 14).ToUpperInvariant(); $d=Read-AsciiZ $b ($o+32) 16; $fn=[int]$b[$o+2]
   if($s){$rows += [pscustomobject]@{symbol=$s;description=$d;file=$fn;format='DAT'}}
 }
}

Write-Host "`n=== SYMBOL CANDIDATES ===" -ForegroundColor Yellow
$rx='(' + (($patterns | ForEach-Object {[Regex]::Escape($_)}) -join '|') + ')'
$rows | Where-Object { $_.symbol -match $rx -or $_.description -match $rx } | Sort-Object symbol -Unique | Select-Object symbol,description,file,format | Format-Table -AutoSize

Write-Host "`n=== POSSIBLE METADATA FILES ===" -ForegroundColor Yellow
foreach($root in $roots){
 if(-not(Test-Path $root)){continue}
 Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue |
   Where-Object { $_.Extension -match '^\.(txt|csv|json|xml|ini|conf|cfg|dat)$' -or $_.Name -match 'market|symbol|ticker|exchange|master|config|stock' } |
   Sort-Object Length | Select-Object -First 80 FullName,Length,LastWriteTime | Format-Table -AutoSize
}

Write-Host "`n=== TEXT HITS FOR EXCHANGE NAMES ===" -ForegroundColor Yellow
foreach($root in $roots){
 if(-not(Test-Path $root)){continue}
 $files=Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 5MB -and $_.Extension -match '^\.(txt|csv|json|xml|ini|conf|cfg)$' }
 foreach($f in $files){
   try{
     $m=Select-String -Path $f.FullName -Pattern 'HOSE|HSX|HNX|UPCOM|Ho Chi Minh Stock Exchange|Hanoi Stock Exchange' -SimpleMatch:$false -ErrorAction SilentlyContinue | Select-Object -First 3
     if($m){ Write-Host ('FILE: '+$f.FullName) -ForegroundColor Green; $m | ForEach-Object { Write-Host ('  '+$_.Line.Trim()) } }
   }catch{}
 }
}

Write-Host "`nProbe xong. Copy toàn bộ phần SYMBOL CANDIDATES và TEXT HITS gửi ChatGPT." -ForegroundColor Cyan
