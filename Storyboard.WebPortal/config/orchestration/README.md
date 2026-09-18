# UI Orchestration Config Guide

Purpose: keep edits safe, reviewable, and layered.

## Layer Checklist

1. Experience state and behavior
File: experience-state-featuremap.v1.json
Owns: state catalog, enabled features, transitions, operation model, resolution defaults.

2. Structural layout skeletons
File: skeleton-layouts.v1.json
Owns: regions, breakpoints, geometry variants, collapse/reflow order.

3. State composition mappings
File: experience-state-compositions.v1.json
Owns: per-state default composition and feature-to-slot assignments with slot modes.

4. Form-factor implementation mappings
File: form-factor-feature-implementations.v1.json
Owns: feature-to-implementation key map for each form factor.

## Supporting Files Checklist

1. Feature registry
File: feature-catalog.v1.json
Owns: canonical feature keys and metadata.

2. Slot registry
File: ui-slots.v1.json
Owns: canonical slot keys, slot capabilities, allowed slot modes.

3. Diagnostics policy
File: diagnostics-policy.v1.json
Owns: diagnostics display and storage policy.

4. Theme contract
File: theme-contract.v1.json
Owns: presentation tokens (color, typography, spacing, shape).

5. Schemas
Folder: schemas/
Owns: one schema per config file.

## Maintenance Order Checklist

1. Update registries first.
Edit feature-catalog.v1.json and ui-slots.v1.json when adding keys.

2. Update state behavior next.
Edit experience-state-featuremap.v1.json for states, transitions, and enabled features.

3. Update skeleton structure.
Edit skeleton-layouts.v1.json for geometry and responsive variants.

4. Update state compositions.
Edit experience-state-compositions.v1.json for slot assignments and slot modes.

5. Update form-factor mappings.
Edit form-factor-feature-implementations.v1.json for implementation key coverage.

6. Validate before commit.
Run dotnet test .\Storyboard.WebPortal.Tests\Storyboard.WebPortal.Tests.csproj

## Common Change Recipes

1. Add a new feature.
Add it to feature-catalog, enable it in state feature map, place it in state compositions, map implementations by form factor.

2. Add a new experience state.
Add state and transitions in the feature map, add a default composition mapping, then assign slot usage.

3. Add a new slot.
Add the slot in ui-slots, place it in skeleton layouts, then assign it in state compositions.

4. Add or tune mobile behavior.
Adjust mobile geometry in skeleton layouts, then confirm form-factor implementation mappings.

## Boundary Checklist

1. No geometry in experience-state-featuremap.v1.json.
2. No transitions or state logic in skeleton-layouts.v1.json.
3. No form-factor implementation choices in experience-state-compositions.v1.json.
4. Prefer additive key changes over key churn.
