$ErrorActionPreference = 'Stop'

Write-Host 'VO HOANG - Setup SSI FastConnect Market Data' -ForegroundColor Cyan
Write-Host 'Chi dung Market Data, khong can OTP giao dich.' -ForegroundColor DarkGray
Write-Host ''

$clientId = Read-Host 'SSI Client ID'
$apiKey = Read-Host 'SSI API Key'
$secretSecure = Read-Host 'SSI API Secret' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretSecure)
try { $apiSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

if ([string]::IsNullOrWhiteSpace($clientId) -or [string]::IsNullOrWhiteSpace($apiKey) -or [string]::IsNullOrWhiteSpace($apiSecret)) {
    Write-Host 'Thieu thong tin. Khong thay doi cau hinh.' -ForegroundColor Red
    exit 2
}

[Environment]::SetEnvironmentVariable('VH_SSI_CLIENT_ID', $clientId, 'User')
[Environment]::SetEnvironmentVariable('VH_SSI_API_KEY', $apiKey, 'User')
[Environment]::SetEnvironmentVariable('VH_SSI_API_SECRET', $apiSecret, 'User')

Write-Host 'Da luu credentials vao User Environment Variables cua Windows.' -ForegroundColor Green
Write-Host 'Khong ghi credentials vao GitHub/source code.' -ForegroundColor Green
Write-Host ''
Write-Host 'Tiep theo chay lai .\run-amibridge.cmd' -ForegroundColor Cyan
