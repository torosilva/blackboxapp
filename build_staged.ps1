$source = "c:\Users\mario\.gemini\antigravity\scratch\AiDiaryApp"
$dest = "c:\Users\mario\.gemini\antigravity\scratch\AiDiaryApp_Staging"

# Ensure we are in the source directory context if not hardcoded, but hardcoding is safer for this 'rescue' script
Set-Location $source

Write-Host "Creating clean staging area at $dest..."
# Exclude .git, node_modules, .expo, and the staging dir itself
robocopy $source $dest /MIR /XD .git node_modules .expo .idea .vscode $dest

if ($LASTEXITCODE -gt 7) {
    Write-Host "Robocopy failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "Resetting attributes in staging..."
Set-Location $dest
attrib -r /s /d .

Write-Host "Installing dependencies in staging (Ensures clean config)..."
# Use legacy peer deps as identified earlier
$env:NPM_CONFIG_LEGACY_PEER_DEPS = "1"
npm install

Write-Host "Starting EAS Build from Staging..."
# Initialize a temp git repo just to satisfy EAS CLI requirements (it might complain if no git)
git init
git add .
git commit -m "Staging build"

eas build --platform android
