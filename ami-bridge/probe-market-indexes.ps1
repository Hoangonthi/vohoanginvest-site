$ErrorActionPreference = 'Continue'

$Root = 'D:\DataTick\eod'
$Targets = @('VNINDEX','VN-INDEX','VN30','VN100','HNX','HNXINDEX','HNX-INDEX','UPCOM','UPCOMINDEX')

function Read-AsciiTrim([byte[]]$bytes,[int]$offset,[int]$length) {
    if ($offset -lt 0 -or ($offset+$length) -gt $bytes.Length) { return '' }
    return ([Text.Encoding]::ASCII.GetString($bytes,$offset,$length)).Trim([char]0,' ')
}

Write-Host '=== VO HOANG MARKET INDEX PROBE ===' -ForegroundColor Cyan
Write-Host ('Root: ' + $Root)

$results=@()

$emaster=Join-Path $Root 'EMASTER'
if (Test-Path $emaster) {
    [byte[]]$b=[IO.File]::ReadAllBytes($emaster)
    $total=[BitConverter]::ToUInt16($b,0)
    $max=[Math]::Floor(($b.Length-192)/192)
    $n=[Math]::Min([int]$total,[int]$max)
    if($n -le 0){$n=[int]$max}
    for($i=0;$i -lt $n;$i++){
        $o=192+($i*192)
        $fileNo=[int]$b[$o+2]
        $fields=[int]$b[$o+6]
        $symbol=Read-AsciiTrim $b ($o+11) 14
        $desc=Read-AsciiTrim $b ($o+32) 16
        $period=Read-AsciiTrim $b ($o+60) 1
        $u=($symbol+' '+$desc).ToUpperInvariant()
        $hit=$false
        foreach($t in $Targets){ if($u -like ('*'+$t+'*')){$hit=$true;break} }
        if($hit){
            $file=Join-Path $Root ("F{0}.DAT" -f $fileNo)
            $results += [pscustomobject]@{index='EMASTER';symbol=$symbol;description=$desc;file_number=$fileNo;fields=$fields;period=$period;file=$file;exists=(Test-Path $file)}
        }
    }
}

$xmaster=Join-Path $Root 'XMASTER'
if (Test-Path $xmaster) {
    [byte[]]$b=[IO.File]::ReadAllBytes($xmaster)
    $total=[BitConverter]::ToUInt16($b,10)
    $max=[Math]::Floor(($b.Length-150)/150)
    $n=[Math]::Min([int]$total,[int]$max)
    if($n -le 0){$n=[int]$max}
    for($i=0;$i -lt $n;$i++){
        $o=150+($i*150)
        $symbol=Read-AsciiTrim $b ($o+1) 15
        $desc=Read-AsciiTrim $b ($o+16) 32
        $period=Read-AsciiTrim $b ($o+62) 1
        $fileNo=[BitConverter]::ToUInt16($b,$o+65)
        $u=($symbol+' '+$desc).ToUpperInvariant()
        $hit=$false
        foreach($t in $Targets){ if($u -like ('*'+$t+'*')){$hit=$true;break} }
        if($hit){
            $mwd=Join-Path $Root ("F{0}.MWD" -f $fileNo)
            $dat=Join-Path $Root ("F{0}.DAT" -f $fileNo)
            $file=if(Test-Path $mwd){$mwd}else{$dat}
            $results += [pscustomobject]@{index='XMASTER';symbol=$symbol;description=$desc;file_number=$fileNo;fields=$null;period=$period;file=$file;exists=(Test-Path $file)}
        }
    }
}

Write-Host ''
Write-Host '--- CANDIDATES ---' -ForegroundColor DarkCyan
$results | Sort-Object index,symbol | Format-Table -AutoSize

Write-Host ''
Write-Host '--- JSON ---' -ForegroundColor DarkCyan
$results | ConvertTo-Json -Depth 4 | Write-Host

Write-Host ''
Write-Host 'Probe chi doc file, KHONG sua/xoa du lieu.' -ForegroundColor Cyan
Write-Host 'Nhan Enter de dong.'
[void](Read-Host)
