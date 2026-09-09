$ErrorActionPreference = 'Stop'

$FilePath = 'D:\DataTick\eod\F95.DAT'
$Fields = 7
$RecordSize = $Fields * 4

function Convert-Mbf4ToSingle([byte[]]$b) {
    if ($b.Count -ne 4) { throw 'MBF value must contain 4 bytes' }
    if (($b[0] -bor $b[1] -bor $b[2] -bor $b[3]) -eq 0) { return 0.0 }

    [uint16]$man = [BitConverter]::ToUInt16($b, 2)
    if ($man -eq 0) { return 0.0 }

    [int]$exp = ([int]($man -band 0xFF00)) - 0x0200
    [int]$m = ([int]($man -band 0x007F)) -bor (([int]$man -shl 8) -band 0x8000)
    $m = $m -bor ($exp -shr 1)

    $ieee = New-Object byte[] 4
    $ieee[0] = $b[0]
    $ieee[1] = $b[1]
    $ieee[2] = [byte]($m -band 0xFF)
    $ieee[3] = [byte](($m -shr 8) -band 0xFF)
    return [BitConverter]::ToSingle($ieee, 0)
}

function Convert-MsDate($value) {
    $n = [int][Math]::Round([double]$value)
    if ($n -le 0) { return '' }
    $yy = [int]($n / 10000)
    $mm = [int](($n % 10000) / 100)
    $dd = [int]($n % 100)
    $yyyy = 1900 + $yy
    if ($yyyy -lt 1950) { $yyyy += 100 }
    try { return (Get-Date -Year $yyyy -Month $mm -Day $dd -Hour 0 -Minute 0 -Second 0).ToString('yyyy-MM-dd') }
    catch { return "RAW:$n" }
}

Write-Host '=== VO HOANG METASTOCK FPT READER PROBE ===' -ForegroundColor Cyan
Write-Host ('File: ' + $FilePath)
Write-Host ('Exists: ' + (Test-Path $FilePath))
if (-not (Test-Path $FilePath)) { exit 1 }

$bytes = [IO.File]::ReadAllBytes($FilePath)
Write-Host ('Length: ' + $bytes.Length)
Write-Host ('Fields: ' + $Fields)
Write-Host ('Record size: ' + $RecordSize)

# F95.DAT length is exactly divisible by 28. Legacy MetaStock DAT commonly uses one record-sized header.
$headerSize = $RecordSize
$dataBytes = $bytes.Length - $headerSize
$recordCount = [int]($dataBytes / $RecordSize)
Write-Host ('Header size assumed: ' + $headerSize)
Write-Host ('Record count inferred: ' + $recordCount)

if (($dataBytes % $RecordSize) -ne 0) {
    Write-Host ('WARNING: data section is not aligned to record size; remainder=' + ($dataBytes % $RecordSize)) -ForegroundColor Yellow
}

$start = [Math]::Max(0, $recordCount - 8)
$rows = @()
for ($r = $start; $r -lt $recordCount; $r++) {
    $offset = $headerSize + ($r * $RecordSize)
    $vals = @()
    for ($f = 0; $f -lt $Fields; $f++) {
        $chunk = New-Object byte[] 4
        [Array]::Copy($bytes, $offset + ($f * 4), $chunk, 0, 4)
        $vals += Convert-Mbf4ToSingle $chunk
    }
    $rows += [pscustomobject]@{
        record = $r
        raw_date = $vals[0]
        date = Convert-MsDate $vals[0]
        open = $vals[1]
        high = $vals[2]
        low = $vals[3]
        close = $vals[4]
        volume = $vals[5]
        open_interest = $vals[6]
    }
}

Write-Host ''
Write-Host '--- LAST RECORDS ---' -ForegroundColor DarkCyan
$rows | Format-Table -AutoSize

$last = $rows | Select-Object -Last 1
Write-Host ''
Write-Host '--- LAST RECORD JSON ---' -ForegroundColor DarkCyan
$last | ConvertTo-Json -Compress | Write-Host

Write-Host ''
Write-Host 'Probe chi doc file, KHONG sua/xoa du lieu.' -ForegroundColor Cyan
Write-Host 'Nhan Enter de dong.'
[void](Read-Host)
