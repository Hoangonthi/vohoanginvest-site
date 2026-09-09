# VO HOANG - extra index enrichment
# 1) Try public Fiin/SSI market-summary endpoint for traded value and official counters.
# 2) If breadth is still missing, reconstruct it from matching AmiBroker watchlists.

$script:ExtraIndexLastStatus = 'not-run'

$IndexCodeMap = [ordered]@{
    'VN-INDEX'     = 'VNINDEX'
    'VN30'         = 'VN30'
    'VN100'        = 'VN100'
    'VNALL'        = 'VNALL'
    'VNXALL'       = 'VNXALL'
    'VNMidcap'     = 'VNMID'
    'VNSmallcap'   = 'VNSML'
    'VNDIAMOND'    = 'VNDIAMOND'
    'VNFIN LEAD'   = 'VNFINLEAD'
    'VNFIN SELECT' = 'VNFINSELECT'
    'VNFIN'        = 'VNFIN'
    'VNREAL'       = 'VNREAL'
    'VNIND'        = 'VNIND'
    'VNIT'         = 'VNIT'
    'VNMAT'        = 'VNMAT'
    'VNCONS'       = 'VNCONS'
    'VNCOND'       = 'VNCOND'
    'VNENE'        = 'VNENE'
    'VNHEAL'       = 'VNHEAL'
    'VNUTI'        = 'VNUTI'
    'VNSI'         = 'VNSI'
    'HNX-INDEX'    = 'HNXIndex'
    'HNX30'        = 'HNX30'
    'UPCOM-INDEX'  = 'UpcomIndex'
}

$IndexWatchAliases = [ordered]@{
    'VN30'         = @('VN30')
    'VN100'        = @('VN100')
    'VNALL'        = @('VNALL','VNALLSHARE','VN ALL','VN ALL SHARE')
    'VNXALL'       = @('VNXALL','VNXALLSHARE','VNX ALL','VNX ALL SHARE')
    'VNMidcap'     = @('VNMID','VNMIDCAP','VN MID','VN MIDCAP')
    'VNSmallcap'   = @('VNSML','VNSMALLCAP','VN SMALL','VN SMALLCAP')
    'VNDIAMOND'    = @('VNDIAMOND','VN DIAMOND')
    'VNFIN LEAD'   = @('VNFINLEAD','VNFIN LEAD','VN FIN LEAD')
    'VNFIN SELECT' = @('VNFINSELECT','VNFIN SELECT','VN FIN SELECT')
    'VNFIN'        = @('VNFIN','VN FIN')
    'VNREAL'       = @('VNREAL','VN REAL')
    'VNIND'        = @('VNIND','VN IND')
    'VNIT'         = @('VNIT','VN IT')
    'VNMAT'        = @('VNMAT','VN MAT')
    'VNCONS'       = @('VNCONS','VN CONS')
    'VNCOND'       = @('VNCOND','VN COND')
    'VNENE'        = @('VNENE','VN ENE')
    'VNHEAL'       = @('VNHEAL','VN HEAL')
    'VNUTI'        = @('VNUTI','VN UTI')
    'VNSI'         = @('VNSI','VN SI')
    'HNX30'        = @('HNX30')
}

function Get-PropAny($obj, [string[]]$names) {
    if ($null -eq $obj) { return $null }
    foreach ($name in $names) {
        $p = $obj.PSObject.Properties | Where-Object { $_.Name -ieq $name } | Select-Object -First 1
        if ($null -ne $p -and $null -ne $p.Value -and "$($p.Value)" -ne '') { return $p.Value }
    }
    return $null
}

function Normalize-WatchName([string]$name) {
    if ($null -eq $name) { return '' }
    return (($name.ToUpperInvariant()) -replace '[^A-Z0-9]','')
}

function Find-WatchListSymbols([string[]]$aliases) {
    if (-not (Test-Path $WatchListRoot)) { return @() }
    $wanted = @($aliases | ForEach-Object { Normalize-WatchName $_ } | Select-Object -Unique)
    foreach ($file in @(Get-ChildItem -LiteralPath $WatchListRoot -Filter '*.tls' -File -ErrorAction SilentlyContinue)) {
        $base = [IO.Path]::GetFileNameWithoutExtension($file.Name)
        if ($wanted -contains (Normalize-WatchName $base)) {
            return @(Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue |
                ForEach-Object { $_.Trim().ToUpperInvariant() } |
                Where-Object { $_ -match '^[A-Z0-9._-]+$' } |
                Select-Object -Unique)
        }
    }
    return @()
}

