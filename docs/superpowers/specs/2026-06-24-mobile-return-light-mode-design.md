# 2026-06-24 Mobile Return + Light Mode Design

## Context

This spec covers the next polish pass for `liquid-glass-blog` with three confirmed priorities:

1. Fix the visual instability that appears on Android browser quick-return / swipe-back into the homepage.
2. Keep the homepage centered on the person, while using a stronger visual background to support that presence.
3. Redesign light mode toward a luxury glass look instead of flat bright boxes.

The target browser priority is Android mainstream system browsers similar to the iQOO Neo6 stock browser. In-app browsers are explicitly out of scope for this pass.

## Goals

- Eliminate the blurry, gray, layered-looking recovery state when the page is quickly restored on mobile.
- Preserve a cool, animated feel on mobile without letting the background overpower the personal identity block.
- Make light mode feel unified, soft, and premium across hero, nav, contact actions, form fields, and fold sections.
- Keep the existing single-page information structure and fold interaction model.

## Non-Goals

- Rebuilding the page into a new IA or turning it into a full portfolio system.
- Broad compatibility work for embedded browsers.
- Reworking all copy content or solving the local source encoding issue in this pass.
- Adding new backend behavior or external integrations.

## Recommended Approach

Use a balanced enhancement strategy:

- Mobile gets a lighter, staged visual system with explicit recovery states.
- Desktop keeps the richer glow and motion treatment.
- Light mode gets a more integrated material system with thinner edges, softer contrast, and fewer isolated white boxes.

This is recommended over a minimal bugfix because the user also wants a clear aesthetic upgrade, and over a full hero rebuild because that would add more risk than needed.

## Visual Direction

### Personal-first hero with stronger support

The hero should still read as a personal card first, but the background should feel like it is framing and elevating that identity.

Planned characteristics:

- The avatar area becomes a layered focal point: portrait core, orbital ring, soft underglow, and restrained ambient halo.
- Name, role, intro, and contact actions should read as one continuous hierarchy rather than separate heavy blocks.
- Contact actions should feel like a refined profile action bar, not generic rounded buttons.
- The first fold section under the hero should feel like a content drawer extending from the identity area.

### Light mode luxury glass

The light theme should move closer to a misted glass material:

- warm cloud-white and cool pale-blue surfaces
- thinner borders
- softer highlight seams
- lower pure-white contrast
- quieter shadows with better depth stacking

The feeling target is premium and airy, not bright and boxy.

## Interaction and Motion Design

### Mobile recovery states

The mobile browser restore issue will be handled with a staged recovery model.

States:

1. `stable`: low-cost visual layer, minimal blur, reduced motion, safe after return.
2. `warming`: short transition window after restore where expensive effects remain reduced.
3. `active`: light mobile motion returns once the page is stable.

Behavior:

- On `pagehide` and when the document becomes hidden, enter `stable`.
- On `pageshow`, resume into `warming` instead of immediately restoring every effect.
- After a short delay and one clean render cycle, move from `warming` to `active`.
- During scroll and touch-driven movement, remain in a low-cost state on mobile.

### Motion budget by device class

Desktop:

- richer glow field
- particle links
- tilt interactions
- fuller backdrop-filter treatment

Mobile:

- orbital light
- restrained particles or lower frame-rate canvas activity
- subtle fold open/close motion
- button and action hover/tap feedback
- reduced live blur during unstable states

## Technical Design

### State model in `app.js`

Add a small visual state controller for mobile:

- keep existing `isMobileFx`, `isScrolling`, and `freezeVisualFx`
- introduce a restore mode such as `fxState = "active" | "warming" | "stable"`
- mirror that state onto root classes for CSS targeting

The controller should:

- set `stable` on hide
- set `warming` on show
- promote to `active` after a guarded timeout when the page is visible and not frozen
- re-enter `stable` during problematic restore or if another hide occurs mid-transition

This isolates recovery logic from the drawing loop and keeps the CSS and JS responsibilities clear.

### Canvas and heavy effect throttling

For mobile and restore states:

- skip more frames while `stable` or `warming`
- reduce spark drawing further or suppress it entirely outside `active`
- keep ripples lightweight
- avoid immediate full-canvas burst on restore

The goal is to stop the browser from restoring into multiple heavy compositing layers at once.

### CSS material tiers in `styles.css`

Introduce clearer tiers for surfaces:

- `hero glass`
- `secondary glass`
- `action pill`
- `light surface`
- `stable mobile surface`

Mobile stable/warming classes should:

- disable or greatly reduce `backdrop-filter`
- reduce blur intensity on fixed background layers
- simplify halos and grid overlays
- lower shadow spread

Light mode classes should:

- unify nav pills, hero card, contact links, writing console, and form fields
- reduce isolated border contrast
- rely on layered gradients and soft highlights instead of stark solid fills

### Hero layout polish

Without changing the current page architecture:

- tighten the relationship between avatar stage and identity copy on mobile
- smooth the top section spacing so the hero reads as one composed unit
- ensure contact actions fill width elegantly on small screens
- reduce the feeling that the hero card and the rest of the page are separate boxes

## Content Structure Impact

No new sections are required. Existing sections remain:

- header
- hero / identity
- fold stack
- writing
- projects
- lab
- contact

The design pass focuses on visual hierarchy and motion behavior, not content model changes.

## Error Handling and Edge Cases

- If `pageshow` fires from bfcache restore, the page must not immediately resume full heavy FX.
- If the page becomes hidden during `warming`, cancel the transition and return to `stable`.
- If reduced motion is requested, never promote to a higher motion state than the user preference allows.
- If a browser class already requests lighter compatibility behavior, recovery classes should compose with that behavior rather than fight it.

## Testing Strategy

### Manual browser checks

Primary:

- Android system browser on the user's device class

Secondary:

- Chrome Android-style viewport
- Safari-class fallback behavior remains acceptable
- Firefox fallback remains acceptable

### Verification scenarios

1. Open homepage fresh on mobile.
2. Scroll through hero and first fold.
3. Quickly return to the homepage using browser back / gesture restore behavior.
4. Confirm there is no obvious gray blur wash, ghosted layering, or delayed card sharpness.
5. Toggle light mode at the top of the page.
6. Inspect hero, nav, contact links, form fields, and fold cards in light mode.
7. Repeat return/restore in light mode.

### Success criteria

- No visually broken restore frame that dominates the hero.
- Mobile remains smooth enough during scroll and return.
- Light mode surfaces feel cohesive and premium.
- Personal identity remains the first-viewport signal.

## Implementation Scope

Files expected to change:

- `app.js`
- `styles.css`

Possible optional change:

- `index.html` only if a minimal structural hook is needed for hero polish, and only after careful encoding-safe handling.

## Risks and Mitigations

### Risk: over-correcting motion

Mitigation:

- keep desktop richer
- restore a lighter mobile active state after the page stabilizes

### Risk: light mode becomes too flat

Mitigation:

- use layered gradients, inner highlights, and subtle depth rather than removing all emphasis

### Risk: local source encoding confusion in `index.html`

Mitigation:

- avoid editing `index.html` unless necessary
- prefer CSS/JS-driven polish first

## Decision Summary

Approved user choices reflected in this spec:

- Performance strategy: balanced (`2`)
- Light mode direction: luxury glass (`1`)
- Hero positioning: mixed personal-first with stronger supporting background (`3`)

## Next Step

After user review of this spec, write an implementation plan and then apply the changes in focused edits to `app.js` and `styles.css`.
