const root = document.documentElement;
const canvas = document.querySelector("#aurora-canvas");
const ctx = canvas.getContext("2d");
const pointer = { x: window.innerWidth * 0.55, y: window.innerHeight * 0.32 };
let width = 0;
let height = 0;
let dpr = 1;
let orbs = [];
let sparks = [];
let ripples = [];
let isMobileFx = false;
let pointerFrame = 0;
let frameTick = 0;
let allowMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let isScrolling = false;
let freezeVisualFx = false;
let scrollTimer = 0;
let fxState = "active";
let warmupTimer = 0;
let bookmarkPageSizeCache = 0;
let privacyGateBusy = false;
let privateBookmarkItems = [];
let privateBookmarksUnlocked = false;
let quoteTypingTimer = 0;
let quoteMidnightTimer = 0;
let aiRadarBusy = false;
let aiRadarUpdatedAt = null;
let aiRadarClockTimer = 0;
let aiRadarStatusMessage = "\u5df2\u63a5\u5165\u53ef\u516c\u5f00\u8bbf\u95ee\u7684\u70ed\u70b9\u6e90";
const bookmarkData = [...(window.BOOKMARKS_DATA || [])];
const ua = navigator.userAgent;
const isSafari =
  /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|OPiOS|SamsungBrowser/i.test(ua);
const isFirefox = /Firefox|FxiOS/i.test(ua);
const isChromium = /Chrome|Chromium|CriOS|Edg|OPR|SamsungBrowser/i.test(ua);

// 分类标签与 scripts/build-bookmarks-from-html.mjs 中的 CATEGORY_LABELS 保持一致
const categoryLabels = {
  "ai-api": { title: "AI API 中转", description: "模型接口、API 中转站与开发者平台" },
  "ai-tools": { title: "AI 工具", description: "AI 应用、写作、绘图与效率助手" },
  "survey": { title: "问卷调研", description: "问卷、样本与调研任务平台" },
  "video": { title: "影视直播", description: "影视、直播、IPTV 与视频解析" },
  "music": { title: "音乐音频", description: "音乐、音源与音频解析" },
  "netdisk": { title: "网盘资源", description: "网盘搜索、聚合与文件传输" },
  "study": { title: "学习资源", description: "课程、练习、题库与学生福利" },
  "office": { title: "文档办公", description: "文档、表格、格式转换与办公工具" },
  "reading": { title: "阅读书库", description: "电子书、小说与阅读创作" },
  "shopping": { title: "购物货源", description: "电商货源、拼团与线报活动" },
  "software": { title: "游戏软件", description: "游戏、破解、激活与系统工具" },
  "community": { title: "资讯社区", description: "热点、吃瓜、社区与个人博客" },
  "network": { title: "网络工具", description: "代理 IP、域名与网络服务" },
  "nav": { title: "搜索导航", description: "搜索、导航、素材与实用站点" },
  "airport": { title: "机场订阅", description: "机场、订阅与订阅转换" },
  "account": { title: "账号邮箱", description: "账号、邮箱、临时邮件与接码" },
  misc: { title: "其他书签", description: "未单独归类的通用链接" },
};


function applyFxState(nextState) {
  fxState = nextState;
  root.classList.toggle("fx-stable", nextState === "stable");
  root.classList.toggle("fx-warming", nextState === "warming");
  root.classList.toggle("fx-active", nextState === "active");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getBookmarkSite(url) {
  if (!url) return "unknown";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "unknown";
  } catch {
    return "unknown";
  }
}

function cleanSummaryText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 48 ? `${text.slice(0, 47)}...` : text;
}

function getPublicBookmarks() {
  return bookmarkData
    .map((bookmark) => {
      const key = categoryLabels[bookmark.categoryKey] ? bookmark.categoryKey : "misc";
      const label = categoryLabels[key];
      return {
        ...bookmark,
        title: (bookmark.title || "Untitled Bookmark").trim(),
        site: bookmark.site || getBookmarkSite(bookmark.url || ""),
        summary: cleanSummaryText(bookmark.summary || bookmark.excerpt || ""),
        categoryKey: key,
        categoryTitle: label.title,
        categoryDescription: label.description,
      };
    })
    .filter((bookmark) => bookmark.url && bookmark.title)
    .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
}
function groupBookmarks(bookmarks) {
  const groups = new Map();
  const pageSize = getBookmarkPageSize();

  for (const bookmark of bookmarks) {
    if (!groups.has(bookmark.categoryKey)) {
      groups.set(bookmark.categoryKey, {
        key: bookmark.categoryKey,
        title: bookmark.categoryTitle,
        description: bookmark.categoryDescription,
        items: [],
      });
    }
    groups.get(bookmark.categoryKey).items.push(bookmark);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      pages: chunkItems(group.items, pageSize),
      total: group.items.length,
    }))
    .sort((a, b) => b.total - a.total);
}

function appendPrivateGroup(groups) {
  const vault = window.PRIVATE_BOOKMARKS_VAULT;
  if (!vault) return groups;
  return [
    ...groups,
    {
      key: "private-vault",
      title: "\u9690\u79c1\u5206\u7c7b",
      description: "\u9700\u8981\u5bc6\u7801\u9a8c\u8bc1\u540e\u67e5\u770b\u7684\u79c1\u5bc6\u94fe\u63a5",
      total: vault.count || 0,
      pages: [],
      isPrivate: true,
    },
  ];
}

