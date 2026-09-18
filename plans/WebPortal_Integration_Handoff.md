# WebPortal Integration Handoff Plan

## Objective

Move WebPortal/UI consumers from copied host schemas and transport metadata to the published npm contracts package.

## Intended dependency direction

```text
@jojo-d-little/storyboard-contracts → WebPortal
```

WebPortal should not depend on GameEngine or the .NET contracts assembly directly.

## Package contents

The npm package intentionally contains only:

- Host JSON schemas under `HostContracts/Schemas`
- `HostContracts/Transport/host-transport-manifest.json`

It does not contain runtime DTOs, save-game DTOs, or .NET implementation code.

## Scope

- [ ] Configure the scoped npm registry `https://npm.pkg.github.com` and authentication outside source control.
- [ ] Add `@jojo-d-little/storyboard-contracts` at the agreed version.
- [ ] Replace copied host schemas with package-delivered schemas.
- [ ] Replace copied route/transport metadata with the package-delivered manifest.
- [ ] Update tooling/import paths to read the installed package contents.
- [ ] Remove WebPortal-local contract generation and schema-copy steps.
- [ ] Add a clean-install consumer test that verifies the expected host-only package contents.

## Transport expectations

Treat `host-transport-manifest.json` as the UI-facing description of the wire interface. WebPortal may use it for client generation, route discovery, validation, or documentation, but must not invent routes independently.

GameHost remains responsible for proving that its registered endpoints cover the contract-owned route declarations.

## Non-goals

- [ ] Do not add GameEngine as an npm dependency.
- [ ] Do not copy the NuGet assembly into WebPortal.
- [ ] Do not add runtime or save-game schemas to the UI package unless a separate package decision is made.
- [ ] Do not publish from ordinary pull-request CI.

## Acceptance criteria

- [ ] WebPortal installs the package from GitHub Packages in a clean checkout.
- [ ] No local copied host schema or transport manifest remains in the active build path.
- [ ] UI validation/client generation consumes the packaged manifest successfully.
- [ ] Package version updates are deliberate and recorded.
- [ ] CI proves a clean npm install and package-content boundary.

## Handoff output

- Registry/authentication setup instructions
- Package version adopted by WebPortal
- List of removed local schema/manifest paths
- UI tooling or generated-client changes
- Clean-install validation result
