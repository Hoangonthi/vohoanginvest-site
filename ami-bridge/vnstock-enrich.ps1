# API-first enrichment using Vnstock Unified UI.
# Guest mode is enough for a few index requests per minute.

$script:VnstockLastStatus = 'not-run'
$script:VnstockLastError = $null

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
    $script:VnstockLastStatus = 'starting'
    $script:VnstockLastError = $null
    if (-not (Test-VnstockAvailable)) { $script:VnstockLastStatus='unavailable'; return $null }
    $scriptPath = Join-Path $PSScriptRoot 'vnstock-market-summary.py'
    if (-not (Test-Path $scriptPath)) { $script:VnstockLastStatus='script-missing'; return $null }
    $py = Get-PythonCommand-Vnstock

    $outFile = Join-Path $env:TEMP ('vh-vnstock-' + [Guid]::NewGuid().ToString('N') + '.out')
    $errFile = Join-Path $env:TEMP ('vh-vnstock-' + [Guid]::NewGuid().ToString('N') + '.err')
    try {
        $exe = $py[0]
        $args = @()
        if ($py.Count -eq 2) { $args += $py[1] }
        $args += $scriptPath
        $p = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
        if (-not $p.WaitForExit(12000)) {
            try { $p.Kill() } catch {}
            $script:VnstockLastStatus = 'timeout'
            $script:VnstockLastError = 'API call exceeded 12 seconds'
            return $null
        }
        $txt = if (Test-Path $outFile) { (Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue) } else { '' }
        $errTxt = if (Test-Path $errFile) { (Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue) } else { '' }
        if ([string]::IsNullOrWhiteSpace($txt)) {
            $script:VnstockLastStatus = 'empty'
            $script:VnstockLastError = $errTxt
            return $null
        }
        $obj = $txt | ConvertFrom-Json
        if ($obj.ok) { $script:VnstockLastStatus = 'ok' } else { $script:VnstockLastStatus = 'api-error'; $script:VnstockLastError = $obj.error }
        return $obj
    } catch {
        $script:VnstockLastStatus = 'exception'
        $script:VnstockLastError = $_.Exception.Message
        return $null
    } finally {
        Remove-Item -LiteralPath $outFile,$errFile -Force -ErrorAction SilentlyContinue
    }
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

        $valueB = Convert-VndToBillions $row.matched_value
        if ($null -ne $valueB -and $valueB -gt 0) {
            $idx.value_b = $valueB
            $idx | Add-Member -NotePropertyName value_source -NotePropertyValue 'Vnstock public API / index trade_history / matched_value' -Force
        }
        $idx | Add-Member -NotePropertyName total_value_b -NotePropertyValue (Convert-VndToBillions $row.total_value) -Force
        $idx | Add-Member -NotePropertyName api_matched_volume_m -NotePropertyValue ($(if ($null -ne $row.matched_volume) { [Math]::Round(([double]$row.matched_volume / 1000000.0),3) } else { $null })) -Force
        $idx | Add-Member -NotePropertyName api_total_volume_m -NotePropertyValue ($(if ($null -ne $row.total_volume) { [Math]::Round(([double]$row.total_volume / 1000000.0),3) } else { $null })) -Force

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
