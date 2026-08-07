# Sets the JWKS env var on Convex prod with proper JSON quotes preserved.
# Usage:  powershell -ExecutionPolicy Bypass -File set-jwks.ps1

$v = (Get-Content -Raw 'D:\ollalink\archive\convex-ready-template-main\convex-ready-template-main\tmp\jwks').Trim()
Write-Host "JWKS value: $v"

Set-Location 'D:\ollalink\archive\convex-ready-template-main\convex-ready-template-main\packages\backend'

# Use the call operator with the value quoted so quotes survive arg parsing
& npx convex env set JWKS --prod -- ('"' + $v + '"')

Write-Host "Done. Exit code: $LASTEXITCODE"