# Room-Matched Viewport Proposal

## Status

Future-work proposal only. No implementation is authorized or included by this
document.

## Motivation

The room has logical dimensions supplied by the Host, commonly 800x600. The
Portal currently sizes the Pixi renderer viewport to the full play-surface
mount, then contains and centers the room inside that viewport. When the mount
is wider or taller than the room's aspect ratio, this leaves unused background
inside the renderer viewport.

That unused area is visible during slide transitions. The transition captures
viewport-sized snapshots and moves them by the viewport width or height. For
example, an 800x600 room in a 1000x600 viewport is rendered at 800x600 with a
100-pixel side margin on each side. The room edges are therefore 800 pixels
apart, while the snapshots are displaced by 1000 pixels. The transition shows
the viewport background between the rooms.

The desired policy is to use as much of the available play-surface area as
possible while making the renderer viewport match the displayed room's aspect
ratio. The renderer viewport should contain the room without internal
letterboxing. Any unused area should remain outside the renderer viewport and
be centered in the surrounding play-surface layout.

## Goal

For rooms with equal dimensions, preserve the existing slide transition and
make the room surfaces meet edge to edge by ensuring the renderer viewport
dimensions match the displayed room dimensions after scaling.

For rooms with different dimensions or aspect ratios, use a fade transition.
Do not resize the entire application or distort room content to force a fit.

## Proposed sizing policy

Treat the play-surface mount as the available rectangle and the Host room
bounds as the logical room coordinate space. Calculate the largest proportional
scale that fits both available dimensions, subject to the renderer's existing
scale limits:

```text
scale = min(availableWidth / roomWidth,
            availableHeight / roomHeight,
            maximumScale)

rendererViewportWidth  = roomWidth  * scale
rendererViewportHeight = roomHeight * scale
```

Round final viewport dimensions to positive integer CSS pixels. Center the
resulting renderer viewport in the available play-surface mount. Preserve the
existing below-soft-minimum behavior when the available area is too small; do
not enlarge the viewport beyond the available rectangle to satisfy a minimum
scale.

This makes the renderer viewport and displayed room proportional at every
size. It is not a requirement to use native 800x600 CSS pixels. For example,
with an 800x600 room and a 1000x600 available area, use an 800x600 viewport
centered in the available area. With a 1200x900 available area, use a
1200x900 viewport if the scale limit permits.

## Implementation guidelines

1. Keep the outer play-surface mount sized by the existing application layout.
2. Add or adapt an inner renderer host whose dimensions are calculated from
   the room bounds and available mount dimensions. Center it without changing
   the surrounding panel or page layout.
3. Feed the inner host's actual dimensions to `renderer.resize` and to the
   renderer scale metrics. Avoid CSS-only stretching of a canvas whose Pixi
   logical viewport still has different dimensions.
4. Recompute the inner host dimensions when either the available mount size or
   room bounds change. Keep the current `ResizeObserver` approach, but observe
   the outer available area and size the inner renderer host from it.
5. Keep room-space coordinates, lighting, sprites, and room bounds in logical
   room units. Apply the viewport scale uniformly; do not bake DOM offsets into
   room-space values.
6. Preserve the existing click conversion against the renderer host's actual
   rectangle so clicks in the outer unused margins remain outside the room.
7. For slide transitions, only use slide when outgoing and incoming room
   dimensions match. Route differing dimensions/aspect ratios to fade. If
   transition eligibility already comes from authoritative Host metadata,
   coordinate any required rule with the Host contract rather than silently
   guessing in the renderer.
8. Keep viewport HUD anchored to the renderer viewport and confirm its intended
   relationship to room-space content before changing its dimensions.

## Expected tradeoffs and risks

- In layouts whose available area has a different aspect ratio, the renderer
  viewport will use less than the full width or height. This moves empty space
  outside the game surface instead of carrying it with room snapshots.
- If room dimensions change, the inner renderer host can change size. Fades
  should hide that resize; confirm there is no visible layout jump at the
  transition boundary.
- Viewport-level HUD, room-transition masks, pointer mapping, waypoint
  placement, diagnostics, and renderer scale reporting all consume viewport
  dimensions. Verify each uses the inner renderer host consistently.
- Respecting the existing maximum scale can leave available display area
  unused on very large screens. Do not raise that limit as part of this change
  without separate visual and GPU performance review.
- The outer layout must retain usable space for the command panel and other
  session controls, particularly at narrow or short browser sizes.

## Validation guidelines

Before implementation is considered complete, verify:

- An 800x600 room in a 1000x600 available area produces an 800x600 renderer
  viewport centered in the available area, with no internal side bars.
- An 800x600 room scales proportionally to fill a larger 4:3 available area,
  up to the configured maximum scale.
- Small available areas preserve aspect ratio and remain within their bounds.
- Two same-sized rooms slide with their visible room edges meeting throughout
  the transition, with no moving strip of renderer background between them.
- Rooms with unequal dimensions or aspect ratios use a fade rather than slide.
- Clicks on room content map to the same logical room coordinates as before;
  clicks in outer margins are reported outside the room.
- HUD positioning, waypoint feedback, lighting composition, resize handling,
  and room-transition cancellation still behave correctly.
- Room and viewport dimensions in diagnostics/status metrics match the actual
  logical room and inner renderer host dimensions.

## Relevant current code

- [`SessionPlaySurfaceRendererV1.tsx`](../Storyboard.WebPortal/src/components/SessionPlaySurfaceRendererV1.tsx)
  measures the current renderer mount and passes its full dimensions to the
  renderer.
- [`PixiGameRenderer.ts`](../Storyboard.WebPortal/src/gameRenderer/pixi/PixiGameRenderer.ts)
  contains the viewport contain transform and viewport-sized slide snapshots.
- [`containScaling.ts`](../Storyboard.WebPortal/src/gameRenderer/scaling/containScaling.ts)
  computes the proportional room-to-viewport transform and centered offsets.
- [`mapHostSessionScene.ts`](../Storyboard.WebPortal/src/gameRenderer/adapters/mapHostSessionScene.ts)
  maps authoritative Host room dimensions into renderer room bounds.
- [`Room_Snapshot_Transition_Plan.md`](./Room_Snapshot_Transition_Plan.md)
  documents bounded snapshot capture and current transition behavior.
