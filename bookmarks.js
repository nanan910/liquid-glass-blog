const root = document.documentElement;
const canvas = document.querySelector("#aurora-canvas");
const ctx = canvas.getContext("2d");
const pointer = { x: window.innerWidth * 0.55, y: window.innerHeight * 0.22 };
let width = 0;
let height = 0;
let dpr = 1;
let orbs = [];
let sparks = [];
let isMobileFx = false;
let pointerFrame = 0;
let frameTick = 0;
let allowMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let isScrolling = false;
let freezeVisualFx = false;
let scrollTimer = 0;
let fxState = "active";
let warmupTimer = 0;
let privateBookmarks = [];
let privateUnlocked = false;

function normalizeBookmark(bookmark) {
  return {
    ...bookmark,
    title: (bookmark.title || "Untitled Bookmark").trim(),
    note: bookmark.note || "",
    excerpt: bookmark.excerpt || "",
    summary: "",
    site: bookmark.site || getSiteLabel(bookmark.url || ""),
    tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
    favorite: Boolean(bookmark.favorite),
  };
}

const allBookmarks = [...(window.BOOKMARKS_DATA || [])]
  .map(normalizeBookmark)
  .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));

let activeSource = "all";

const sensitivePatterns = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b[A-Za-z0-9]{24,}\b/g,
];

function getSiteLabel(url) {
  if (!url) return "unknown";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "unknown";
  } catch {
    return "unknown";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizePublicText(value) {
  let output = String(value ?? "").trim();
  if (!output) return "";

  const lower = output.toLowerCase();
  if (
    lower.includes("password") ||
    lower.includes("passwd") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("api key") ||
    lower.includes("apikey") ||
    lower.includes("access code") ||
    lower.includes("private key")
  ) {
    return "Contains sensitive notes and has been hidden on the public page.";
  }

  for (const pattern of sensitivePatterns) {
    output = output.replace(pattern, "[hidden]");
  }

  return output;
}

function applyFxState(nextState) {
  fxState = nextState;
  root.classList.toggle("fx-stable", nextState === "stable");
  root.classList.toggle("fx-warming", nextState === "warming");
  root.classList.toggle("fx-active", nextState === "active");
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

  const orbCount = isMobileFx ? 8 : 18;
  const sparkCount = isMobileFx ? 8 : 36;

  orbs = Array.from({ length: orbCount }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: (isMobileFx ? 40 : 54) + Math.random() * (isMobileFx ? 44 : 90),
    vx: (Math.random() - 0.5) * (isMobileFx ? 0.18 : 0.46),
    vy: (Math.random() - 0.5) * (isMobileFx ? 0.12 : 0.38),
    hue: [186, 315, 96, 258][index % 4],
    alpha: (isMobileFx ? 0.04 : 0.08) + Math.random() * (isMobileFx ? 0.04 : 0.08),
  }));

  sparks = Array.from({ length: sparkCount }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * (isMobileFx ? 0.24 : 0.58),
    vy: (Math.random() - 0.5) * (isMobileFx ? 0.24 : 0.58),
    hue: [186, 315, 96, 46][index % 4],
    life: Math.random(),
  }));
}

function paintOrbs() {
  for (const orb of orbs) {
    orb.x += orb.vx;
    orb.y += orb.vy;
    orb.vx *= isMobileFx ? 0.997 : 0.993;
    orb.vy *= isMobileFx ? 0.997 : 0.993;

    if (orb.x < -orb.r) orb.x = width + orb.r;
    if (orb.x > width + orb.r) orb.x = -orb.r;
    if (orb.y < -orb.r) orb.y = height + orb.r;
    if (orb.y > height + orb.r) orb.y = -orb.r;

    const glow = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
    glow.addColorStop(0, `hsla(${orb.hue}, 100%, 70%, ${orb.alpha})`);
    glow.addColorStop(0.5, `hsla(${orb.hue}, 100%, 62%, ${orb.alpha * 0.36})`);
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
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vx *= 0.986;
    spark.vy *= 0.986;
    spark.life += 0.012;

    if (spark.x < 0 || spark.x > width || spark.y < 0 || spark.y > height) {
      spark.x = Math.random() * width;
      spark.y = Math.random() * height;
      spark.vx = (Math.random() - 0.5) * (isMobileFx ? 0.24 : 0.58);
      spark.vy = (Math.random() - 0.5) * (isMobileFx ? 0.24 : 0.58);
    }

    ctx.fillStyle = `hsla(${spark.hue}, 100%, 72%, ${0.22 + Math.sin(spark.life) * 0.14})`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, isMobileFx ? 1 : 1.2, 0, Math.PI * 2);
    ctx.fill();
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
  } else if (fxState === "active" && !isScrolling && frameTick % 10 === 0) {
    paintSparks();
  }

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

