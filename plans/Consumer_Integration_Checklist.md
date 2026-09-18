# Storyboard Contracts Consumer Integration Checklist

This is the application-facing integration guide for adopting the published contracts packages. It assumes the consumer is moving from local project/source references to the published packages.

Related handoff plans:

- [GameEngine Extraction Handoff](GameEngine_Extraction_Handoff.md)
- [Designer Extraction Handoff](Designer_Extraction_Handoff.md)
- [WebPortal Integration Handoff](WebPortal_Integration_Handoff.md)

## Package targets

| Consumer | Package | Current version | Contents |
|---|---|---|---|
| .NET applications | `Storyboard.Contracts` | `0.1.0-experimental.2` | Compiled runtime, save-game, designer, host, and transport contracts; schemas and transport manifest |
| UI/npm applications | `@jojo-d-little/storyboard-contracts` | `0.1.0-experimental.2` | Host schemas and `HostContracts/Transport/host-transport-manifest.json` only |

Both package versions must remain identical. Package versions are immutable after publication.

## Before changing a consumer

- [ ] Identify the consumer's current contracts project reference, local generated-code folders, schema folders, and code-generation build steps.
- [ ] Record the package version being adopted.
- [ ] Confirm the consumer targets .NET 8 or later. Do not move the package to .NET 10 until the coordinated application upgrade.
- [ ] Configure authenticated access to GitHub Packages outside source control.
- [ ] Create a small migration commit so the package move can be reverted independently.

## .NET package setup

Replace the old local contracts reference:

```xml
<ProjectReference Include="...Storyboard.Shared.Contracts.csproj" />
```

with:

```xml
<PackageReference Include="Storyboard.Contracts" Version="0.1.0-experimental.2" />
```

Configure the authenticated NuGet source:

```text
https://nuget.pkg.github.com/jojo-d-little/index.json
```

Do not commit a personal access token. Use the repository/organization credential mechanism or a developer-local credential configuration.

Then:

- [ ] Remove the old contracts `ProjectReference`.
- [ ] Remove any consumer-side schema/codegen project references.
- [ ] Remove consumer build targets that regenerate or promote contract files.
- [ ] Restore from a clean package cache.
- [ ] Build the consumer before deleting local files, so compiler errors identify remaining dependencies.

Runtime, save-game, and host schema files are copied by NuGet to the application output under `schemas/runtime/...`, `schemas/save-game/...`, and `schemas/host/...`. Locate them relative to `AppContext.BaseDirectory`; do not probe the NuGet cache or copy them from the contracts source tree. The package also preserves those archive paths for package-level consumers.

The package likewise copies `transport/host-transport-manifest.json` to the application output. This file is the delivered JSON transport artifact; it is separate from the compiled transport metadata types.

## Namespace and type changes

The package owns these namespaces:

| Contract area | Package namespace |
|---|---|
| Runtime DTOs | `Storyboard.Shared.RuntimeContracts.Dtos` |
| Runtime enums | `Storyboard.Shared.RuntimeContracts.Enums` |
| Runtime custom types | `Storyboard.Shared.RuntimeContracts.CustomTypes` |
| Save-game DTOs | `Storyboard.Shared.SaveGameStateContracts.Dtos` |
| Save-game enums | `Storyboard.Shared.SaveGameStateContracts.Enums` |
| Host DTOs and interfaces | `Storyboard.Shared.HostContracts` |
| Designer DTOs | `Storyboard.Shared.DesignerContracts` |
| Host transport metadata/routes | `Storyboard.Shared.HostContracts.Transport` |

Update consumer `using` directives and fully qualified references to these namespaces. In particular:

- [ ] Replace references to the old application-owned Designer namespace with `Storyboard.Shared.DesignerContracts`.
- [ ] Replace references to `StoryboardDesigner.App.Services.DesignerJsonContracts` types.
- [ ] Update save-game references to `Storyboard.Shared.SaveGameStateContracts.*`.
- [ ] Update transport references to `Storyboard.Shared.HostContracts.Transport`.

