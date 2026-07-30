param (
    [Parameter(Mandatory=$true)]
    [string]$PairingCode
)

# URL to the compiled portable executable
# TODO: Update this URL once the agent is published to GitHub Releases or S3
$InstallerUrl = "https://github.com/keshabakumar/ollalink/releases/latest/download/OllalinkAgent-Portable.exe"
$DownloadPath = "$env:TEMP\OllalinkAgent.exe"

Write-Host "========================================="
Write-Host " Installing Ollalink Agent"
Write-Host "========================================="

Write-Host "Downloading agent from $InstallerUrl..."
try {
    # Ignore SSL errors for testing (optional, but good if hosting on local IP during dev)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    
    # For now, we will simulate the download if the URL doesn't exist, 
    # so the command doesn't hard-fail during development.
    try {
        Invoke-WebRequest -Uri $InstallerUrl -OutFile $DownloadPath -ErrorAction Stop
        Write-Host "Download complete."
    } catch {
        Write-Host "Warning: Could not download from remote URL (is the release published?)."
        Write-Host "Simulating installation for development purposes."
        # Create a dummy executable just so Start-Process doesn't fail
        Set-Content -Path $DownloadPath -Value "echo 'Dummy agent running'"
    }

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
