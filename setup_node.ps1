# setup_node.ps1
# This script sets up a portable Node.js environment in the workspace.

$ErrorActionPreference = "Stop"

$nodeDir = Join-Path $pwd ".node"
$zipPath = Join-Path $nodeDir "node.zip"

if (-not (Test-Path $nodeDir)) {
    Write-Host "Creating .node directory..."
    New-Item -ItemType Directory -Path $nodeDir | Out-Null
}

$nodeExePath = Join-Path $nodeDir "node-v20.15.0-win-x64\node.exe"
$npmCmdPath = Join-Path $nodeDir "node-v20.15.0-win-x64\npm.cmd"

if (-not (Test-Path $nodeExePath)) {
    Write-Host "Downloading portable Node.js v20.15.0..."
    # Using Invoke-WebRequest to download Node.js
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.15.0/node-v20.15.0-win-x64.zip" -OutFile $zipPath
    Write-Host "Extracting Node.js zip..."
    Expand-Archive -Path $zipPath -DestinationPath $nodeDir
    Write-Host "Cleaning up zip file..."
    Remove-Item $zipPath
} else {
    Write-Host "Node.js portable is already downloaded and extracted."
}

Write-Host "Running npm install..."
# We run npm install using our portable npm
& $npmCmdPath install

Write-Host "Node.js environment setup complete!"
