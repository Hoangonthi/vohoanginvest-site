$ErrorActionPreference = 'Continue'

$Root = 'D:\DataTick\eod'
$Target = 'FPT'

function Read-AsciiTrim([byte[]]$bytes, [int]$offset, [int]$length) {
    if ($offset -lt 0 -or $offset + $length -gt $bytes.Length) { return '' }
    $s = [System.Text.Encoding]::ASCII.GetString($bytes, $offset, $length)
    return ($s.Trim([char]0, ' '))
}

Write-Host '=== VO HOANG METASTOCK SYMBOL MAP PROBE ===' -ForegroundColor Cyan
Write-Host ('Root: ' + $Root)
Write-Host ('Target: ' + $Target)
Write-Host ('Root exists: ' + (Test-Path $Root))

$emaster = Join-Path $Root 'EMASTER'
$xmaster = Join-Path $Root 'XMASTER'
$master  = Join-Path $Root 'MASTER'

Write-Host ''
Write-Host '--- INDEX FILES ---' -ForegroundColor DarkCyan
foreach ($p in @($master,$emaster,$xmaster)) {
    if (Test-Path $p) {
        $fi = Get-Item $p
        Write-Host (('{0,-12} exists=True length={1}' -f $fi.Name,$fi.Length))
    } else {
        Write-Host (('{0,-12} exists=False' -f (Split-Path $p -Leaf)))
    }
}

$found = @()

if (Test-Path $emaster) {
    Write-Host ''
    Write-Host '--- PARSE EMASTER ---' -ForegroundColor DarkCyan
    try {
        [byte[]]$b = [IO.File]::ReadAllBytes($emaster)
        if ($b.Length -ge 192) {
            $total = [BitConverter]::ToUInt16($b,0)
            $last  = [BitConverter]::ToUInt16($b,2)
            Write-Host ('Header totalFiles=' + $total + ' lastFile=' + $last + ' length=' + $b.Length)
            $maxRecords = [Math]::Floor(($b.Length - 192) / 192)
            $n = [Math]::Min([int]$total, [int]$maxRecords)
            if ($n -le 0) { $n = [int]$maxRecords }
            for ($i=0; $i -lt $n; $i++) {
                $o = 192 + ($i * 192)
                $fileNo = [int]$b[$o + 2]
                $fields = [int]$b[$o + 6]
                $symbol = Read-AsciiTrim $b ($o + 11) 14
                $desc   = Read-AsciiTrim $b ($o + 32) 16
                $period = Read-AsciiTrim $b ($o + 60) 1
                if ($symbol -eq $Target -or $symbol -like "*$Target*") {
                    $dataFile = Join-Path $Root ("F{0}.DAT" -f $fileNo)
                    $obj = [pscustomobject]@{ index='EMASTER'; record=$i; symbol=$symbol; description=$desc; file_number=$fileNo; fields=$fields; period=$period; data_file=$dataFile; exists=(Test-Path $dataFile) }
                    $found += $obj
                    $obj | Format-List | Out-String | Write-Host
                }
            }
            if (-not ($found | Where-Object {$_.index -eq 'EMASTER'})) { Write-Host 'FPT not found in EMASTER.' -ForegroundColor Yellow }
        }
    } catch { Write-Host ('EMASTER parse ERROR: ' + $_.Exception.Message) -ForegroundColor Red }
}

if (Test-Path $xmaster) {
    Write-Host ''
    Write-Host '--- PARSE XMASTER ---' -ForegroundColor DarkCyan
    try {
        [byte[]]$b = [IO.File]::ReadAllBytes($xmaster)
        if ($b.Length -ge 150) {
            $total = [BitConverter]::ToUInt16($b,10)
            $last  = [BitConverter]::ToUInt16($b,18)
            Write-Host ('Header totalFiles=' + $total + ' lastFile=' + $last + ' length=' + $b.Length)
            $maxRecords = [Math]::Floor(($b.Length - 150) / 150)
            $n = [Math]::Min([int]$total, [int]$maxRecords)
            if ($n -le 0) { $n = [int]$maxRecords }
            for ($i=0; $i -lt $n; $i++) {
                $o = 150 + ($i * 150)
                $symbol = Read-AsciiTrim $b ($o + 1) 15
                $desc   = Read-AsciiTrim $b ($o + 16) 32
                $period = Read-AsciiTrim $b ($o + 62) 1
                $fileNo = [BitConverter]::ToUInt16($b, $o + 65)
                if ($symbol -eq $Target -or $symbol -like "*$Target*") {
                    $mwd = Join-Path $Root ("F{0}.MWD" -f $fileNo)
                    $dat = Join-Path $Root ("F{0}.DAT" -f $fileNo)
                    $chosen = if (Test-Path $mwd) { $mwd } else { $dat }
                    $obj = [pscustomobject]@{ index='XMASTER'; record=$i; symbol=$symbol; description=$desc; file_number=$fileNo; period=$period; data_file=$chosen; exists=(Test-Path $chosen) }
                    $found += $obj
                    $obj | Format-List | Out-String | Write-Host
                }
            }
            if (-not ($found | Where-Object {$_.index -eq 'XMASTER'})) { Write-Host 'FPT not found in XMASTER.' -ForegroundColor Yellow }
        }
    } catch { Write-Host ('XMASTER parse ERROR: ' + $_.Exception.Message) -ForegroundColor Red }
}

Write-Host ''
Write-Host '--- RAW ASCII SEARCH IN INDEX FILES ---' -ForegroundColor DarkCyan
foreach ($p in @($master,$emaster,$xmaster)) {
    if (Test-Path $p) {
        try {
            [byte[]]$b = [IO.File]::ReadAllBytes($p)
            $txt = [System.Text.Encoding]::ASCII.GetString($b)
            $pos = $txt.IndexOf($Target, [StringComparison]::OrdinalIgnoreCase)
            Write-Host ((Split-Path $p -Leaf) + ': position=' + $pos)
        } catch { Write-Host ((Split-Path $p -Leaf) + ': ERROR ' + $_.Exception.Message) }
    }
}

Write-Host ''
Write-Host '--- RESULT ---' -ForegroundColor DarkCyan
if ($found.Count -gt 0) {
    $found | Format-Table index,symbol,file_number,period,exists,data_file -AutoSize
} else {
    Write-Host 'Chua map duoc FPT tu EMASTER/XMASTER.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Probe chi doc file, KHONG sua/xoa du lieu.' -ForegroundColor Cyan
Write-Host 'Nhan Enter de dong.'
[void](Read-Host)
