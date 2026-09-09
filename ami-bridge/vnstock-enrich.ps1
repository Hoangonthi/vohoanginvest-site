# API-first enrichment using Vnstock Unified UI.
# Guest mode is enough for a few index requests per minute.

function Get-PythonCommand-Vnstock {
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

function Test-VnstockAvailable {
    $py = Get-PythonCommand-Vnstock
    if ($py.Count -eq 0) { return $false }
    try {
        if ($py.Count -eq 2) { & $py[0] $py[1] -c "import vnstock" 2>$null | Out-Null }
        else { & $py[0] -c "import vnstock" 2>$null | Out-Null }
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Invoke-VnstockMarketSummary {
    if (-not (Test-VnstockAvailable)) { return $null }
    $scriptPath = Join-Path $PSScriptRoot 'vnstock-market-summary.py'
    if (-not (Test-Path $scriptPath)) { return $null }
    $py = Get-PythonCommand-Vnstock
    try {
        if ($py.Count -eq 2) { $raw = & $py[0] $py[1] $scriptPath 2>$null }
        else { $raw = & $py[0] $scriptPath 2>$null }
        $txt = ($raw -join "`n")
        if ([string]::IsNullOrWhiteSpace($txt)) { return $null }
        return ($txt | ConvertFrom-Json)
    } catch { return $null }
}

function Convert-VndToBillions($value) {
    if ($null -eq $value) { return $null }
    try { return [Math]::Round(([double]$value / 1000000000.0), 3) } catch { return $null }
}

function Apply-VnstockSummary($data) {
    $api = Invoke-VnstockMarketSummary
    if ($null -eq $api -or -not $api.ok -or $null -eq $api.summaries) { return $data }

    $applied = 0
    foreach ($row in @($api.summaries)) {
        if (-not $row.ok) { continue }
        $idx = @($data.indexes | Where-Object { $_.symbol -eq $row.symbol }) | Select-Object -First 1
        if ($null -eq $idx) { continue }

        # Website GT = matched trading value, which is the standard board-style traded value.
        $valueB = Convert-VndToBillions $row.matched_value
        if ($null -ne $valueB -and $valueB -gt 0) {
            $idx.value_b = $valueB
            $idx | Add-Member -NotePropertyName value_source -NotePropertyValue 'Vnstock public API / index trade_history / matched_value' -Force
        }
        $idx | Add-Member -NotePropertyName total_value_b -NotePropertyValue (Convert-VndToBillions $row.total_value) -Force
        $idx | Add-Member -NotePropertyName api_matched_volume_m -NotePropertyValue ($(if ($null -ne $row.matched_volume) { [Math]::Round(([double]$row.matched_volume / 1000000.0),3) } else { $null })) -Force
        $idx | Add-Member -NotePropertyName api_total_volume_m -NotePropertyValue ($(if ($null -ne $row.total_volume) { [Math]::Round(([double]$row.total_volume / 1000000.0),3) } else { $null })) -Force

        # Official summary breadth from API has priority over locally reconstructed breadth.
        if ($null -ne $row.advance) { $idx.adv = [int]$row.advance }
        if ($null -ne $row.steady) { $idx.flat = [int]$row.steady }
        if ($null -ne $row.decline) { $idx.dec = [int]$row.decline }
        if ($null -ne $row.ceiling) { $idx | Add-Member -NotePropertyName ceiling -NotePropertyValue ([int]$row.ceiling) -Force }
        if ($null -ne $row.floor) { $idx | Add-Member -NotePropertyName floor -NotePropertyValue ([int]$row.floor) -Force }
        $idx | Add-Member -NotePropertyName breadth_source -NotePropertyValue 'Vnstock public API / index trade_history' -Force
        $idx | Add-Member -NotePropertyName market_api_date -NotePropertyValue $row.trading_date -Force
        $applied++
    }

    if ($applied -gt 0) {
        $data | Add-Member -NotePropertyName market_metrics_provider -NotePropertyValue 'Vnstock public API' -Force
        $data | Add-Member -NotePropertyName market_metrics_applied -NotePropertyValue $applied -Force
    }
    return $data
}
