$ErrorActionPreference='Continue'
Write-Host 'VO HOANG - WatchList Membership Probe' -ForegroundColor Cyan
$root='D:\AmiBroker\eod\WatchLists'
if(-not(Test-Path $root)){Write-Host 'Khong thay WatchLists'; exit 1}
Write-Host "Root: $root"
$files=Get-ChildItem -Path $root -Recurse -File | Sort-Object FullName
Write-Host "`n=== FILES ==="
$files | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize
Write-Host "`n=== TEXT CONTENT (SMALL/TEXT-LIKE FILES) ==="
foreach($f in $files){
  if($f.Length -le 200000 -and $f.Extension -match '^\.(txt|tls|lst|csv|dat)?$'){
    try{
      $txt=[IO.File]::ReadAllText($f.FullName)
      if($txt -match '[A-Za-z0-9]'){
        Write-Host "--- $($f.FullName) ---" -ForegroundColor Yellow
        $lines=$txt -split "`r?`n"
        $lines | Select-Object -First 500 | ForEach-Object { $_ }
      }
    }catch{}
  }
}
Write-Host "`n=== LIKELY VN30 / CHI SO / WL FILES ==="
$files | Where-Object { $_.Name -match '(?i)vn30|chi.?so|index|wl' -or $_.DirectoryName -match '(?i)vn30|chi.?so|index|wl' } | Select-Object FullName,Length | Format-Table -AutoSize
Write-Host "`nProbe xong. Gui toan bo output cho ChatGPT."