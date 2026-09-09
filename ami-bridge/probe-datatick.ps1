$ErrorActionPreference = 'Continue'

$Root = 'D:\DataTick'
Write-Host '=== VO HOANG DATATICK PROBE ===' -ForegroundColor Cyan
Write-Host ('Path: ' + $Root)
Write-Host ('Exists: ' + (Test-Path $Root))

if (-not (Test-Path $Root)) {
    Write-Host 'D:\DataTick khong ton tai.' -ForegroundColor Red
    Read-Host 'Nhan Enter de dong'
    exit 1
}

Write-Host ''
Write-Host '--- TOP LEVEL ---' -ForegroundColor DarkCyan
Get-ChildItem -LiteralPath $Root -Force | Sort-Object PSIsContainer,Name | Select-Object Mode,Length,LastWriteTime,Name | Format-Table -AutoSize

Write-Host ''
Write-Host '--- METASTOCK-LIKE FILES ---' -ForegroundColor DarkCyan
$patterns = @('MASTER','EMASTER','XMASTER','*.DAT','*.MWD','*.DOP','*.MST','*.CSV','*.TXT')
$hits = @()
foreach ($p in $patterns) {
    try { $hits += Get-ChildItem -LiteralPath $Root -Recurse -Force -File -Filter $p -ErrorAction SilentlyContinue } catch {}
}
$hits = $hits | Sort-Object FullName -Unique
if ($hits.Count -eq 0) {
    Write-Host 'Khong tim thay file MetaStock thong dung.' -ForegroundColor Yellow
} else {
    $hits | Select-Object -First 200 @{n='RelativePath';e={$_.FullName.Substring($Root.Length).TrimStart('\')}},Length,LastWriteTime | Format-Table -AutoSize
}

Write-Host ''
Write-Host '--- FPT NAME SEARCH ---' -ForegroundColor DarkCyan
$fpt = Get-ChildItem -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)FPT' } | Select-Object -First 100 FullName,Length,LastWriteTime
if ($fpt) { $fpt | Format-Table -AutoSize } else { Write-Host 'Khong co ten file/folder chua FPT.' -ForegroundColor Yellow }

Write-Host ''
Write-Host '--- SUMMARY ---' -ForegroundColor DarkCyan
try { $allFiles = Get-ChildItem -LiteralPath $Root -Recurse -Force -File -ErrorAction SilentlyContinue } catch { $allFiles = @() }
Write-Host ('Total files: ' + $allFiles.Count)
if ($allFiles.Count -gt 0) {
    $ext = $allFiles | Group-Object Extension | Sort-Object Count -Descending | Select-Object -First 20 @{n='Extension';e={if([string]::IsNullOrWhiteSpace($_.Name)){'<none>'}else{$_.Name}}},Count
    $ext | Format-Table -AutoSize
}

Write-Host ''
Write-Host 'Probe xong. KHONG sua/xoa bat ky file nao.' -ForegroundColor Green
[void](Read-Host 'Nhan Enter de dong')