function getBookmarkPageSize() {
  return window.matchMedia("(max-width: 820px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
    ? 4
    : 9;
}

function chunkItems(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

function createBookmarkItem(bookmark) {
  const summary = bookmark.summary || "\u76f4\u63a5\u6253\u5f00\u539f\u94fe\u63a5\u67e5\u770b\u8be6\u60c5\u3002";
  return `
    <article class="bookmark-mini-card">
      <h3><a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noreferrer">${escapeHtml(bookmark.title)}</a></h3>
      <p class="bookmark-mini-summary">${escapeHtml(summary)}</p>
    </article>
  `;
}

function createBookmarkPages(group) {
  return group.pages
    .map(
      (pageItems, pageIndex) => `
        <section
          class="bookmark-page"
          data-page-index="${pageIndex}"
          aria-label="${escapeHtml(group.title)} page ${pageIndex + 1}"
        >
          <div class="bookmark-mini-grid">
            ${pageItems.map((bookmark) => createBookmarkItem(bookmark)).join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function createPrivateDrawer(group, index) {
  return `
    <section class="bookmark-drawer bookmark-drawer-private fold-panel" data-private-drawer data-drawer-index="${index}">
      <button class="bookmark-drawer-toggle" type="button" data-private-gate-open aria-expanded="false">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(group.title)}</strong>
        <em>${escapeHtml(group.description)} / ${group.total} \u6761</em>
      </button>
      <div class="bookmark-fold-stage" hidden data-private-stage>
        <div class="bookmark-fold-content" data-private-content></div>
      </div>
    </section>
  `;
}

function renderBookmarkDrawers() {
  const container = document.querySelector("#bookmark-drawers");
  const total = document.querySelector("#bookmark-total");
  const groupsCount = document.querySelector("#bookmark-groups");
  if (!container || !total || !groupsCount) return;

  const bookmarks = getPublicBookmarks();
  const groups = appendPrivateGroup(groupBookmarks(bookmarks));

  total.textContent = String(bookmarks.length);
  groupsCount.textContent = String(groups.length);

  container.innerHTML = groups
    .map(
      (group, index) =>
        group.isPrivate
          ? createPrivateDrawer(group, index)
          : `
        <section class="bookmark-drawer fold-panel ${index === 0 ? "is-open" : ""}" data-bookmark-drawer data-drawer-index="${index}">
          <button class="bookmark-drawer-toggle" type="button" aria-expanded="${index === 0 ? "true" : "false"}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(group.title)}</strong>
            <em>${escapeHtml(group.description)} / ${group.total} \u6761</em>
          </button>
          <div class="bookmark-fold-stage" ${index === 0 ? "" : "hidden"}>
            <div class="bookmark-fold-content">
              <div
                class="bookmark-pages-shell"
                data-pages-shell
                data-group-index="${index}"
                data-page-total="${group.pages.length}"
              >
                <div class="bookmark-pages-track">
                  ${createBookmarkPages(group)}
                </div>
              </div>
              <div class="bookmark-pages-footer ${group.pages.length > 1 ? "" : "is-single"}">
                <button
                  class="bookmark-page-button"
                  type="button"
                  data-page-prev
                  data-group-index="${index}"
                  aria-label="${escapeHtml(group.title)} previous page"
                >
                  <span aria-hidden="true">&lsaquo;</span>
                </button>
                <p class="bookmark-page-status">
                  <span data-page-current>${group.pages.length ? 1 : 0}</span>
                  <span>/</span>
                  <span>${group.pages.length}</span>
                </p>
                <button
                  class="bookmark-page-button"
                  type="button"
                  data-page-next
                  data-group-index="${index}"
                  aria-label="${escapeHtml(group.title)} next page"
                >
                  <span aria-hidden="true">&rsaquo;</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      `
    )
    .join("");

  bindBookmarkPagination();
  bindBookmarkDrawerMotion();
  bindPrivateGate();
  renderPrivateDrawerContent();
  queueBookmarkLayoutRefresh();
  bookmarkPageSizeCache = getBookmarkPageSize();
}

function bindBookmarkPagination() {
  const shells = document.querySelectorAll("[data-pages-shell]");
  const previousButtons = document.querySelectorAll("[data-page-prev]");
  const nextButtons = document.querySelectorAll("[data-page-next]");

  for (const shell of shells) {
    const total = Number(shell.dataset.pageTotal || "1");
    updateBookmarkPager(shell, 0, total);
    shell.addEventListener(
      "scroll",
      () => {
        const page = Math.round(shell.scrollLeft / Math.max(shell.clientWidth, 1));
        updateBookmarkPager(shell, page, total);
      },
      { passive: true }
    );
  }

  for (const button of previousButtons) {
    button.addEventListener("click", () => stepBookmarkPage(button, -1));
  }

  for (const button of nextButtons) {
    button.addEventListener("click", () => stepBookmarkPage(button, 1));
  }
}

function refreshBookmarkShellHeights() {
  document.querySelectorAll("[data-pages-shell]").forEach((shell) => {
    const page = Math.round(shell.scrollLeft / Math.max(shell.clientWidth, 1));
    updateBookmarkPager(shell, page, Number(shell.dataset.pageTotal || "1"));
  });
}

function queueBookmarkLayoutRefresh() {
  requestAnimationFrame(() => {
    refreshBookmarkShellHeights();
    requestAnimationFrame(refreshBookmarkShellHeights);
  });
}

function stepBookmarkPage(button, direction) {
  const groupIndex = button.dataset.groupIndex;
  const shell = document.querySelector(`[data-pages-shell][data-group-index="${groupIndex}"]`);
  if (!shell) return;
  const total = Number(shell.dataset.pageTotal || "1");
  const current = Math.round(shell.scrollLeft / Math.max(shell.clientWidth, 1));
  const next = Math.min(Math.max(current + direction, 0), total - 1);
  shell.scrollTo({
    left: shell.clientWidth * next,
    behavior: "smooth",
  });
  shell.classList.add("is-paging");
  window.setTimeout(() => shell.classList.remove("is-paging"), 260);
  updateBookmarkPager(shell, next, total);
  queueBookmarkLayoutRefresh();
}

function updateBookmarkPager(shell, pageIndex, total) {
  const drawer = shell.closest(".bookmark-drawer");
  if (!drawer) return;
  const currentLabel = drawer.querySelector("[data-page-current]");
  const previousButton = drawer.querySelector("[data-page-prev]");
  const nextButton = drawer.querySelector("[data-page-next]");
  const safeIndex = Math.min(Math.max(pageIndex, 0), Math.max(total - 1, 0));

  if (currentLabel) {
    currentLabel.textContent = String(safeIndex + 1);
  }
  if (previousButton) {
    previousButton.disabled = safeIndex === 0 || total <= 1;
  }
  if (nextButton) {
    nextButton.disabled = safeIndex >= total - 1 || total <= 1;
  }
  shell.style.setProperty("--bookmark-page-index", String(safeIndex));
}

function renderPrivateDrawerContent() {
  const drawer = document.querySelector("[data-private-drawer]");
  const content = drawer?.querySelector("[data-private-content]");
  const stage = drawer?.querySelector("[data-private-stage]");
  const toggle = drawer?.querySelector("[data-private-gate-open]");
  if (!drawer || !content || !stage || !toggle || !privateBookmarksUnlocked) return;

  const pages = chunkItems(privateBookmarkItems, getBookmarkPageSize());
  const group = {
    title: "\u9690\u79c1\u5206\u7c7b",
    pages,
  };
  const groupIndex = drawer.dataset.drawerIndex || "private";

  content.innerHTML = `
    <div
      class="bookmark-pages-shell private-pages-shell"
      data-pages-shell
      data-group-index="${groupIndex}"
      data-page-total="${pages.length}"
    >
      <div class="bookmark-pages-track">
        ${createBookmarkPages(group)}
      </div>
    </div>
    <div class="bookmark-pages-footer ${pages.length > 1 ? "" : "is-single"}">
      <button class="bookmark-page-button" type="button" data-page-prev data-group-index="${groupIndex}" aria-label="\u9690\u79c1\u5206\u7c7b\u4e0a\u4e00\u9875">
        <span aria-hidden="true">&lsaquo;</span>
      </button>
      <p class="bookmark-page-status">
        <span data-page-current>${pages.length ? 1 : 0}</span>
        <span>/</span>
        <span>${pages.length}</span>
      </p>
      <button class="bookmark-page-button" type="button" data-page-next data-group-index="${groupIndex}" aria-label="\u9690\u79c1\u5206\u7c7b\u4e0b\u4e00\u9875">
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </div>
  `;

  drawer.classList.add("is-open", "is-unlocked");
  stage.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  toggle.querySelector("em").textContent = `\u5df2\u89e3\u9501\uff0c\u53ef\u76f4\u63a5\u67e5\u770b / ${privateBookmarkItems.length} \u6761`;
  bindBookmarkPagination();
  queueBookmarkLayoutRefresh();
  drawer.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindBookmarkDrawerMotion() {
  const drawers = document.querySelectorAll("[data-bookmark-drawer]");
  for (const drawer of drawers) {
    const stage = drawer.querySelector(".bookmark-fold-stage");
    const content = drawer.querySelector(".bookmark-fold-content");
    const toggle = drawer.querySelector(".bookmark-drawer-toggle");
    if (!stage || !content || !toggle) continue;
    syncBookmarkDrawerHeight(drawer, content);
    toggle.addEventListener("click", () => {
      toggleBookmarkDrawer(drawer, stage, content, toggle);
    });
    drawer.addEventListener("click", (event) => {
      if (event.target && event.target.closest(".bookmark-page-button, a")) return;
    });
  }
}

function syncBookmarkDrawerHeight(drawer, content) {
  if (!drawer || !content) return;
  return;
}

function toggleBookmarkDrawer(drawer, stage, content, toggle) {
  const isOpen = drawer.classList.contains("is-open");
  drawer.classList.toggle("is-open", !isOpen);
  toggle.setAttribute("aria-expanded", String(!isOpen));
  if (isOpen) {
    window.setTimeout(() => {
      stage.hidden = true;
    }, 440);
    return;
  }

  stage.hidden = false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncBookmarkDrawerHeight(drawer, content);
    });
  });
}

function ensurePrivateGateModal() {
  let modal = document.querySelector("#private-gate-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "private-gate-modal";
  modal.className = "private-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="private-modal-backdrop" data-private-close></div>
      <section class="private-modal-panel liquid-card" role="dialog" aria-modal="true" aria-labelledby="private-modal-title">
        <button class="private-modal-close" type="button" data-private-close aria-label="\u5173\u95ed">&times;</button>
      <p class="eyebrow">\u9690\u79c1\u5206\u7c7b</p>
      <h2 id="private-modal-title">\u8f93\u5165\u8bbf\u95ee\u5bc6\u7801</h2>
      <p class="private-modal-copy">\u8fd9\u91cc\u6536\u7eb3\u4e0d\u9002\u5408\u76f4\u63a5\u516c\u5f00\u5c55\u793a\u7684\u94fe\u63a5\uff0c\u9700\u8981\u9a8c\u8bc1\u540e\u624d\u80fd\u7ee7\u7eed\u67e5\u770b\u3002</p>
      <div class="private-modal-form">
        <input id="private-modal-password" type="password" autocomplete="current-password" placeholder="\u8f93\u5165\u8bbf\u95ee\u5bc6\u7801" />
        <button id="private-modal-submit" class="button primary" type="button">\u9a8c\u8bc1</button>
      </div>
      <p id="private-modal-status" class="private-modal-status" role="status">\u5df2\u52a0\u5bc6 ${window.PRIVATE_BOOKMARKS_VAULT?.count || 0} \u6761\u94fe\u63a5</p>
    </section>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-private-close]")) {
      closePrivateGateModal();
    }
  });
  modal.querySelector("#private-modal-submit")?.addEventListener("click", verifyPrivateGatePassword);
  modal.querySelector("#private-modal-password")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      verifyPrivateGatePassword();
    }
    if (event.key === "Escape") {
      closePrivateGateModal();
    }
  });

  return modal;
}

function openPrivateGateModal() {
  const modal = ensurePrivateGateModal();
  modal.hidden = false;
  document.documentElement.classList.add("private-modal-open");
  const status = modal.querySelector("#private-modal-status");
  if (status) {
    status.textContent = `\u5df2\u52a0\u5bc6 ${window.PRIVATE_BOOKMARKS_VAULT?.count || 0} \u6761\u94fe\u63a5`;
  }
  window.setTimeout(() => modal.querySelector("#private-modal-password")?.focus(), 30);
}

function closePrivateGateModal() {
  const modal = document.querySelector("#private-gate-modal");
  if (!modal) return;
  modal.hidden = true;
  document.documentElement.classList.remove("private-modal-open");
}

function bindPrivateGate() {
  document.querySelectorAll("[data-private-gate-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const drawer = button.closest("[data-private-drawer]");
      const stage = drawer?.querySelector("[data-private-stage]");
      const content = drawer?.querySelector("[data-private-content]");
      if (privateBookmarksUnlocked && drawer && stage && content) {
        toggleBookmarkDrawer(drawer, stage, content, button);
        return;
      }
      openPrivateGateModal();
    });
  });
}

async function verifyPrivateGatePassword() {
  if (privacyGateBusy) return;
  const modal = ensurePrivateGateModal();
  const input = modal.querySelector("#private-modal-password");
  const submit = modal.querySelector("#private-modal-submit");
  const status = modal.querySelector("#private-modal-status");
  const password = input?.value || "";
  if (!password) return;

  privacyGateBusy = true;
  if (submit) submit.textContent = "\u9a8c\u8bc1\u4e2d";
  try {
    privateBookmarkItems = await decryptPrivateBookmarks(password);
    privateBookmarksUnlocked = true;
    input.value = "";
    if (status) status.textContent = "\u5bc6\u7801\u6b63\u786e\uff0c\u9690\u79c1\u5206\u7c7b\u5df2\u9a8c\u8bc1";
    renderPrivateDrawerContent();
    window.setTimeout(closePrivateGateModal, 260);
  } catch {
    if (status) status.textContent = "\u5bc6\u7801\u4e0d\u5bf9\uff0c\u8bf7\u91cd\u8bd5";
    input?.classList.add("is-shaking");
    window.setTimeout(() => input?.classList.remove("is-shaking"), 280);
  } finally {
    privacyGateBusy = false;
    if (submit) submit.textContent = "\u9a8c\u8bc1";
  }
}

async function decryptPrivateBookmarks(password) {
  const vault = window.PRIVATE_BOOKMARKS_VAULT;
  if (!vault) throw new Error("Private vault is unavailable.");
  const salt = base64ToBytes(vault.salt);
  const iv = base64ToBytes(vault.iv);
  const payload = base64ToBytes(vault.data);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: vault.iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function updateFxMode() {
  isMobileFx =
    window.matchMedia("(max-width: 820px)").matches ||
    window.matchMedia("(pointer: coarse)").matches;
  root.classList.toggle("mobile-fx", isMobileFx);
  root.classList.toggle("desktop-fx", !isMobileFx);
  if (!allowMotion) {
    applyFxState("stable");
    return;
  }
  applyFxState(isMobileFx ? "warming" : "active");
}

function updateBrowserMode() {
  root.classList.toggle("browser-safari", isSafari);
  root.classList.toggle("browser-firefox", isFirefox);
  root.classList.toggle("browser-chromium", isChromium);
}

function resize() {
  updateFxMode();
  allowMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  dpr = Math.min(window.devicePixelRatio || 1, isMobileFx ? 1.1 : 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const orbCount = isMobileFx
    ? Math.max(6, Math.min(12, Math.floor(width / 52)))
    : Math.max(34, Math.min(74, Math.floor(width / 20)));
  const sparkCount = isMobileFx
    ? Math.max(8, Math.min(18, Math.floor(width / 34)))
    : Math.max(90, Math.min(210, Math.floor(width / 7)));

  orbs = Array.from({ length: orbCount }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: (isMobileFx ? 42 : 64) + Math.random() * (isMobileFx ? 56 : 150),
    vx: (Math.random() - 0.5) * (isMobileFx ? 0.22 : 0.76),
    vy: (Math.random() - 0.5) * (isMobileFx ? 0.18 : 0.64),
    hue: [186, 315, 96, 258, 46][index % 5],
    alpha: (isMobileFx ? 0.05 : 0.12) + Math.random() * (isMobileFx ? 0.07 : 0.2),
  }));

  sparks = Array.from({ length: sparkCount }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * (isMobileFx ? 0.42 : 1.18),
    vy: (Math.random() - 0.5) * (isMobileFx ? 0.42 : 1.18),
    hue: [186, 315, 96, 46, 258][index % 5],
    life: Math.random(),
  }));

  const nextPageSize = getBookmarkPageSize();
  if (nextPageSize !== bookmarkPageSizeCache) {
    renderBookmarkDrawers();
  }
}

function paintOrbs() {
  for (const orb of orbs) {
    const dx = orb.x - pointer.x;
    const dy = orb.y - pointer.y;
    const distance = Math.hypot(dx, dy);

    if (!isMobileFx && distance < 360) {
      const force = (360 - distance) / 360;
      orb.vx += (dx / Math.max(distance, 1)) * force * 0.105;
      orb.vy += (dy / Math.max(distance, 1)) * force * 0.105;
    }

    orb.x += orb.vx;
    orb.y += orb.vy;
    orb.vx *= isMobileFx ? 0.996 : 0.992;
    orb.vy *= isMobileFx ? 0.996 : 0.992;

    if (orb.x < -orb.r) orb.x = width + orb.r;
    if (orb.x > width + orb.r) orb.x = -orb.r;
    if (orb.y < -orb.r) orb.y = height + orb.r;
    if (orb.y > height + orb.r) orb.y = -orb.r;

    const glow = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
    glow.addColorStop(0, `hsla(${orb.hue}, 100%, 70%, ${orb.alpha})`);
    glow.addColorStop(0.45, `hsla(${orb.hue}, 100%, 62%, ${orb.alpha * 0.42})`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSparks() {
  ctx.lineWidth = 1;
  for (const spark of sparks) {
    const dx = pointer.x - spark.x;
    const dy = pointer.y - spark.y;
    const distance = Math.hypot(dx, dy);

    if (!isMobileFx && distance < 320) {
      spark.vx += (dx / Math.max(distance, 1)) * 0.024;
      spark.vy += (dy / Math.max(distance, 1)) * 0.024;
      ctx.strokeStyle = `hsla(${spark.hue}, 100%, 72%, ${0.28 * (1 - distance / 320)})`;
      ctx.beginPath();
      ctx.moveTo(spark.x, spark.y);
      ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
    }

    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vx *= 0.986;
    spark.vy *= 0.986;
    spark.life += 0.012;

    if (spark.x < 0 || spark.x > width || spark.y < 0 || spark.y > height) {
      spark.x = Math.random() * width;
      spark.y = Math.random() * height;
      spark.vx = (Math.random() - 0.5) * (isMobileFx ? 0.42 : 1.18);
      spark.vy = (Math.random() - 0.5) * (isMobileFx ? 0.42 : 1.18);
    }

    ctx.fillStyle = `hsla(${spark.hue}, 100%, 72%, ${isMobileFx ? 0.28 : 0.36 + Math.sin(spark.life) * 0.22})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, isMobileFx ? 1 : 1.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintRipples() {
  const maxRipples = isMobileFx ? 3 : 16;
  if (ripples.length > maxRipples) {
    ripples = ripples.slice(-maxRipples);
  }

  ripples = ripples.filter((ripple) => ripple.life < 1);
  for (const ripple of ripples) {
    ripple.life += isMobileFx ? 0.032 : 0.018;
    const radius = ripple.life * (isMobileFx ? 128 : 320);
    ctx.strokeStyle = `hsla(${ripple.hue}, 100%, 72%, ${(isMobileFx ? 0.45 : 0.62) * (1 - ripple.life)})`;
    ctx.lineWidth = isMobileFx ? 1.2 : 2.8;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function paint() {
  frameTick += 1;

  if (freezeVisualFx) {
    requestAnimationFrame(paint);
    return;
  }

  if (
    isMobileFx &&
    (fxState !== "active"
      ? frameTick % (fxState === "stable" ? 4 : 3) !== 0
      : frameTick % 2 === 1 || (isScrolling && frameTick % 3 !== 0))
  ) {
    requestAnimationFrame(paint);
    return;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  paintOrbs();

  if (!isMobileFx && !isScrolling) {
    paintSparks();
  } else if (fxState === "active" && !isScrolling && frameTick % 8 === 0) {
    paintSparks();
  }

  paintRipples();
  ctx.globalCompositeOperation = "source-over";
  requestAnimationFrame(paint);
}

function movePointer(event) {
  const nextX = event.clientX;
  const nextY = event.clientY;
  if (pointerFrame) return;

  pointerFrame = requestAnimationFrame(() => {
    pointer.x = nextX;
    pointer.y = nextY;
    root.style.setProperty("--mx", `${pointer.x}px`);
    root.style.setProperty("--my", `${pointer.y}px`);
    pointerFrame = 0;
  });
}

function pushRipple(event) {
  if (isMobileFx && ripples.length > 2) return;
  ripples.push({
    x: event.clientX,
    y: event.clientY,
    hue: [186, 315, 96, 46][ripples.length % 4],
    life: 0,
  });
}

function bindTilt() {
  if (isMobileFx || isSafari) return;

  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${y * -6}deg) rotateY(${x * 8}deg) translateY(-3px)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

function bindFilters() {
  const input = document.querySelector("#post-search");
  const tags = [...document.querySelectorAll("[data-filter]")];
  const rows = [...document.querySelectorAll(".post-row")];
  let filter = "all";

  function apply() {
    const query = input.value.trim().toLowerCase();
    rows.forEach((row) => {
      const categoryMatch = filter === "all" || row.dataset.category === filter;
      const textMatch = `${row.dataset.title} ${row.textContent}`.toLowerCase().includes(query);
      row.classList.toggle("is-hidden", !(categoryMatch && textMatch));
    });
  }

  tags.forEach((tag) => {
    tag.addEventListener("click", () => {
      tags.forEach((item) => item.classList.remove("is-active"));
      tag.classList.add("is-active");
      filter = tag.dataset.filter;
      apply();
    });
  });

  input.addEventListener("input", apply);
}

function bindTheme() {
  root.classList.remove("light");
  const toggle = document.querySelector("#theme-toggle");
  if (!toggle) return;
  toggle.hidden = true;
  toggle.setAttribute("aria-hidden", "true");
}

function bindContact() {
  const form = document.querySelector("#message-form");
  if (!form) return;
  const reveal = document.querySelector("#mail-reveal");
  const getContactEmail = (source = form) => {
    const user = source?.dataset.mailUser || form.dataset.mailUser || "3245276254";
    const domain = source?.dataset.mailDomain || form.dataset.mailDomain || "qq.com";
    return `${user}@${domain}`;
  };
  reveal?.addEventListener("click", () => {
    window.location.href = `mailto:${encodeURIComponent(getContactEmail(reveal))}`;
    reveal.textContent = "\u6b63\u5728\u6253\u5f00\u90ae\u7bb1";
    setTimeout(() => {
      reveal.textContent = "\u70b9\u51fb\u6253\u5f00\u90ae\u4ef6\u8054\u7cfb";
    }, 1600);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const message = String(data.get("message") || "").trim();
    if (!message) return;
    const mailTo = getContactEmail(form);
    const name = String(data.get("name") || "").trim() || "\u8bbf\u5ba2";
    const email = String(data.get("email") || "").trim();
    const subject = String(data.get("subject") || "").trim() || "\u6765\u81ea\u5357\u5b89\u535a\u5ba2\u7684\u7559\u8a00";
    const body = [
      `\u6635\u79f0\uff1a${name}`,
      email ? `\u56de\u590d\u90ae\u7bb1\uff1a${email}` : "",
      "",
      message,
    ]
      .filter((line) => line !== "")
      .join("\n");
    window.location.href = `mailto:${encodeURIComponent(mailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const button = form.querySelector("button");
    button.textContent = "\u6b63\u5728\u6253\u5f00\u90ae\u7bb1";
    pushRipple({ clientX: pointer.x, clientY: pointer.y });
    setTimeout(() => {
      button.textContent = "\u6253\u5f00\u90ae\u7bb1\u53d1\u9001";
    }, 1800);
  });
}

function getIsoDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

async function fetchGithubAiTrends() {
  const since = getIsoDateDaysAgo(7);
  const query = encodeURIComponent(`AI OR LLM OR agent OR diffusion created:>${since}`);
  const response = await fetch(
    `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=1`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!response.ok) throw new Error("GitHub radar request failed.");
  const data = await response.json();
  return (data.items || []).slice(0, 1).map((item) => ({
    source: "GitHub",
    title: item.full_name,
    summary: item.description || "\u8fd1\u671f\u65b0\u589e\u7684 AI \u76f8\u5173\u9879\u76ee\u3002",
    url: item.html_url,
    meta: `Stars ${item.stargazers_count || 0}`,
  }));
}

async function fetchHackerNewsAiTrends() {
  const after = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000);
  const response = await fetch(
    `https://hn.algolia.com/api/v1/search_by_date?query=AI%20OR%20LLM%20OR%20OpenAI%20OR%20agent&tags=story&numericFilters=created_at_i>${after}&hitsPerPage=1`
  );
  if (!response.ok) throw new Error("Hacker News radar request failed.");
  const data = await response.json();
  return (data.hits || []).slice(0, 1).map((item) => ({
    source: "HN",
    title: item.title || item.story_title || "AI discussion",
    summary: "\u6765\u81ea Hacker News \u7684 AI \u6280\u672f\u8ba8\u8bba\u3002",
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    meta: `${item.points || 0} points`,
  }));
}

async function fetchHuggingFaceAiTrends() {
  const response = await fetch("https://huggingface.co/api/trending");
  if (!response.ok) throw new Error("Hugging Face radar request failed.");
  const data = await response.json();
  const models = Array.isArray(data?.models)
    ? data.models
    : Array.isArray(data)
      ? data
      : [];
  return models.slice(0, 1).map((item) => {
    const id = item.id || item.modelId || item.repo_id || item.name || item.fullname;
    if (!id) throw new Error("Missing Hugging Face trend id.");
    return {
      source: "Hugging Face",
      title: id,
      summary: item.description || item.pipeline_tag || "\u6b63\u5728\u8d8b\u52bf\u4e0a\u5347\u7684\u5f00\u6e90 AI \u6a21\u578b\u6216 Space\u3002",
      url: item.url || `https://huggingface.co/${id}`,
      meta: item.likes ? `${item.likes} likes` : "\u8d8b\u52bf",
    };
  });
}

async function fetchDevToAiTrends() {
  const response = await fetch("https://dev.to/api/articles?tag=ai&top=1&per_page=1", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("DEV radar request failed.");
  const data = await response.json();
  return (Array.isArray(data) ? data : []).slice(0, 1).map((item) => ({
    source: "DEV",
    title: item.title || "AI article",
    summary: item.description || item.tag_list?.join(" / ") || "\u6765\u81ea DEV \u793e\u533a\u7684 AI \u6280\u672f\u6587\u7ae0\u3002",
    url: item.url,
    meta: `${item.public_reactions_count || 0} reactions`,
  }));
}

function stripHtml(value) {
  const element = document.createElement("div");
  element.innerHTML = value || "";
  return (element.textContent || element.innerText || "").replace(/\s+/g, " ").trim();
}

async function fetchLandianAiTrends() {
  const response = await fetch("https://rsshub.rssforever.com/landiannews/tag/claude");
  if (!response.ok) throw new Error("Landian radar request failed.");
  const text = await response.text();
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const item = doc.querySelector("item");
  if (!item) throw new Error("Missing Landian RSS item.");
  const title = item.querySelector("title")?.textContent?.trim();
  const url = item.querySelector("link")?.textContent?.trim();
  const description = stripHtml(item.querySelector("description")?.textContent || "");
  if (!title || !url) throw new Error("Missing Landian article data.");
  return [
    {
      source: "\u84dd\u70b9\u7f51",
      title,
      summary: description ? `${description.slice(0, 86)}...` : "\u6765\u81ea\u84dd\u70b9\u7f51\u7684 AI \u76f8\u5173\u8d44\u8baf\u3002",
      url,
      meta: item.querySelector("pubDate")?.textContent?.slice(5, 16) || "\u8d44\u8baf",
    },
  ];
}

async function fetchSopilotAiTweets() {
  const response = await fetch("https://sopilot.net/zh/hot-tweets");
  if (!response.ok) throw new Error("SoPilot radar request failed.");
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const articleText = [...doc.querySelectorAll("p")]
    .map((node) => node.textContent?.trim() || "")
    .find((text) => /AI|OpenAI|Claude|ChatGPT|濠电姷顣藉Σ鍛村垂椤忓牆鐒垫い鎺嗗亾缁剧虎鍙冮崺鈧い鎺戝€甸弨銈夋⒒娴ｅ憡鎯堥柟铏焽缁辨挸顫濈捄铏诡槯濠碘槅鍨崇划顖涘垔閹绢喗鐓欑痪鎷岄哺閺嗗獞ent/i.test(text) && text.length > 24);
  const link = [...doc.querySelectorAll('a[href*="x.com/"]')].find((node) =>
    /status\//.test(node.getAttribute("href") || "")
  );
  if (!articleText || !link) throw new Error("Missing SoPilot AI tweet data.");
  const url = new URL(link.getAttribute("href"), "https://sopilot.net").href;
  return [
    {
      source: "SoPilot",
      title: "\u8d77\u7206 X \u70ed\u5e16",
      summary: articleText.slice(0, 120),
      url,
      meta: "\u70ed\u5e16",
    },
  ];
}

async function fetchNewsNowAiHot() {
  const response = await fetch("https://newsnow.busiyi.world/c/aihot");
  if (!response.ok) throw new Error("NewsNow radar request failed.");
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const text = [...doc.querySelectorAll("a, h2, h3, span")]
    .map((node) => node.textContent?.trim() || "")
    .find((value) => /AI|OpenAI|Claude|ChatGPT|濠电姷顣藉Σ鍛村垂椤忓牆鐒垫い鎺嗗亾缁剧虎鍙冮崺鈧い鎺戝€甸弨銈夋⒒娴ｅ憡鎯堥柟铏焽缁辨挸顫濈捄铏诡槯濠碘槅鍨崇划顖涘垔閹绢喗鐓欑痪鎷岄哺閺嗗獞ent/i.test(value) && value.length > 8);
  if (!text) throw new Error("Missing NewsNow AI hot data.");
  return [
    {
      source: "NewsNow",
      title: text.slice(0, 64),
      summary: "\u6765\u81ea NewsNow AIHOT \u70ed\u699c\u7684\u5b9e\u65f6\u805a\u5408\u70ed\u70b9\u3002",
      url: "https://newsnow.busiyi.world/c/aihot",
      meta: "\u70ed\u699c",
    },
  ];
}

async function fetchTopHubTechHot() {
  const response = await fetch("https://tophub.today/c/tech");
  if (!response.ok) throw new Error("TopHub radar request failed.");
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const link = [...doc.querySelectorAll("a")].find((node) =>
    /AI|OpenAI|Claude|ChatGPT|濠电姷顣藉Σ鍛村垂椤忓牆鐒垫い鎺嗗亾缁剧虎鍙冮崺鈧い鎺戝€甸弨銈夋⒒娴ｅ憡鎯堥柟铏焽缁辨挸顫濈捄铏诡槯濠碘槅鍨崇划顖涘垔閹绢喗鐓欑痪鎷岄哺閺嗗獞ent/i.test(node.textContent || "")
  );
  if (!link) throw new Error("Missing TopHub AI hot data.");
  return [
    {
      source: "TopHub",
      title: (link.textContent || "").trim().slice(0, 72),
      summary: "\u6765\u81ea TopHub \u79d1\u6280\u70ed\u699c\u7684 AI \u76f8\u5173\u70ed\u70b9\u3002",
      url: new URL(link.getAttribute("href") || "/c/tech", "https://tophub.today").href,
      meta: "\u79d1\u6280\u699c",
    },
  ];
}

async function fetchStaticAiRadar() {
  const response = await fetch(`./assets/ai-radar.json?v=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Static AI radar data unavailable.");
  const data = await response.json();
  if (!Array.isArray(data.items) || !data.items.length) {
    throw new Error("Static AI radar data is empty.");
  }
  return {
    items: data.items,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    sourceCount: data.sourceCount || new Set(data.items.map((item) => item.source)).size,
  };
}

function formatRadarTime(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function updateAiRadarStatus() {
  const status = document.querySelector("#ai-radar-status");
  if (!status) return;
  const liveTime = formatRadarTime(new Date());
  const fetchTime = aiRadarUpdatedAt ? formatRadarTime(aiRadarUpdatedAt) : liveTime;
  status.textContent = `\u5b9e\u65f6 ${liveTime} \u00b7 \u4e0a\u6b21\u6293\u53d6 ${fetchTime} \u00b7 ${aiRadarStatusMessage}`;
}

function startAiRadarClock(message) {
  aiRadarStatusMessage = message || aiRadarStatusMessage;
  window.clearInterval(aiRadarClockTimer);
  updateAiRadarStatus();
  aiRadarClockTimer = window.setInterval(updateAiRadarStatus, 1000);
}

function renderAiRadar(items, statusText) {
  const grid = document.querySelector("#ai-radar-grid");
  if (!grid) return;
  aiRadarStatusMessage = statusText || aiRadarStatusMessage;
  updateAiRadarStatus();
  if (!items.length) {
    grid.innerHTML = `
      <article class="ai-hot-card is-loading">
        <span>Live / waiting</span>
        <h3>\u6682\u65f6\u6ca1\u6709\u6293\u5230\u771f\u5b9e\u70ed\u70b9</h3>
        <p>\u516c\u5f00 API \u53ef\u80fd\u6682\u65f6\u9650\u6d41\u6216\u8de8\u57df\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u70b9\u51fb\u5237\u65b0\u91cd\u8bd5\u3002</p>
      </article>
    `;
    return;
  }
  grid.innerHTML = items
    .slice(0, 8)
    .map(
      (item) => `
          <article class="ai-hot-card">
            <span>${escapeHtml(item.source)} / ${escapeHtml(item.meta || "Live")}</span>
          <h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
        </article>
      `
    )
    .join("");
}

async function refreshAiRadar() {
  if (aiRadarBusy) return;
  const button = document.querySelector("#ai-radar-refresh");
  aiRadarBusy = true;
  if (button) button.textContent = "\u6293\u53d6\u4e2d";
  try {
    const staticData = await fetchStaticAiRadar();
    aiRadarUpdatedAt = staticData.updatedAt;
    renderAiRadar(staticData.items, `\u5df2\u540c\u6b65 ${staticData.sourceCount} \u4e2a\u514d\u8d39\u516c\u5f00\u70ed\u70b9\u6e90`);
    startAiRadarClock();
  } catch {
    const results = await Promise.allSettled([
      fetchGithubAiTrends(),
      fetchHackerNewsAiTrends(),
      fetchHuggingFaceAiTrends(),
      fetchDevToAiTrends(),
    ]);
    const liveItems = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    aiRadarUpdatedAt = new Date();
    renderAiRadar(liveItems, "\u9759\u6001\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u5df2\u5207\u5230\u6d4f\u89c8\u5668\u53ef\u8bbf\u95ee\u7684\u5907\u7528\u6e90");
    startAiRadarClock();
  } finally {
    aiRadarBusy = false;
    if (button) button.textContent = "\u5237\u65b0";
  }
}

function bindAiRadar() {
  const panel = document.querySelector("#ai-radar-grid");
  if (!panel) return;
  document.querySelector("#ai-radar-refresh")?.addEventListener("click", refreshAiRadar);
  refreshAiRadar();
}

function bindReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextMidnightDelay() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(next.getTime() - now.getTime(), 60_000);
}

function getFallbackQuote() {
  const quotes = [
    {
      text: "\u6162\u6162\u6765\uff0c\u6bcf\u4e00\u6b65\u90fd\u7b97\u6570\u3002",
      source: "\u5357\u5b89\u7684\u5907\u7528\u53e5\u5b50",
    },
    {
      text: "\u522b\u7740\u6025\u8d76\u8def\uff0c\u5148\u628a\u4eca\u5929\u8fc7\u5f97\u6e05\u695a\u4e00\u70b9\u3002",
      source: "\u5357\u5b89\u7684\u5907\u7528\u53e5\u5b50",
    },
    {
      text: "\u4fdd\u6301\u597d\u5947\uff0c\u4f60\u4f1a\u5728\u5f88\u591a\u666e\u901a\u65f6\u523b\u91cc\u770b\u5230\u65b0\u7b54\u6848\u3002",
      source: "\u5357\u5b89\u7684\u5907\u7528\u53e5\u5b50",
    },
  ];
  const today = new Date();
  const index = (today.getFullYear() + today.getMonth() + today.getDate()) % quotes.length;
  return quotes[index];
}

async function fetchDailyQuote() {
  const response = await fetch("https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Daily quote request failed.");
  const data = await response.json();
  const text = String(data.hitokoto || "").trim();
  if (!text) throw new Error("Daily quote is empty.");
  const sourceParts = [data.from, data.from_who].filter(Boolean);
  return {
    text,
    source: sourceParts.length ? sourceParts.join(" / ") : "\u6765\u81ea\u7f51\u7edc",
  };
}

async function loadDailyQuote() {
  const dateKey = getLocalDateKey();
  const cacheKey = "nanan-daily-quote";
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached?.dateKey === dateKey && cached?.text) return cached;
  } catch {
    // Ignore malformed cache and fetch a fresh sentence.
  }

  try {
    const quote = await fetchDailyQuote();
    const payload = { ...quote, dateKey };
    localStorage.setItem(cacheKey, JSON.stringify(payload));
    return payload;
  } catch {
    return { ...getFallbackQuote(), dateKey };
  }
}

function typeDailyQuote(textElement, sourceElement, quote) {
  const text = quote.text || "";
  window.clearInterval(quoteTypingTimer);
  textElement.classList.remove("is-complete");
  textElement.textContent = "";
  if (sourceElement) sourceElement.textContent = "";

  let index = 0;
  quoteTypingTimer = window.setInterval(() => {
    index += 1;
    textElement.textContent = text.slice(0, index);
    if (index >= text.length) {
      window.clearInterval(quoteTypingTimer);
      textElement.classList.add("is-complete");
      if (sourceElement && quote.source) {
        sourceElement.textContent = `\u2014 ${quote.source}`;
      }
    }
  }, allowMotion ? 72 : 0);
}

function scheduleDailyQuoteRefresh() {
  window.clearTimeout(quoteMidnightTimer);
  quoteMidnightTimer = window.setTimeout(() => {
    localStorage.removeItem("nanan-daily-quote");
    bindDailyQuote();
  }, getNextMidnightDelay() + 800);
}

async function bindDailyQuote() {
  const textElement = document.querySelector("#daily-quote-text");
  const sourceElement = document.querySelector("#daily-quote-source");
  if (!textElement) return;
  const quote = await loadDailyQuote();
  typeDailyQuote(textElement, sourceElement, quote);
  scheduleDailyQuoteRefresh();
}

function setScrollMode(active) {
  isScrolling = active;
  root.classList.toggle("is-scrolling", active);
}

function bindPerformanceGuards() {
  const clearWarmup = () => {
    clearTimeout(warmupTimer);
    warmupTimer = 0;
  };

  const startScroll = () => {
    if (!isMobileFx) return;
    setScrollMode(true);
    if (fxState === "active") {
      applyFxState("warming");
    }
    clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      setScrollMode(false);
      if (!freezeVisualFx && document.visibilityState === "visible") {
        clearWarmup();
        warmupTimer = window.setTimeout(() => {
          if (!freezeVisualFx && document.visibilityState === "visible") {
            applyFxState("active");
          }
        }, 220);
      }
    }, 160);
  };

  const freeze = () => {
    clearWarmup();
    freezeVisualFx = true;
    root.classList.add("is-frozen");
    applyFxState("stable");
  };

  const warmup = () => {
    clearWarmup();
    freezeVisualFx = false;
    root.classList.remove("is-frozen");
    applyFxState(isMobileFx ? "warming" : "active");
    if (!isMobileFx || !allowMotion) return;
    warmupTimer = window.setTimeout(() => {
      if (!freezeVisualFx && document.visibilityState === "visible") {
        applyFxState("active");
      }
    }, 420);
  };

  window.addEventListener("scroll", startScroll, { passive: true });
  window.addEventListener("touchmove", startScroll, { passive: true });
  window.addEventListener("pagehide", freeze);
  window.addEventListener("pageshow", warmup);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      freeze();
      return;
    }
    warmup();
  });
}

updateBrowserMode();
applyFxState("active");
window.addEventListener("resize", resize);
window.addEventListener("pointermove", movePointer);
window.addEventListener("pointerdown", pushRipple);
window.addEventListener("load", queueBookmarkLayoutRefresh);
window.addEventListener("orientationchange", queueBookmarkLayoutRefresh);
document.fonts?.ready?.then(queueBookmarkLayoutRefresh);

resize();
if (allowMotion) {
  paint();
}

bindTilt();
bindFilters();
bindTheme();
bindContact();
bindReveal();
bindAiRadar();
bindDailyQuote();
bindPerformanceGuards();
renderBookmarkDrawers();


