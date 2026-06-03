@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "REPO=SyroxXploits/Download-Shutdown-Guard"
set "GH=gh"
if exist "%ProgramFiles%\GitHub CLI\gh.exe" set "GH=%ProgramFiles%\GitHub CLI\gh.exe"
if exist "%LocalAppData%\Programs\GitHub CLI\gh.exe" set "GH=%LocalAppData%\Programs\GitHub CLI\gh.exe"

echo.
echo ===============================================
echo  Download Shutdown Guard - Build and Publish
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or not in PATH.
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: Git is not installed or not in PATH.
  exit /b 1
)

"%GH%" --version >nul 2>nul
if errorlevel 1 (
  echo ERROR: GitHub CLI is not installed or not in PATH.
  echo Install it from https://cli.github.com/ then run: gh auth login
  exit /b 1
)

"%GH%" auth status >nul 2>nul
if errorlevel 1 (
  echo ERROR: GitHub CLI is not logged in.
  echo Run: gh auth login
  exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "APP_VERSION=%%v"
if not defined APP_VERSION (
  echo ERROR: Could not read version from package.json.
  exit /b 1
)

for /f "usebackq delims=" %%b in (`"%GH%" repo view "%REPO%" --json defaultBranchRef -q ".defaultBranchRef.name"`) do set "DEFAULT_BRANCH=%%b"
if not defined DEFAULT_BRANCH set "DEFAULT_BRANCH=main"

set "TAG=v%APP_VERSION%"
set "RELEASE_TITLE=%APP_VERSION%"
set "PORTABLE_ASSET=dist\Download-Shutdown-Guard-%APP_VERSION%.exe"
set "SETUP_ASSET=dist\Download-Shutdown-Guard-Setup-%APP_VERSION%.exe"
set "BLOCKMAP_ASSET=dist\Download-Shutdown-Guard-Setup-%APP_VERSION%.exe.blockmap"
set "SOURCE_ZIP=dist\Download-Shutdown-Guard-Source-%APP_VERSION%.zip"
set "PUBLISH_TMP=%TEMP%\dsg-publish-%RANDOM%-%RANDOM%"
set "PUBLISH_CLONE=%PUBLISH_TMP%\repo"

echo Repository: %REPO%
echo Branch:     %DEFAULT_BRANCH%
echo Version:    %APP_VERSION%
echo Tag:        %TAG%
echo.

echo Cleaning previous build output...
if exist "out" rmdir /s /q "out"
if exist "dist" rmdir /s /q "dist"

echo.
echo Installing locked dependencies...
if exist "package-lock.json" (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 exit /b 1

echo.
echo Building installer and portable EXE...
call npm run package:win -- --publish never
if errorlevel 1 exit /b 1

echo.
echo Normalizing release asset names...
if exist "%PORTABLE_ASSET%" del /q "%PORTABLE_ASSET%"
if exist "%SETUP_ASSET%" del /q "%SETUP_ASSET%"
if exist "%BLOCKMAP_ASSET%" del /q "%BLOCKMAP_ASSET%"
copy /y "dist\Download Shutdown Guard %APP_VERSION%.exe" "%PORTABLE_ASSET%" >nul
if errorlevel 1 exit /b 1
copy /y "dist\Download Shutdown Guard Setup %APP_VERSION%.exe" "%SETUP_ASSET%" >nul
if errorlevel 1 exit /b 1
copy /y "dist\Download Shutdown Guard Setup %APP_VERSION%.exe.blockmap" "%BLOCKMAP_ASSET%" >nul
if errorlevel 1 exit /b 1

echo.
echo Creating source code archive asset...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root=(Resolve-Path '.').Path;" ^
  "$zip=(Join-Path $root '%SOURCE_ZIP%');" ^
  "$temp=Join-Path $env:TEMP ('dsg-source-' + [guid]::NewGuid());" ^
  "New-Item -ItemType Directory -Path $temp | Out-Null;" ^
  "$exclude=@('.git','node_modules','dist','out');" ^
  "Get-ChildItem -LiteralPath $root -Force | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $temp -Recurse -Force };" ^
  "Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $zip -Force;" ^
  "Remove-Item -LiteralPath $temp -Recurse -Force;"
if errorlevel 1 exit /b 1

echo.
echo Pushing updated source code and tag...
if exist "%PUBLISH_TMP%" rmdir /s /q "%PUBLISH_TMP%"
mkdir "%PUBLISH_TMP%"
git clone "https://github.com/%REPO%.git" "%PUBLISH_CLONE%"
if errorlevel 1 exit /b 1

robocopy "%CD%" "%PUBLISH_CLONE%" /MIR /XD ".git" "node_modules" "dist" "out" /XF ".env" ".env.*" >nul
set "ROBOCOPY_CODE=%ERRORLEVEL%"
if %ROBOCOPY_CODE% GEQ 8 (
  echo ERROR: Failed to copy source files into the temporary clone.
  exit /b 1
)

pushd "%PUBLISH_CLONE%"
git checkout "%DEFAULT_BRANCH%"
if errorlevel 1 exit /b 1
git config user.name "SyroxXploits"
git config user.email "SyroxXploits@users.noreply.github.com"
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Release %TAG%"
  if errorlevel 1 exit /b 1
  git push origin "%DEFAULT_BRANCH%"
  if errorlevel 1 exit /b 1
) else (
  echo No source changes to commit.
)
git tag -f "%TAG%"
git push origin "%TAG%" --force
if errorlevel 1 exit /b 1
popd

echo.
echo Waiting for GitHub Actions tag build to finish before uploading assets...
set "GH_EXE=%GH%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$gh=$env:GH_EXE; $repo=$env:REPO; $tag=$env:TAG;" ^
  "$deadline=(Get-Date).AddMinutes(20); $seen=$false;" ^
  "do {" ^
  "  $runs=@(& $gh run list --repo $repo --branch $tag --limit 10 --json databaseId,status,conclusion | ConvertFrom-Json);" ^
  "  if ($runs.Count -gt 0) { $seen=$true }" ^
  "  $active=@($runs | Where-Object { $_.status -ne 'completed' });" ^
  "  if ($seen -and $active.Count -eq 0) { exit 0 }" ^
  "  Start-Sleep -Seconds 10;" ^
  "} while ((Get-Date) -lt $deadline);" ^
  "if (-not $seen) { Write-Host 'No tag workflow run was found; continuing.'; exit 0 }" ^
  "throw 'Timed out waiting for the tag workflow to finish.';"
if errorlevel 1 exit /b 1

echo.
echo Creating or updating GitHub release...
"%GH%" release view "%TAG%" --repo "%REPO%" >nul 2>nul
if errorlevel 1 (
  "%GH%" release create "%TAG%" --repo "%REPO%" --target "%DEFAULT_BRANCH%" --title "%RELEASE_TITLE%" --notes "%TAG%"
) else (
  "%GH%" release edit "%TAG%" --repo "%REPO%" --target "%DEFAULT_BRANCH%" --title "%RELEASE_TITLE%" --notes "%TAG%"
)
if errorlevel 1 exit /b 1

echo.
echo Uploading release assets...
"%GH%" release upload "%TAG%" --repo "%REPO%" --clobber ^
  "%PORTABLE_ASSET%" ^
  "%SETUP_ASSET%" ^
  "%BLOCKMAP_ASSET%" ^
  "dist\latest.yml" ^
  "%SOURCE_ZIP%"
if errorlevel 1 exit /b 1

if exist "%PUBLISH_TMP%" rmdir /s /q "%PUBLISH_TMP%"

echo.
echo Published source and assets for %TAG%.
echo The GitHub "Source code (zip)" and "Source code (tar.gz)" links now point
echo to the updated tag commit.
echo.
echo Done.
endlocal
