# Commentary Local Source Probe — Phase 1B

READ ONLY tool for the Windows trading machine. It reads the existing AFL CSV, one local NDJSON session archive, and GETs selected symbols from the local `/stock/{symbol}` endpoint. It does not call Supabase, does not push data, does not modify AmiBroker, and writes only the requested audit JSON file.

Run exactly this from the repository root in Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\commentary-room\local-probe\commentary-local-source-probe.ps1 -ArchiveDate 2026-09-15 -OutputPath .\commentary-local-source-audit.json
```

Send `commentary-local-source-audit.json` back for the Phase 1B gap update. Until that file is inspected, `/stock` mappings for reference/ceiling/floor/O/H/L/value remain UNKNOWN by design.
