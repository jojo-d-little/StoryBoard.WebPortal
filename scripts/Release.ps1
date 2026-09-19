[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$')]
    [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$app = Join-Path $root 'Storyboard.WebPortal'
Set-Location $root

function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Host "`n==> $Name" -ForegroundColor Cyan
    & $Action
    if (-not $?) { throw "Step failed: $Name" }
}

if ((git branch --show-current) -ne 'main') { throw 'Release must start from main.' }
if ((git status --porcelain)) { throw 'Working tree must be clean before releasing.' }
$packageJson = Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json
$currentVersion = [string]$packageJson.version
if (-not $Version) {
    if ($currentVersion -notmatch '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$') {
        throw "Cannot suggest a patch bump for current version '$currentVersion'."
    }
    $Version = "$($matches.major).$($matches.minor).$([int]$matches.patch + 1)"
    $confirmation = Read-Host "Current version is $currentVersion. Use suggested version ${Version}? [Y/n]"
    if ($confirmation -and $confirmation -notmatch '^(?i:y|yes)$') { throw 'Release cancelled.' }
}
$tag = "webportal-v$Version"
if ([string]::IsNullOrWhiteSpace($Version)) { throw 'A WebPortal release version is required.' }
if (git tag --list $tag) { throw "Tag '$tag' already exists locally." }
git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) { throw "Tag '$tag' already exists on origin." }
if ($LASTEXITCODE -ne 2) { throw "Could not check whether tag '$tag' exists on origin." }

Invoke-Step "set WebPortal version $Version" {
    Push-Location $app
    try { npm version $Version --no-git-tag-version }
    finally { Pop-Location }
}
Invoke-Step 'install npm dependencies' { npm ci --prefix $app }
Invoke-Step 'validate contracts' { npm run verify:contracts --prefix $app }
Invoke-Step 'run WebPortal tests' { npm test --prefix $app }
Invoke-Step 'build WebPortal' { npm run build --prefix $app }

git add -- Storyboard.WebPortal/package.json Storyboard.WebPortal/package-lock.json
Invoke-Step "commit WebPortal version $Version" { git commit -m "Prepare WebPortal $Version release" }
Invoke-Step "create annotated tag $tag" { git tag -a $tag -m "Release WebPortal $Version" }
Invoke-Step 'push main and release tag' { git push --atomic --follow-tags origin main }

Write-Host "Release WebPortal $Version pushed. GitHub Actions will publish NuGet and create the GitHub Release." -ForegroundColor Green
