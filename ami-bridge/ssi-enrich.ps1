# Optional SSI FastConnect enrichment for exact market traded value and official breadth.
# No credentials are stored in source. Reads User-level environment variables only.

function Get-UserEnv([string]$name) {
    $v = [Environment]::GetEnvironmentVariable($name, 'User')
    if ([string]::IsNullOrWhiteSpace($v)) { $v = [Environment]::GetEnvironmentVariable($name, 'Process') }
    return $v
}

function Test-SsiConfigured {
    return -not [string]::IsNullOrWhiteSpace((Get-UserEnv 'VH_SSI_CLIENT_ID')) -and
           -not [string]::IsNullOrWhiteSpace((Get-UserEnv 'VH_SSI_API_KEY')) -and
           -not [string]::IsNullOrWhiteSpace((Get-UserEnv 'VH_SSI_API_SECRET'))
}

function Get-PythonCommand {
    try {
        $null = & py -3 --version 2>$null
        if ($LASTEXITCODE -eq 0) { return @('py','-3') }
    } catch {}
    try {
        $null = & python --version 2>$null
        if ($LASTEXITCODE -eq 0) { return @('python') }
    } catch {}
    return @()
}

function Invoke-SsiMarketSummary {
    if (-not (Test-SsiConfigured)) { return $null }
    $scriptPath = Join-Path $PSScriptRoot 'ssi-market-summary.py'
    if (-not (Test-Path $scriptPath)) { return $null }
    $py = Get-PythonCommand
    if ($py.Count -eq 0) { return $null }

    $env:VH_SSI_CLIENT_ID = Get-UserEnv 'VH_SSI_CLIENT_ID'
    $env:VH_SSI_API_KEY = Get-UserEnv 'VH_SSI_API_KEY'
    $env:VH_SSI_API_SECRET = Get-UserEnv 'VH_SSI_API_SECRET'

    try {
        if ($py.Count -eq 2) { $raw = & $py[0] $py[1] $scriptPath 2>$null }
        else { $raw = & $py[0] $scriptPath 2>$null }
        if ([string]::IsNullOrWhiteSpace(($raw -join ''))) { return $null }
        return (($raw -join "`n") | ConvertFrom-Json)
    } catch { return $null }
}

function Convert-ValueToBillions($value) {
    if ($null -eq $value) { return $null }
    try { return [Math]::Round(([double]$value / 1000000000.0), 3) } catch { return $null }
}

function Apply-SsiSummary($data) {
    $ssi = Invoke-SsiMarketSummary
    if ($null -eq $ssi -or -not $ssi.ok -or $null -eq $ssi.summaries) { return $data }

    foreach ($row in @($ssi.summaries)) {
        if (-not $row.ok) { continue }
        $idx = @($data.indexes | Where-Object { $_.symbol -eq $row.symbol }) | Select-Object -First 1
        if ($null -eq $idx) { continue }

        # Exact total traded value from SSI MarketIndexSummary, converted VND -> billion VND.
        $valueB = Convert-ValueToBillions $row.total_trade_value
        if ($null -ne $valueB) { $idx.value_b = $valueB }

        # Prefer provider summary breadth when present; otherwise retain DataTick-derived breadth.
        if ($null -ne $row.advance) { $idx.adv = [int]$row.advance }
        if ($null -ne $row.steady) { $idx.flat = [int]$row.steady }
        if ($null -ne $row.decline) { $idx.dec = [int]$row.decline }

        $idx | Add-Member -NotePropertyName total_match_value_b -NotePropertyValue (Convert-ValueToBillions $row.total_match_value) -Force
        $idx | Add-Member -NotePropertyName ceiling -NotePropertyValue $row.ceiling -Force
        $idx | Add-Member -NotePropertyName floor -NotePropertyValue $row.floor -Force
        $idx | Add-Member -NotePropertyName prop_buy_value_b -NotePropertyValue (Convert-ValueToBillions $row.prop_buy_value) -Force
        $idx | Add-Member -NotePropertyName prop_sell_value_b -NotePropertyValue (Convert-ValueToBillions $row.prop_sell_value) -Force
        $idx | Add-Member -NotePropertyName value_source -NotePropertyValue 'SSI FastConnect MarketIndexSummary' -Force
        $idx | Add-Member -NotePropertyName breadth_source -NotePropertyValue 'SSI FastConnect MarketIndexSummary' -Force
    }
    $data | Add-Member -NotePropertyName value_provider -NotePropertyValue 'SSI FastConnect' -Force
    return $data
}
