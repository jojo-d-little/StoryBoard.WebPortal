# WebPortal UI Orchestration Configuration Guide

This directory contains the declarative contracts used to resolve the WebPortal shell: its lifecycle state, page composition, structural layout, feature implementations, slots, and visual tokens.

The configuration is intentionally layered. Each file answers a different question. A change should be made in the layer that owns that question rather than by adding unrelated meaning to an existing key.

## Runtime overview

At startup, the Portal loads the JSON files in this directory through `src/orchestration/loader.ts`. Because Vite exposes `config` as its `publicDir`, these files are served at the bundle-relative `/orchestration/` path.

The loader:

1. Loads the feature map, state compositions, skeleton layouts, implementation mappings, feature catalog, slot registry, and theme contract.
2. Hydrates each configured skeleton template by reading its HTML and extracting slot names, grid placement, CSS, root metadata, and slot class names.
3. Validates cross-file references.
4. Returns one `OrchestrationContracts` object to the resolver and Portal components.

The resolver then follows this sequence:

```text
experience state
  + form factor
  + composition profile
  + compatible skeleton layout
  -> slot assignments
  -> concrete feature implementations
  -> rendered template and theme
```

The current resolver is deterministic. Defaults come from `experience-state-featuremap.v1.json`; the Portal may apply explicit development/lab overrides for form factor, composition profile, and skeleton layout.

## Core constructs

### Experience state

Defined in `experience-state-featuremap.v1.json`.

An experience state describes the Portal lifecycle and interaction context, not the device and not the deployment environment.

Current states are:

- `Bootstrapping`: the Portal is loading contracts and establishing initial readiness.
- `SignedOut`: no host credential is available.
- `SignedIn`: authentication succeeded and game/session discovery is available.
- `SessionActive`: the Portal is attached to an active host session.
- `SessionDisconnected`: an active session was interrupted and recovery is required.

This file also owns:

- the initial state;
- the known state catalog;
- lifecycle transitions and their guard/action references;
- resolution defaults for skeleton, form factor, and composition profile;
- the configured operation status/phase vocabulary.

State is the correct construct for questions such as “is the user signed in?” or “is there an active session?” It is not the correct construct for “is this desktop?” or “is this a development launch?”

### State composition profile

Defined in `experience-state-compositions.v1.json` under `stateProfiles`.

A composition profile describes which features occupy which semantic slots for one experience state. Each assignment contains:

- a `slotKey`;
- an optional `featureKey`;
- a slot `mode` such as `visible`, `hidden`, `collapsed`, `disabled`, or `readonly`.

A profile may also define preferred input focus.

Examples in the current configuration include `standard`, `immersive`, and `mobile`. These are alternative compositions for a state. They are not automatically device profiles, security profiles, deployment environments, or authentication modes, even when their names suggest one of those uses.

The current resolver selects the state’s `defaultProfile`, falling back to the global `defaultCompositionProfileKey`. A composition profile override is valid only if that profile exists for the current state.

Use a composition profile when the question is:

> Which features and panels should be present, and how should they be exposed, for this lifecycle state?

### Skeleton layout

Defined in `skeleton-layouts.v1.json`, with HTML templates under `skeletons/`.

A skeleton is the structural frame into which composition slots are placed. It owns:

- layout family, such as desktop or mobile;
- the compatible `formFactorKey`;
- width/orientation constraints;
- the template HTML path;
- extracted template slots and grid geometry;
- root and slot CSS metadata.

The skeleton owns geometry and responsive structure. It does not decide which feature belongs in a slot and does not own lifecycle transitions.

Every assigned composition slot must be present in the selected skeleton template. The resolver also requires the selected skeleton’s `formFactorKey` to match the selected form factor.

Use a skeleton when the question is:

> What is the page frame and where are the semantic regions physically placed?

### Form factor

Defined in `form-factor-feature-implementations.v1.json`.

A form factor is a device/layout implementation family, currently including `desktop` and `mobileLandscape`. It maps each feature key to a concrete implementation key and may provide orientation and density hints.

The form factor owns implementation selection for responsive presentation. For example, the same `commandHandler` feature can be mapped to a compact horizontal implementation for a small display and a regular vertical implementation for desktop.

The form factor does not decide the lifecycle state or whether a feature is visible. Those decisions belong to the state and composition layers.

Use a form factor when the question is:

> Which implementation of each selected feature is appropriate for this device or viewport family?

### Feature catalog

Defined in `feature-catalog.v1.json`.

The feature catalog is the canonical registry of feature keys and metadata. A feature key is a semantic capability such as `sessionPlaySurface`, `gameDiscovery`, `commandHandler`, or `diagnosticsConsole`.

The catalog does not place features on the page and does not select their responsive implementation. It provides the vocabulary used by compositions and mappings.

### UI slot

Defined in `ui-slots.v1.json`.

A slot is a stable semantic target in the shell, such as `primarySurface`, `secondaryPanel`, `utilityPanel`, `topBar`, `statusStrip`, or an overlay layer.

The slot registry owns slot capabilities and behavior hints: whether a slot is infrastructure, collapsible, hideable, modal, toast-like, an overlay, its collapse edge, and its stack order.

The registry does not assign a feature to a slot. That is the job of the state composition.

### Feature implementation mapping

The composition chooses a semantic feature. The selected form factor maps that feature to an implementation key. The code registry then maps supported technical implementation keys to React components.

This is the separation:

```text
feature catalog:       what capability exists?
state composition:     where is it used in this state?
form-factor mapping:   which implementation fits this viewport family?
component registry:    which code component realizes that implementation?
```

