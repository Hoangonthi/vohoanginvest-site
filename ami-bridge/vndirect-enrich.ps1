# Realtime market metrics from the VNDIRECT free MI feed.
# Used for GT (gia tri giao dich) and breadth on the primary Vietnam indexes.

$script:VndirectLastStatus = 'not-run'
$script:VndirectLastError = $null

function Get-PythonCommand-Vndirect {
    foreach ($ver in @('3.13','3.12','3.11')) {
        try {
            $null = & py -$ver --version 2>$null
            if ($LASTEXITCODE -eq 0) { return @('py',('-' + $ver)) }
        } catch {}
    }
    try {
        $null = & python --version 2>$null
        if ($LASTEXITCODE -eq 0) { return @('python') }
    } catch {}
    return @()
}

function Test-VndirectAvailable {
    $py = Get-PythonCommand-Vndirect
    if ($py.Count -eq 0) { return $false }
    try {
        if ($py.Count -eq 2) { & $py[0] $py[1] -c "import paho.mqtt.client" 2>$null | Out-Null }
        else { & $py[0] -c "import paho.mqtt.client" 2>$null | Out-Null }
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

function Invoke-VndirectMarketSummary {
    $script:VndirectLastStatus = 'starting'
    $script:VndirectLastError = $null

    if (-not (Test-VndirectAvailable)) {
        $script:VndirectLastStatus = 'unavailable'
        return $null
    }

    $scriptPath = Join-Path $PSScriptRoot 'vndirect-market-probe.py'
    if (-not (Test-Path $scriptPath)) {
        $script:VndirectLastStatus = 'script-missing'
        return $null
    }

    $py = Get-PythonCommand-Vndirect
    $outFile = Join-Path $env:TEMP ('vh-vndirect-' + [Guid]::NewGuid().ToString('N') + '.out')
    $errFile = Join-Path $env:TEMP ('vh-vndirect-' + [Guid]::NewGuid().ToString('N') + '.err')

    try {
        $exe = $py[0]
        $args = @()
        if ($py.Count -eq 2) { $args += $py[1] }
        $args += $scriptPath

        $p = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
        if (-not $p.WaitForExit(15000)) {
            try { $p.Kill() } catch {}
            $script:VndirectLastStatus = 'timeout'
            $script:VndirectLastError = 'VNDIRECT feed exceeded 15 seconds'
            return $null
        }

        $txt = if (Test-Path $outFile) { Get-Content -LiteralPath $outFile -Raw -ErrorAction SilentlyContinue } else { '' }
        $errTxt = if (Test-Path $errFile) { Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue } else { '' }
        if ([string]::IsNullOrWhiteSpace($txt)) {
            $script:VndirectLastStatus = 'empty'
            $script:VndirectLastError = $errTxt
            return $null
        }

        # Keep only the last JSON-looking line in case a dependency prints a notice.
        $jsonLine = @($txt -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') }) | Select-Object -Last 1
        if ([string]::IsNullOrWhiteSpace($jsonLine)) { $jsonLine = $txt }
        $obj = $jsonLine | ConvertFrom-Json

        if ($obj.ok -and $obj.rows) {
            $script:VndirectLastStatus = 'ok'
        } else {
            $script:VndirectLastStatus = 'feed-error'
            $script:VndirectLastError = $obj.error
        }
        return $obj
    } catch {
        $script:VndirectLastStatus = 'exception'
        $script:VndirectLastError = $_.Exception.Message
        return $null
    } finally {
        Remove-Item -LiteralPath $outFile,$errFile -Force -ErrorAction SilentlyContinue
    }
}

function Apply-VndirectMarketSummary($data) {
    $api = Invoke-VndirectMarketSummary
    if ($null -eq $api -or -not $api.ok -or $null -eq $api.rows) { return $data }

    $applied = 0
    $valueApplied = 0
    foreach ($row in @($api.rows)) {
        $idx = @($data.indexes | Where-Object { $_.symbol -eq $row.symbol }) | Select-Object -First 1
        if ($null -eq $idx) { continue }

        if ($null -ne $row.total_value_traded) {
            try {
                $gt = [double]$row.total_value_traded
                if ($gt -gt 0) {
                    $idx.value_b = [Math]::Round($gt, 3)
                    $idx | Add-Member -NotePropertyName total_value_b -NotePropertyValue ([Math]::Round($gt, 3)) -Force
                    $idx | Add-Member -NotePropertyName value_source -NotePropertyValue 'VNDIRECT realtime MI / totalValueTraded' -Force
                    $valueApplied++
                }
            } catch {}
        }

        if ($null -ne $row.advance) { $idx.adv = [int]$row.advance }
        if ($null -ne $row.no_change) { $idx.flat = [int]$row.no_change }
        if ($null -ne $row.decline) { $idx.dec = [int]$row.decline }
        if ($null -ne $row.advance -and $null -ne $row.no_change -and $null -ne $row.decline) {
            $idx | Add-Member -NotePropertyName breadth_source -NotePropertyValue 'VNDIRECT realtime MI' -Force
        }
        $idx | Add-Member -NotePropertyName market_metrics_time -NotePropertyValue $row.trading_time -Force
        $applied++
    }

    if ($applied -gt 0) {
        $data | Add-Member -NotePropertyName market_metrics_provider -NotePropertyValue 'VNDIRECT realtime MI' -Force
        $data | Add-Member -NotePropertyName market_metrics_applied -NotePropertyValue $applied -Force
        $data | Add-Member -NotePropertyName market_value_applied -NotePropertyValue $valueApplied -Force
    }
    return $data
}
