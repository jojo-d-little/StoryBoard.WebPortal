# Releasing WebPortal

WebPortal releases are manual and versioned. The release workflow builds the app and publishes the compiled `dist` contents as a GitHub Release asset.

## Prepare a release

From the repository root:

```powershell
Set-Location .\Storyboard.WebPortal
npm version 0.1.1 --no-git-tag-version
npm test
npm run build
```

Use the next intended version instead of `0.1.1`. For a prerelease, use a valid version such as `0.1.1-experimental.1`. The version command updates both `package.json` and `package-lock.json`.

Commit and push the version change, then open GitHub Actions and run **Release WebPortal** from that branch. Enter `RELEASE` in the confirmation field.

The workflow verifies that the package and lockfile versions match and that the version has not already been released. It then runs contract validation, tests, and the production build.

## Output

The workflow creates a GitHub Release tagged `webportal-v<version>` with an archive named:

```text
storyboard-webportal-<version>.tar.gz
```

The archive contains the built `dist` contents. Extract those files into the host's static serving directory, such as `wwwroot`, when integrating with GameHost.

## Package access

CI installs the contracts npm package from GitHub Packages using the repository secret `GH_PACKAGES_READ_TOKEN`. The secret value must be a PAT with `read:packages` access. Do not commit the token or place it in the repository `.npmrc`.