function Apply-FiinLatestIndices($data) {
    $url = 'https://fiin-market.ssi.com.vn/MarketInDepth/GetLatestIndices?language=vi&pageSize=999999&status=1'
    try {
        $headers = @{
            'User-Agent'='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36'
            'Accept'='application/json, text/plain, */*'
            'Referer'='https://iboard.ssi.com.vn/'
        }
        $resp = Invoke-RestMethod -UseBasicParsing -Uri $url -Headers $headers -Method Get -TimeoutSec 6
        $items = @($resp.items)
        if ($items.Count -lt 1) { $script:ExtraIndexLastStatus='fiin-empty'; return $data }
        $applied = 0
        foreach ($uiSymbol in $IndexCodeMap.Keys) {
            $code = $IndexCodeMap[$uiSymbol]
            $row = @($items | Where-Object {
                $c = Get-PropAny $_ @('comGroupCode','code','symbol')
                $null -ne $c -and ("$c" -ieq $code)
            }) | Select-Object -First 1
            if ($null -eq $row) { continue }
            $idx = @($data.indexes | Where-Object { $_.symbol -eq $uiSymbol }) | Select-Object -First 1
            if ($null -eq $idx) { continue }

            $matchValue = Get-PropAny $row @('matchValue','totalMatchValue','matchedValue','totalValue')
            if ($null -ne $matchValue) {
                try {
                    $v = [double]$matchValue
                    if ($v -gt 0) {
                        $idx.value_b = [Math]::Round($v / 1000000000.0, 3)
                        $idx | Add-Member -NotePropertyName value_source -NotePropertyValue 'Fiin/SSI market summary' -Force
                    }
                } catch {}
            }

            $adv = Get-PropAny $row @('advance','advances','up','totalStockUpPrice','totalStockUp')
            $flat = Get-PropAny $row @('noChange','unchanged','steady','totalStockNoChangePrice','totalStockNoChange')
            $dec = Get-PropAny $row @('decline','declines','down','totalStockDownPrice','totalStockDown')
            try { if ($null -ne $adv) { $idx.adv = [int]$adv } } catch {}
            try { if ($null -ne $flat) { $idx.flat = [int]$flat } } catch {}
            try { if ($null -ne $dec) { $idx.dec = [int]$dec } } catch {}
            $ceiling = Get-PropAny $row @('ceiling','totalStockCeiling')
            $floor = Get-PropAny $row @('floor','totalStockFloor')
            try { if ($null -ne $ceiling) { $idx | Add-Member -NotePropertyName ceiling -NotePropertyValue ([int]$ceiling) -Force } } catch {}
            try { if ($null -ne $floor) { $idx | Add-Member -NotePropertyName floor -NotePropertyValue ([int]$floor) -Force } } catch {}
            $applied++
        }
        if ($applied -gt 0) {
            $script:ExtraIndexLastStatus='fiin-ok'
            $data | Add-Member -NotePropertyName extra_index_provider -NotePropertyValue 'Fiin/SSI public market summary' -Force
        } else { $script:ExtraIndexLastStatus='fiin-no-match' }
    } catch {
        $script:ExtraIndexLastStatus='fiin-error'
    }
    return $data
}

function Apply-WatchListBreadthAll($data) {
    foreach ($uiSymbol in $IndexWatchAliases.Keys) {
        if (-not (Needs-Breadth $data $uiSymbol)) { continue }
        try {
            $symbols = Find-WatchListSymbols $IndexWatchAliases[$uiSymbol]
            if ($symbols.Count -gt 0) {
                $b = Get-Breadth $symbols
                Set-Breadth $data $uiSymbol $b ('AmiBroker WatchList auto-match/' + $uiSymbol)
            }
        } catch {}
    }
    return $data
}

function Apply-IndexExtraEnrichment($data) {
    $data = Apply-FiinLatestIndices $data
    $data = Apply-WatchListBreadthAll $data
    return $data
}
