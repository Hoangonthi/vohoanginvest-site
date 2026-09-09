$ErrorActionPreference='Stop'

Write-Host 'VO HOANG - Extra Market Metrics Probe' -ForegroundColor Cyan

function Read-AsciiZ([byte[]]$bytes,[int]$offset,[int]$length){
  if($offset -lt 0 -or ($offset+$length) -gt $bytes.Length){return ''}
  $slice=New-Object byte[] $length
  [Array]::Copy($bytes,$offset,$slice,0,$length)
  $zero=[Array]::IndexOf($slice,[byte]0)
  if($zero -ge 0){$length=$zero}
  if($length -le 0){return ''}
  return ([Text.Encoding]::ASCII.GetString($slice,0,$length)).Trim()
}

function Read-Master([string]$root){
  $rows=@()
  $emaster=Join-Path $root 'EMASTER'
  if(Test-Path $emaster){
    [byte[]]$b=[IO.File]::ReadAllBytes($emaster)
    if($b.Length-ge 192){
      $total=[BitConverter]::ToUInt16($b,0);$max=[Math]::Floor(($b.Length-192)/192);$n=[Math]::Min([int]$total,[int]$max);if($n-le 0){$n=[int]$max}
      for($i=0;$i-lt$n;$i++){
        $o=192+($i*192);$fileNo=[int]$b[$o+2]
        $symbol=(Read-AsciiZ $b ($o+11) 14).ToUpperInvariant();$desc=Read-AsciiZ $b ($o+32) 16
        if($symbol){$rows+=[pscustomobject]@{root=$root;symbol=$symbol;description=$desc;file=$fileNo;format='DAT'}}
      }
    }
  }
  $xmaster=Join-Path $root 'XMASTER'
  if(Test-Path $xmaster){
    [byte[]]$x=[IO.File]::ReadAllBytes($xmaster)
    if($x.Length-ge 150){
      $total=[BitConverter]::ToUInt16($x,10);$max=[Math]::Floor(($x.Length-150)/150);$n=[Math]::Min([int]$total,[int]$max);if($n-le 0){$n=[int]$max}
      for($i=0;$i-lt$n;$i++){
        $o=150+($i*150);$symbol=(Read-AsciiZ $x ($o+1) 15).ToUpperInvariant();$desc=Read-AsciiZ $x ($o+16) 46;$fileNo=[BitConverter]::ToUInt16($x,$o+65)
        if($symbol){$rows+=[pscustomobject]@{root=$root;symbol=$symbol;description=$desc;file=$fileNo;format='MWD'}}
      }
    }
  }
  return $rows
}

$roots=@('D:\DataTick\eod','D:\DataTick\extra1','D:\DataTick\extra2','D:\DataTick\intraday') | Where-Object { Test-Path $_ }
$all=@()
foreach($r in $roots){
  try {$all += Read-Master $r} catch { Write-Host "Khong doc duoc $r : $($_.Exception.Message)" -ForegroundColor Yellow }
}

Write-Host "`n=== CANDIDATES IN EXTRA/INTRADAY ===" -ForegroundColor Yellow
$kw='ADV|DECL|GAIN|LOSS|UP|DOWN|UNCH|FLAT|CEIL|FLOOR|VALUE|VAL|TURNOVER|VOL|VOLUME|GTGD|KLGD|HOSE|HSX|HNX|UPCOM|MARKET|BREADTH|TOTAL|MATCH|TRADING'
$hits=$all | Where-Object { ($_.root -notlike '*\eod') -and (($_.symbol -match $kw) -or ($_.description -match $kw)) } | Sort-Object root,symbol -Unique
$hits | Select-Object root,symbol,description,file,format | Format-Table -AutoSize

Write-Host "`n=== WATCHLIST / INDEX FILE CONTENT ===" -ForegroundColor Yellow
$watchFiles=@('D:\AmiBroker\eod\WatchLists\index.txt','D:\DataTick\README.txt') | Where-Object { Test-Path $_ }
foreach($f in $watchFiles){
  Write-Host "--- $f ---" -ForegroundColor DarkCyan
  try { Get-Content $f -ErrorAction Stop | Select-Object -First 300 } catch { Write-Host $_.Exception.Message }
}

Write-Host "`n=== SAMPLE SYMBOL COUNTS BY ROOT ===" -ForegroundColor Yellow
$all | Group-Object root | Select-Object Name,Count | Format-Table -AutoSize

Write-Host "`nProbe xong. Gui toan bo output cho ChatGPT." -ForegroundColor Green