function bindTheme() {
  root.classList.remove("light");
  const toggle = document.querySelector("#theme-toggle");
  if (!toggle) return;
  toggle.hidden = true;
  toggle.setAttribute("aria-hidden", "true");
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

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getVisibleBookmarks() {
  return [...allBookmarks, ...(privateUnlocked ? privateBookmarks : [])].sort(
    (a, b) => new Date(b.created || 0) - new Date(a.created || 0)
  );
}

function createBookmarkCard(bookmark) {
  const article = document.createElement("article");
  article.className = "bookmark-card liquid-card";

  const safeTitle = escapeHtml(bookmark.title);
  const safeUrl = escapeHtml(bookmark.url);
  const safeSite = escapeHtml(bookmark.site || "unknown");
  const safeDate = escapeHtml(formatDate(bookmark.created));
  const tagsMarkup = (bookmark.tags || [])
    .slice(0, 6)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  article.innerHTML = `
    <div class="bookmark-card-head">
      <p class="bookmark-site">${safeSite}</p>
      <p class="bookmark-date">${safeDate}</p>
    </div>
    <h2><a href="${safeUrl}" target="_blank" rel="noreferrer">${safeTitle}</a></h2>
    <div class="bookmark-meta">
      <div class="bookmark-tags-inline">${tagsMarkup}</div>
      <a class="bookmark-visit" href="${safeUrl}" target="_blank" rel="noreferrer">打开站点</a>
    </div>
  `;

  return article;
}

// 分类标签，与 app.js / 构建脚本保持一致
const categoryLabels = {
  "ai-api": "AI API 中转",
  "ai-tools": "AI 工具",
  survey: "问卷调研",
  video: "影视直播",
  music: "音乐音频",
  netdisk: "网盘资源",
  study: "学习资源",
  office: "文档办公",
  reading: "阅读书库",
  shopping: "购物货源",
  software: "游戏软件",
  community: "资讯社区",
  network: "网络工具",
  nav: "搜索导航",
  airport: "机场订阅",
  account: "账号邮箱",
  misc: "其他书签",
};

const PRIVACY_SOURCE = "__private__";

function categoryLabelOf(key) {
  return categoryLabels[key] || categoryLabels.misc;
}

function getFilterBuckets() {
  const categoryCount = new Map();
  for (const bookmark of getVisibleBookmarks()) {
    const key = categoryLabels[bookmark.categoryKey] ? bookmark.categoryKey : "misc";
    categoryCount.set(key, (categoryCount.get(key) || 0) + 1);
  }

  return [...categoryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ source: key, count }));
}

function createTagButton(source, count, labelOverride) {
  const button = document.createElement("button");
  button.className = `tag${source === activeSource ? " is-active" : ""}`;
  button.type = "button";
  button.dataset.source = source;
  const label =
    labelOverride ?? (source === "all" ? "全部" : categoryLabelOf(source));
  button.textContent = `${label} ${count}`;
  return button;
}

function renderTagBar() {
  const container = document.querySelector("#bookmark-tags");
  if (!container) return;
  const buckets = getFilterBuckets();
  container.innerHTML = "";
  if (window.PRIVATE_BOOKMARKS_VAULT) {
    container.appendChild(
      createTagButton(PRIVACY_SOURCE, window.PRIVATE_BOOKMARKS_VAULT.count || 0, "隐私分类")
    );
  }
  container.appendChild(createTagButton("all", getVisibleBookmarks().length));
  buckets.forEach(({ source, count }) => {
    container.appendChild(createTagButton(source, count));
  });
}

