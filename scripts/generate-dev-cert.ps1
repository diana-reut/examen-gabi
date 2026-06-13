$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $projectRoot "certificates"
$opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
$keyPath = Join-Path $certDir "dev-key.pem"
$certPath = Join-Path $certDir "dev-cert.pem"

if (-not (Test-Path $opensslPath)) {
  throw "OpenSSL was not found at '$opensslPath'. Install Git for Windows or OpenSSL first."
}

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

& $opensslPath req -x509 -newkey rsa:2048 -sha256 -nodes `
  -keyout $keyPath `
  -out $certPath `
  -days 365 `
  -subj "/CN=localhost"

Write-Host "Created HTTPS development certificate:"
Write-Host "  Key : $keyPath"
Write-Host "  Cert: $certPath"
