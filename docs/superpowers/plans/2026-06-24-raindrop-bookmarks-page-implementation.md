# Raindrop Bookmarks Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, static, shareable bookmarks page from the Raindrop CSV export and link it from the existing site.

**Architecture:** Convert the Raindrop CSV export into a committed local data file, then render a dedicated `bookmarks.html` page with client-side search and tag filtering. Keep the homepage changes narrow by adding only a small navigation entry into the new page.

**Tech Stack:** Static HTML, vanilla JavaScript, shared CSS, GitHub Pages

---

### Task 1: Create the committed bookmark dataset

**Files:**
- Create: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\github-sync-liquid-glass-blog\assets\bookmarks-data.js`
- Test: manual inspection of generated fields

- [ ] **Step 1: Normalize the CSV source fields**

Map CSV rows into objects with:

```js
{
  id: "1771553306",
  title: "个人设置 - ToioTo AI",
  url: "https://sub2api.toioto.org/profile",
  note: "0.15倍率",
  excerpt: "",
  tags: [],
  created: "2026-06-24T06:53:08.550Z",
  cover: "https://rdl.ink/render/...",
  favorite: false
}
```

- [ ] **Step 2: Store the normalized dataset in a static JS file**

Export the array in a browser-friendly format:

```js
window.BOOKMARKS_DATA = [
  {
    id: "1771553306",
    title: "个人设置 - ToioTo AI",
    url: "https://sub2api.toioto.org/profile",
    note: "0.15倍率",
    excerpt: "",
    tags: [],
    created: "2026-06-24T06:53:08.550Z",
    cover: "https://rdl.ink/render/https%3A%2F%2Fsub2api.toioto.org%2Fprofile",
    favorite: false
  }
];
```

- [ ] **Step 3: Verify the dataset shape**

Open the file and confirm:
- every entry has `title`
- every entry has `url`
- `tags` is always an array
- `favorite` is boolean

- [ ] **Step 4: Commit checkpoint**

```bash
git add assets/bookmarks-data.js
git commit -m "feat: add raindrop bookmarks dataset"
```

### Task 2: Build the standalone bookmarks page

**Files:**
- Create: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\github-sync-liquid-glass-blog\bookmarks.html`
- Create: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\github-sync-liquid-glass-blog\bookmarks.js`
- Modify: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\github-sync-liquid-glass-blog\styles.css`
- Test: browser-side rendering and filter behavior

- [ ] **Step 1: Create the bookmarks page shell**

The page should include:

```html
<body class="bookmarks-page">
  <header class="site-header glass-pill">...</header>
  <main class="bookmarks-shell">
    <section class="bookmarks-hero">...</section>
    <section class="bookmarks-tools">...</section>
    <section class="bookmarks-results">...</section>
  </main>
  <script src="./assets/bookmarks-data.js"></script>
  <script src="./bookmarks.js"></script>
</body>
```

- [ ] **Step 2: Add search and tag filter controls**

Use one search field and a tag row:

```html
<input id="bookmark-search" type="search" placeholder="搜索标题、备注、网址、标签" />
<div id="bookmark-tags" class="tag-row"></div>
<p id="bookmark-count" class="bookmarks-count"></p>
```

- [ ] **Step 3: Render bookmark cards in `bookmarks.js`**

Implement a focused renderer:

```js
const allBookmarks = [...window.BOOKMARKS_DATA].sort(
  (a, b) => new Date(b.created) - new Date(a.created)
);
```

Each card should show:
- title
- note or excerpt
- hostname
- created date
- tags

- [ ] **Step 4: Add client-side filtering**

Filtering logic should check:

```js
const haystack = [
  bookmark.title,
  bookmark.note,
  bookmark.excerpt,
  bookmark.url,
  bookmark.tags.join(" ")
].join(" ").toLowerCase();
```

- [ ] **Step 5: Add scoped bookmarks-page styles**

Add page-scoped styles for:
- `.bookmarks-page`
- `.bookmarks-shell`
- `.bookmarks-hero`
- `.bookmark-grid`
- `.bookmark-card`
- `.bookmark-meta`
- `.bookmark-empty`

Keep mobile blur inexpensive.

- [ ] **Step 6: Verify rendering**

Confirm the page:
- loads all bookmarks
- shows a correct count
- updates on search
- updates on tag click

- [ ] **Step 7: Commit checkpoint**

```bash
git add bookmarks.html bookmarks.js styles.css
git commit -m "feat: add public bookmarks page"
```

### Task 3: Link the new page from the homepage

**Files:**
- Modify: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\github-sync-liquid-glass-blog\index.html`
- Test: manual link inspection

- [ ] **Step 1: Add a small visible entry to the homepage**

Add one link to the new page in an existing lightweight surface such as the header nav or contact action row:

```html
<a href="./bookmarks.html">Bookmarks</a>
```

- [ ] **Step 2: Verify integration stays narrow**

Check that the homepage still behaves the same outside the new link.

- [ ] **Step 3: Commit checkpoint**

```bash
git add index.html
git commit -m "feat: link homepage to bookmarks page"
```

### Task 4: Verify and publish

**Files:**
- Modify: none
- Test: `bookmarks.html`, `bookmarks.js`, `assets/bookmarks-data.js`, `index.html`, `styles.css`

- [ ] **Step 1: Run JavaScript syntax verification**

Run:

```powershell
@'
new Function(require("fs").readFileSync("C:\\Users\\32452\\Documents\\Codex\\2026-06-22\\https-21st-dev-community-components-5\\github-sync-liquid-glass-blog\\bookmarks.js","utf8"));
new Function(require("fs").readFileSync("C:\\Users\\32452\\Documents\\Codex\\2026-06-22\\https-21st-dev-community-components-5\\github-sync-liquid-glass-blog\\app.js","utf8"));
'@ | "C:\\Users\\32452\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe" -
```

Expected: no output, exit code `0`.

- [ ] **Step 2: Verify key hooks**

Search for:

```powershell
Select-String -Path "C:\\Users\\32452\\Documents\\Codex\\2026-06-22\\https-21st-dev-community-components-5\\github-sync-liquid-glass-blog\\bookmarks.html","C:\\Users\\32452\\Documents\\Codex\\2026-06-22\\https-21st-dev-community-components-5\\github-sync-liquid-glass-blog\\bookmarks.js","C:\\Users\\32452\\Documents\\Codex\\2026-06-22\\https-21st-dev-community-components-5\\github-sync-liquid-glass-blog\\index.html" -Pattern "BOOKMARKS_DATA|bookmark-search|bookmark-tags|bookmarks.html"
```

Expected: all hooks present.

- [ ] **Step 3: Publish via git**

Commit any remaining intended changes and push to GitHub Pages source branch.

- [ ] **Step 4: Check live site**

Confirm:
- homepage link reaches the bookmarks page
- search works
- tag filtering works
- page is readable on mobile