function getFilteredBookmarks() {
  const searchInput = document.querySelector("#bookmark-search");
  const query = (searchInput?.value || "").trim().toLowerCase();
  return getVisibleBookmarks().filter((bookmark) => {
    const key = categoryLabels[bookmark.categoryKey] ? bookmark.categoryKey : "misc";
    const sourceMatch = activeSource === "all" || key === activeSource;
    const haystack = [
      bookmark.title,
      bookmark.note,
      bookmark.excerpt,
      bookmark.summary,
      bookmark.url,
      bookmark.site,
      categoryLabelOf(key),
      (bookmark.tags || []).join(" "),
    ]
      .join(" ")
      .toLowerCase();

    return sourceMatch && (!query || haystack.includes(query));
  });
}

function renderBookmarks() {
  const matches = getFilteredBookmarks();
  const grid = document.querySelector("#bookmark-grid");
  const empty = document.querySelector("#bookmark-empty");
  const count = document.querySelector("#bookmark-count");

  grid.innerHTML = "";
  matches.forEach((bookmark) => grid.appendChild(createBookmarkCard(bookmark)));

  count.textContent = `共 ${matches.length} 条`;
  empty.hidden = matches.length !== 0;
}

function bindFilters() {
  const search = document.querySelector("#bookmark-search");
  const tagBar = document.querySelector("#bookmark-tags");

  search.addEventListener("input", renderBookmarks);
  tagBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-source]");
    if (!button) return;
    if (button.dataset.source === PRIVACY_SOURCE) {
      document.querySelector("#privacy-gate")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector("#privacy-password")?.focus();
      return;
    }
    activeSource = button.dataset.source;
    renderTagBar();
    renderBookmarks();
  });
}

function bindPrivacyGate() {
  const panel = document.querySelector("#privacy-gate");
  const input = document.querySelector("#privacy-password");
  const submit = document.querySelector("#privacy-submit");
  const status = document.querySelector("#privacy-status");
  const toggle = document.querySelector("#privacy-lock-toggle");
  if (!panel || !input || !submit || !status || !toggle) return;

  const refreshPrivacyUi = () => {
    panel.classList.toggle("is-unlocked", privateUnlocked);
    toggle.hidden = !privateUnlocked;
    status.textContent = privateUnlocked
      ? "\u9690\u79c1\u5206\u7c7b\u5df2\u89e3\u9501"
      : `\u5df2\u9690\u85cf ${window.PRIVATE_BOOKMARKS_VAULT?.count || 0} \u6761\u53ef\u80fd\u4e0d\u9002\u5408\u516c\u5f00\u5c55\u793a\u7684\u94fe\u63a5`;
    renderTagBar();
    renderBookmarks();
    populateStats();
  };

  const unlock = async () => {
    const password = input.value || "";
    if (!password) return;
    try {
      privateBookmarks = await decryptPrivateBookmarks(password);
      privateUnlocked = true;
      input.value = "";
      refreshPrivacyUi();
    } catch {
      status.textContent = "\u5bc6\u7801\u4e0d\u5bf9\uff0c\u8bf7\u91cd\u8bd5";
      input.classList.add("is-shaking");
      window.setTimeout(() => input.classList.remove("is-shaking"), 280);
    }
  };

  submit.addEventListener("click", unlock);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlock();
    }
  });
  toggle.addEventListener("click", () => {
    privateUnlocked = false;
    privateBookmarks = [];
    refreshPrivacyUi();
  });
  refreshPrivacyUi();
}

async function decryptPrivateBookmarks(password) {
  const vault = window.PRIVATE_BOOKMARKS_VAULT;
  if (!vault) return [];
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
  return JSON.parse(new TextDecoder().decode(decrypted)).map((bookmark) =>
    normalizeBookmark({
      ...bookmark,
      site: "\u9690\u79c1\u5206\u7c7b",
      tags: ["\u9690\u79c1", ...(bookmark.tags || [])],
    })
  );
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function populateStats() {
  const visible = getVisibleBookmarks();
  document.querySelector("#bookmark-total").textContent = String(visible.length);
  document.querySelector("#bookmark-sites").textContent = String(
    new Set(visible.map((bookmark) => bookmark.site || "unknown")).size
  );
  document.querySelector("#bookmark-favorites").textContent = String(
    visible.filter((bookmark) => bookmark.favorite).length
  );
}

updateFxMode();
bindTheme();
renderTagBar();
renderBookmarks();
populateStats();
bindFilters();
bindPrivacyGate();
bindPerformanceGuards();
window.addEventListener("resize", resize);
window.addEventListener("pointermove", movePointer);

resize();
if (allowMotion) {
  paint();
}