Unknown feature keys, slots, modes, or missing implementation mappings are validation errors.

### Theme contract

Defined in `theme-contract.v1.json`.

The theme contract owns presentation tokens: colors, typography, shape, spacing, and fallback behavior. It is shared visual vocabulary, not a layout selector and not a lifecycle state.

### Diagnostics policy

`diagnostics-policy.v1.json` describes intended diagnostics visibility, channels, redaction, verbosity, and storage behavior. It is supporting configuration at present; it is not currently included in the `OrchestrationContracts` object loaded by `src/orchestration/loader.ts`.

That distinction matters: changing this file alone does not currently change Portal runtime behavior unless a loader/consumer is added.

### Schemas

The `schemas/` directory contains JSON Schema documents intended to validate the configuration files. Schemas are part of the configuration contract and should be kept synchronized with both the JSON files and the TypeScript runtime types.

## What the current model does not express yet

### Production versus development

There is currently no first-class production/development or presentation-environment axis in `OrchestrationContracts`. The Portal now has a separate application-level launch context that can derive a presentation variant, but that variant is not yet part of the declarative resolver contract.

The following concepts are separate today:

- `mode=devsimulator` is a launch/bootstrap context consumed by the Portal. It selects automatic username-only authentication, discovery, and session start/attach behavior, and derives the application-level `development` presentation variant. It is not passed into `resolveShellPlan`.
- `rm=config` is an App-level renderer override. It selects the configuration-driven layout renderer instead of the Shell Lab view. A development launch defaults to that renderer; `rm=lab` is an explicit escape hatch for the Shell Lab. Neither value is an orchestration contract, state, profile, skeleton, or environment declaration.
- `ff`, `cp`, and `sk` are Portal override parameters for form factor, composition profile, and skeleton layout. They are currently lab/debug controls and are not a production presentation policy.

Therefore, `rm=config` must not be treated as “production mode,” and an existing composition profile must not be overloaded to mean “development UI.”

If production and development need different user-facing compositions, the likely future design is a separate presentation/environment context—possibly a named variant resolved before or alongside state/profile selection. The exact name and contract are intentionally undecided. Candidate semantics include:

- deployment/capability context, such as production versus development;
- presentation variant, such as player-facing versus diagnostic development shell;
- launch intent, such as normal portal versus Designer-launched simulator.

These are related but not identical decisions. They should not be collapsed into form factor, because development versus production is not a viewport characteristic.

## Mobile/desktop guidance

The current model can support mobile and desktop through three coordinated layers:

1. Select a form factor for implementation mappings.
2. Select a compatible skeleton for geometry and responsive structure.
3. Select a composition profile if the feature/panel arrangement should also differ.

The current resolver does not automatically select a `mobile` composition profile when a mobile form factor is selected. A composition profile override must be supplied if that distinction is needed. This is a configuration behavior, not an automatic device policy.

Profile names such as `mobile` are therefore descriptive conventions in the current data, not a special runtime category.

## Designer launch guidance

The Designer should pass launch intent and non-secret context, not internal layout implementation details.

Current development launch shape:

```text
/client/?mode=devsimulator&username=<url-encoded-user>
```

The Portal uses that context to choose the approved bootstrap behavior and the default development presentation. It resolves the UI from Portal configuration rather than requiring Designer to know `skeletonLayoutKey`, `compositionProfileKey`, or concrete implementation keys.

If a future Designer preference needs to choose a presentation variant, that should be represented as an explicit, documented variant key. It should not expose arbitrary internal component or slot names as a cross-application contract.

## Configuration maintenance order

When adding a feature or changing the shell, use this order:

1. Update `feature-catalog.v1.json` or `ui-slots.v1.json` if a new canonical key is required.
2. Update `experience-state-featuremap.v1.json` for states, transitions, defaults, or operation vocabulary.
3. Update `skeleton-layouts.v1.json` and the corresponding template for structural changes.
4. Update `experience-state-compositions.v1.json` for state/profile slot assignments and modes.
5. Update `form-factor-feature-implementations.v1.json` for responsive implementation coverage.
6. Update the relevant schema and TypeScript types when the contract shape changes.
7. Run validation, tests, and build before committing.

Boundary rules:

- Do not put geometry in the feature map.
- Do not put transitions or lifecycle state in a skeleton.
- Do not put feature visibility decisions in a form-factor mapping.
- Do not use a composition profile as a substitute for deployment environment.
- Prefer additive keys and explicit migration over silently changing the meaning of an existing key.

## Current configuration drift to resolve

The following items were found during the F01 orchestration review and should remain visible until corrected:

1. `schemas/experience-compositions.v1.schema.json` describes an older `stateDefaults`/`compositionProfiles` shape, while the active runtime file is `experience-state-compositions.v1.json` with `stateProfiles`. The schema and active file need reconciliation before schema validation can be treated as authoritative.
2. `experience-state-featuremap.v1.json` contains an `operationModel`, but the current `ExperienceStateFeatureMap` TypeScript interface does not model that property explicitly.
3. `diagnostics-policy.v1.json` exists but is not loaded into `OrchestrationContracts` by the current loader.
4. `mobile-portrait.html` exists, but the active skeleton configuration currently references `desktop-standard.html` for `mobileLandscape` and does not define a `mobilePortrait` skeleton entry.
5. The previous guide referenced a .NET Portal test command. The current package validation commands are `npm test`, `npm run build`, and `npm run test:visual` when visual coverage is relevant.

These are documentation/contract-alignment findings, not assumptions that should be silently fixed as part of a production/development mode change.
