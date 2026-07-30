param (
    [Parameter(Mandatory=$true)]
    [string]$PairingCode
)

# URL to the compiled portable executable (automatically built via GitHub Actions)
$InstallerUrl = "https://github.com/keshabakumar/ollalink/releases/download/latest/OllalinkAgent.exe"
$DownloadPath = "$env:TEMP\OllalinkAgent.exe"

Write-Host "========================================="
Write-Host " Installing Ollalink Agent"
Write-Host "========================================="

Write-Host "Downloading agent from $InstallerUrl..."
try {
    # Ignore SSL errors for testing (optional, but good if hosting on local IP during dev)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    # Fail if the URL doesn't exist yet
    Invoke-WebRequest -Uri $InstallerUrl -OutFile $DownloadPath -ErrorAction Stop
    Write-Host "Download complete."

    Write-Host "Starting agent and applying pairing code..."
    
    # Run the portable executable and pass the pairing code
    # This matches the argument parsing we added to preload.cjs
    Start-Process -FilePath $DownloadPath -ArgumentList "--pairing-code $PairingCode" -NoNewWindow

    Write-Host ""
    Write-Host "========================================="
    Write-Host " Installation Successful!"
    Write-Host " The agent should now appear in your dashboard."
    Write-Host "========================================="
} catch {
    Write-Error "Failed to install agent: $_"
}
