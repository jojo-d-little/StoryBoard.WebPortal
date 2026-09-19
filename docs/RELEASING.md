# Releasing WebPortal

WebPortal releases are tag-driven and versioned. The release workflow builds the app and publishes the compiled `dist` contents as a GitHub Release asset.

## Prepare a release

From the repository root:

```powershell
Set-Location .\Storyboard.WebPortal
npm version 0.1.1 --no-git-tag-version
npm test
npm run build
```

Use the next intended version instead of `0.1.1`. For a prerelease, use a valid version such as `0.1.1-experimental.1`. The version command updates both `package.json` and `package-lock.json`.

`Storyboard.WebPortal/package.json` is the single editable version source. Do not edit a version in the NuGet project. To pack the NuGet output locally after building the WebPortal, run:

```powershell
npm run pack:nuget
```

Commit and push the version change, then create and push the matching annotated tag:

```powershell
git tag -a webportal-v0.1.1 -m "Release WebPortal 0.1.1"
git push origin main --follow-tags
```

Pushing the `webportal-v<version>` tag starts **Release WebPortal** automatically.

The complete local path can be run with:

```powershell
.\scripts\Release.ps1 -Version 0.1.2
```

The workflow verifies that the package and lockfile versions match and that the version has not already been released. It then runs contract validation, tests, and the production build.

## Output

The workflow creates a GitHub Release tagged `webportal-v<version>` with an archive named:

```text
storyboard-webportal-<version>.tar.gz
```

The archive contains the built `dist` contents. Extract those files into the host's static serving directory, such as `wwwroot`, when integrating with GameHost.

The workflow also publishes a NuGet package to GitHub Packages:

```text
Storyboard.WebPortal <version>
```

The package contains the raw files from `dist` under NuGet's `contentFiles/.../wwwroot` path. Its build-transitive targets copy those files into the consuming .NET project's `wwwroot` output and publish directories. GameHost can reference the package with:

```xml
<PackageReference Include="Storyboard.WebPortal" Version="0.1.0" />
```

The NuGet package is the preferred integration path for a .NET host. The GitHub Release archive remains useful for direct deployment or inspection.

## Package access

CI installs the contracts npm package from GitHub Packages using the repository secret `GH_PACKAGES_READ_TOKEN`. The secret value must be a PAT with `read:packages` access. Do not commit the token or place it in the repository `.npmrc`.