## Designer application migration

The old source location is application-owned and must disappear after migration:

```text
StoryboardDesigner.App/Services/DesignerJsonContracts
```

The replacement is delivered by the package:

```text
Storyboard.Shared.DesignerContracts
```

- [ ] Change Designer imports and type references to `Storyboard.Shared.DesignerContracts`.
- [ ] Delete the local generated Designer DTO copies only after the package-backed build succeeds.
- [ ] Remove Designer's schema/codegen promotion step and local staging dependency.
- [ ] Remove any Designer project references to the extracted contracts/codegen projects.
- [ ] Confirm Designer no longer writes generated contract files into its own source tree.

## GameHost and transport migration

Transport artifacts are now contract-owned:

```text
Storyboard.Shared.HostContracts.Transport.HostTransportRoutes
Storyboard.Shared.HostContracts.Transport.HostTransportGeneratedManifest
Storyboard.Shared.HostContracts.Transport.HostTransportRouteDeclarations
```

- [ ] Replace GameHost route literals or local generated transport copies with package-delivered route declarations/types.
- [ ] Remove GameHost source scanning from the contracts workflow; it is no longer a package-generation prerequisite.
- [ ] Add or retain a GameHost-owned integration test that verifies registered endpoints cover `HostTransportRouteDeclarations.All`.
- [ ] Keep endpoint registration/parity validation in GameHost, not in the contracts repository.
- [ ] Confirm the JSON manifest used by UI tooling is the package-delivered `host-transport-manifest.json`.

## npm/UI package setup

Add the scoped package:

```json
{
  "dependencies": {
    "@jojo-d-little/storyboard-contracts": "0.1.0-experimental.2"
  }
}
```

Configure the scoped registry and authentication:

```text
@jojo-d-little:registry=https://npm.pkg.github.com
```

- [ ] Do not add runtime or save-game assumptions to the npm consumer; this package intentionally contains host schemas and transport metadata only.
- [ ] Replace any copied host schemas or copied transport manifest with package files.
- [ ] Update UI tooling to read `HostContracts/Transport/host-transport-manifest.json` from the installed package.
- [ ] Confirm no local package tarball path remains in the real consumer.

## Remove obsolete source and tests

After the consumer builds and its focused tests pass:

- [ ] Delete local generated DTO copies.
- [ ] Delete local schema copies that are now package-owned.
- [ ] Delete local contract/codegen project references and build steps.
- [ ] Remove obsolete application-side promotion scripts.
- [ ] Retire the old `StoryboardDesigner.App.Tests/SchemaEmittedContractDriftGuardrailsTests.cs` after the contracts-owned guardrail suite is established and the application no longer owns the generated artifacts.
- [ ] Keep GameHost endpoint registration tests; those are integration tests, not contract-package tests.

## Validation gate

Run these checks from a clean consumer checkout/cache:

```powershell
dotnet restore
dotnet build
dotnet test
```

For npm consumers:

```powershell
npm install
npm test
```

Also verify:

- [ ] No `ProjectReference` to the extracted contracts project remains.
- [ ] No local generated contract/schema directory remains in the consumer.
- [ ] Serialization snapshots and wire payloads are unchanged unless an intentional contract change is being made.
- [ ] GameHost endpoint registration covers the package route declarations.
- [ ] CI restores packages from GitHub Packages without local artifacts.
- [ ] The migrated consumer and package version are recorded in the project migration log.

## Version changes during integration

The canonical version is stored in the contracts repository's `VERSION.txt`. Consumers should reference the published version directly; they should not copy or edit that file.

When the contracts package changes:

1. Bump `VERSION.txt` in the contracts repository.
2. Run `scripts/SyncPackageVersion.ps1`.
3. Regenerate, lock, validate, and publish the new version.
4. Update consumers deliberately, one at a time.

Do not republish an existing version with different contents.
