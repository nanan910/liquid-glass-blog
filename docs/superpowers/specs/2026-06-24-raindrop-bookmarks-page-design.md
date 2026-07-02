# 2026-06-24 Raindrop Bookmarks Page Design

## Context

The user wants to publish bookmarks exported from Raindrop.io on the existing personal website.

Constraints confirmed:

- Use a free solution only.
- Continue using the current GitHub Pages deployment.
- Start by publishing the full export without filtering entries.
- The result should be a separate public page, not an embedded fold section on the homepage.

Available export formats inside `D:\下载\export.zip`:

- `export.csv`
- `export.html`
- `export.txt`

The CSV export is the best source for a maintainable static page.

## Goals

- Create a standalone public bookmarks page that can be linked and shared directly.
- Keep the solution fully static and GitHub Pages compatible.
- Make bookmarks searchable and easy to browse by tag.
- Preserve enough visual continuity with the current site that the new page feels like part of the same project.
- Allow future updates by replacing or regenerating one local data file instead of hand-editing HTML.

## Non-Goals

- No paid services.
- No Raindrop API integration.
- No backend, database, or login.
- No attempt to automatically sync future exports in this pass.
- No filtering of sensitive links in this first version.

## Recommended Approach

Build a dedicated `bookmarks.html` page powered by a local data file generated from `export.csv`.

Recommended structure:

- `bookmarks.html`: standalone UI shell
- `bookmarks-data.js` or `bookmarks-data.json`: parsed bookmark dataset
- `bookmarks.js`: render, search, and filter logic
- optional small style additions inside the shared stylesheet, or a dedicated page stylesheet if needed

This approach is preferred over a fully hard-coded page because:

- it keeps updates manageable
- it supports search and filtering cleanly
- it stays fully static and free
- it avoids trying to restyle Raindrop's exported HTML

## Data Model

The CSV export includes columns such as:

- `id`
- `title`
- `note`
- `excerpt`
- `url`
- `tags`
- `created`
- `cover`
- `highlights`
- `favorite`

For the page, each bookmark entry should be normalized into:

- `id`
- `title`
- `url`
- `note`
- `excerpt`
- `tags` as an array
- `created`
- `cover`
- `favorite`

Display preference:

- prefer `title`
- show `note` if present
- otherwise show `excerpt` if present
- use `tags` for filtering and metadata chips
- use `created` for sorting
- use `cover` only if it renders reliably and does not slow the page too much

## Page Experience

The bookmarks page should feel like a public resource library rather than a copy of the homepage.

Planned page sections:

1. Top navigation band
2. Intro header with page title and short description
3. Search and filter controls
4. Bookmark results grid/list
5. Empty state for no matches

The page should prioritize scanning and repeated use over dramatic hero visuals.

## UI Design Direction

Follow the current dark-only direction and keep the motion restrained.

Desired feel:

- dark resource gallery
- clean glass-like surfaces, but lighter than the homepage
- compact metadata chips
- clear title-first hierarchy
- no heavy blur dependency on mobile

The bookmarks page should not rely on expensive compositing that could reintroduce the mobile browser issues recently addressed.

## Interaction Design

### Search

- One search input filters by title, note, excerpt, URL, and tags.
- Search should update client-side instantly.

### Tag filtering

- Extract tags from the dataset and render them as clickable chips.
- Include an `All` state.
- If a bookmark has no tags, it remains discoverable through search.

### Sorting

First version should sort by `created` descending so the newest imports appear first.

Optional metadata display:

- created date
- tag chips
- favorite marker only if visually useful

### Link behavior

- Bookmark cards open the original link in a new tab.
- The title should be the strongest click target.

## Technical Design

### Data preparation

Convert `export.csv` into a frontend-friendly local dataset.

Preferred implementation:

- create a one-time conversion script or direct checked-in generated data file
- store the result in a static JS or JSON file committed with the site

For this implementation cycle, generation may be manual or script-assisted, but the committed output must be static and GitHub Pages ready.

### Rendering

`bookmarks.js` should:

- load the local dataset
- normalize missing fields
- compute unique tags
- render the tag bar
- render the bookmark list
- update results when search or tag state changes

### Styling

Prefer a dedicated page stylesheet only if shared styles become awkward.

If the shared stylesheet is extended, keep new selectors scoped to the bookmarks page to avoid homepage regressions.

### Homepage integration

Add one clear link from the homepage to the bookmarks page.

This should be a small but visible navigation path, not a major homepage restructure.

## Accessibility and Performance

- Search input needs a clear label.
- Cards should preserve readable contrast.
- Avoid loading heavy preview images on mobile if they harm performance.
- The first version can omit image covers if they make the page noisy or slow.

## Update Workflow

Free maintenance path:

1. Export bookmarks from Raindrop.
2. Replace the local source data file or regenerate the derived dataset.
3. Commit and push to GitHub Pages.

This keeps the workflow simple and fully free.

## Risks and Mitigations

### Risk: the export contains private or awkward links

Mitigation:

- publish full export first as requested
- keep the data file easy to edit later for removals

### Risk: the page becomes too heavy with covers

Mitigation:

- make covers optional
- prioritize text-first cards

### Risk: homepage style rules leak into bookmarks page

Mitigation:

- scope new styles by page-level class or body attribute

## Success Criteria

- A standalone bookmarks page exists and is reachable from the site.
- The page loads on GitHub Pages with no paid services.
- Users can search bookmarks and filter by tag.
- The page remains usable on mobile.
- The current homepage does not regress.

## Next Step

After approval, write an implementation plan and then build:

- data file generation path
- bookmarks page
- filter/search behavior
- homepage link to the new page
