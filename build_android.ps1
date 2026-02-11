Write-Host "Resetting Windows ACLs..."
icacls . /reset /T /C /Q
attrib -r /s /d .

# Temporarily rename .git to force EAS to use raw filesystem
if (Test-Path ".git") {
    Write-Host "Temporarily hiding .git folder to bypass git-archive..."
    Rename-Item ".git" ".git_hidden"
}

try {
    Write-Host "Starting EAS Build..."
    # npx expo export --platform android # Optional: pre-build check
    eas build --platform android
}
finally {
    if (Test-Path ".git_hidden") {
        Write-Host "Restoring .git folder..."
        Rename-Item ".git_hidden" ".git"
    }
}
