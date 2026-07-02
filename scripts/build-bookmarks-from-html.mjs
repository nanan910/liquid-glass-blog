// 从 Raindrop 导出的 HTML 重建书签数据（替代已损坏的 build-raindrop-data.ps1）
//
// 输入:
//   - ../86e0cffb-...html            Raindrop 导出（唯一权威源, 303 条）  [通过 SRC_HTML 传入]
//   - assets/bookmarks-public-20260625d.js  旧公开数据（仅复用 excerpt/summary/created, 按 url 匹配）
//
// 输出:
//   - assets/bookmarks-data.js       公开数据 window.BOOKMARKS_DATA（新 categoryKey）
//   - bookmarks-private.plain.json   隐私候选明文（不提交, 供审核+加密）
//   - 隐私清单.md                     人类可读审核表
//
// 规则:
//   1. 分类以 Raindrop 文件夹为准, 按 FOLDER_TO_CATEGORY 映射到 15 个大类
//   2. 登录/注册/控制台类 URL 降级为站点首页
//   3. 丢弃所有 <DD> 备注（含 API key / 账号密码 / 邀请码）
//   4. 机场订阅 / 账号邮箱 两类 -> 隐私候选, 其余公开

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const SRC_HTML = process.env.SRC_HTML || path.resolve(repoRoot, "..", "86e0cffb-e12c-4689-9a95-f0be50e7f54d.html");
const OLD_PUBLIC = path.join(repoRoot, "assets", "bookmarks-public-20260625d.js");

// ---------------------------------------------------------------------------
// 分类映射: Raindrop 文件夹名(最内层) -> { key, 归属 }
// PRIVATE=true 表示默认进隐私候选区
// ---------------------------------------------------------------------------
const CATEGORY_LABELS = {
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
  "airport": { title: "机场订阅", description: "机场、订阅与订阅转换（隐私）" },
  "account": { title: "账号邮箱", description: "账号、邮箱、临时邮件与接码（隐私）" },
};

const PRIVATE_KEYS = new Set(["airport", "account"]);

// 文件夹 -> 分类 key。匹配「最内层文件夹名」，找不到再看父级，最后 fallback。
const FOLDER_TO_CATEGORY = {
  // AI API 中转
  "api": "ai-api", "Token": "ai-api", "中转站": "ai-api", "ai订阅": "ai-api",
  // AI 工具
  "Ai": "ai-tools", "工作流": "ai-tools", "ai消除": "ai-tools",
  "论文": "ai-tools", "写作": "ai-tools", "翻译提取": "ai-tools",
  "水印": "ai-tools", "去水印": "ai-tools", "创作": "reading",
  // 问卷
  "问卷": "survey",
  // 影视直播
  "IPTV": "video", "直播": "video", "直播源": "video", "视频源": "video",
  "影视": "video", "短剧": "video", "解析工具": "video", "视频解析": "video",
  // 音乐
  "音乐": "music", "音源": "music", "音乐解析": "music",
  // 网盘资源
  "网盘4k": "netdisk", "openlist": "netdisk", "网盘搜索": "netdisk",
  "网盘搜索引擎": "netdisk", "云存储": "netdisk", "文件传输": "netdisk",
  // 学习
  "学习": "study", "学习资料": "study", "技能学习": "study",
  "大学刷课": "study", "学生优惠": "study",
  // 文档办公
  "办公": "office", "科技": "office", "在线演示": "office",
  "格式转换": "office", "不限-mp3": "office", "不限-markdown": "office",
  "pdf-word": "office", "证章": "office",
  // 阅读书库
  "阅读": "reading", "书库": "reading", "图书": "reading", "小说": "reading",
  // 购物货源
  "电商货源": "shopping", "拼团互助": "shopping", "线报": "shopping",
  // 游戏软件
  "游戏库": "software", "GM": "software", "牛逼破解": "software",
  "系统激活工具": "software", "系统优化": "software",
  "win绿色工具": "software", "卸载工具": "software", "远控": "software",
  // 资讯社区
  "吃瓜": "community", "每日热点": "community", "社区": "community", "个人博客": "community",
  // 网络工具
  "代理IP": "network", "域名": "network",
  // 搜索导航
  "搜索引擎": "nav", "万能导航": "nav", "平台屏蔽词": "nav", "weclaw": "nav",
  "三方": "nav", "素材壁纸": "nav", "求职": "nav", "绕付费墙": "nav", "Unsorted": "nav",
  // 机场订阅（隐私）
  "机场": "airport", "订阅": "airport", "订阅转换": "airport",
  "自制订阅教程": "airport", "免费vpn": "airport",
  // 账号邮箱（隐私）
  "账号": "account", "邮箱": "account", "gpt日抛": "account", "接码": "account",
};

// ---------------------------------------------------------------------------
// URL 降级: 登录/注册/控制台等 -> 站点首页
// ---------------------------------------------------------------------------
const PRIVATE_PATH_RE = [
  /\/(login|signin|sign-in|logon|register|signup|sign-up)(\/|$|\?|#)/i,
  /\/(console|dashboard|overview|playground|topup|pricing|log-updates)(\/|$|\?|#)/i,
  /\/(keys?|tokens?|profile|profiles|account|member|user|settings)(\/|$|\?|#)/i,
];
// hash 路由形式 /#/login /#/register 等
const PRIVATE_HASH_RE = /#\/?(login|signin|register|signup|dashboard|console|user|profile|account)/i;

function decodeEntities(s) {
  return s
    .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&#x2F;", "/");
}

function toHomepage(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const pathQ = u.pathname + u.search + u.hash;
    const hit = PRIVATE_HASH_RE.test(pathQ) || PRIVATE_PATH_RE.some((re) => re.test(pathQ));
    if (hit) return `${u.protocol}//${u.host}/`;
    // 带邀请/推广参数的也回首页（code=/invite/ref=）
    if (/([?&#])(code|invite|ref|inviteid|reg)=/i.test(rawUrl)) {
      return `${u.protocol}//${u.host}${u.pathname === "/" ? "/" : u.pathname}`;
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function siteLabel(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "") || "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// 解析 Raindrop HTML（缩进感知的文件夹栈）
// ---------------------------------------------------------------------------
function parseRaindrop(htmlPath) {
  const lines = fs.readFileSync(htmlPath, "utf8").split(/\r?\n/);
  const stack = [{ name: "ROOT", path: [], indent: -1 }];
  const out = [];

  for (const line of lines) {
    const indent = (line.match(/^\t*/)?.[0].length) ?? 0;

    const h3 = line.match(/<DT><H3[^>]*>([^<]*)<\/H3>/);
    if (h3) {
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1];
      const name = decodeEntities(h3[1]);
      stack.push({ name, path: [...parent.path, name], indent });
      continue;
    }

    const a = line.match(/<DT><A HREF="([^"]*)"([^>]*)>([^<]*)<\/A>/);
    if (a) {
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const folder = stack[stack.length - 1];
      const attrs = a[2];
      const getAttr = (n) => (attrs.match(new RegExp(n + '="([^"]*)"'))?.[1]) ?? "";
      out.push({
        rawUrl: decodeEntities(a[1]),
        title: decodeEntities(a[3]).trim(),
        add: getAttr("ADD_DATE"),
        important: getAttr("DATA-IMPORTANT") === "true",
        cover: getAttr("DATA-COVER"),
        folderPath: folder.path,
      });
    }
    // 注: <DD> 备注一律忽略（含敏感信息）
  }
  return out;
}

// 选分类: 优先最内层文件夹, 逐级向上找映射
function pickCategory(folderPath) {
  for (let i = folderPath.length - 1; i >= 0; i--) {
    const key = FOLDER_TO_CATEGORY[folderPath[i]];
    if (key) return key;
  }
  return "nav"; // 兜底
}

// 用户审核后：以下站点虽在机场/订阅文件夹，但属公开工具/资讯，移回公开（网络工具）
const PUBLIC_OVERRIDE_HOSTS = new Set([
  "sublink.dev",        // 订阅转换工具
  "bianyuan.xyz",       // 订阅转换工具
  "sub.789.st",         // 订阅转换工具
  "acl4ssr.netlify.app",// 订阅转换工具
  "suburl.v1.mk",       // 订阅转换工具
  "mibei77.com",        // 免费节点（资讯）
  "jichangvpn.cloud",   // 机场测速简介（资讯）
  "autocf.pages.dev",   // Cloudflare EDT 部署（教程）
  "blog.cmliussss.com", // Edgetunnel 教程
]);

function applyOverride(categoryKey, url) {
  const host = siteLabel(url);
  if (PUBLIC_OVERRIDE_HOSTS.has(host)) return "network";
  return categoryKey;
}

// ---------------------------------------------------------------------------
// 复用旧公开数据的 excerpt / summary / created（按 url 或标题匹配）
// ---------------------------------------------------------------------------
function loadOldMeta() {
  if (!fs.existsSync(OLD_PUBLIC)) return { byUrl: new Map(), byTitle: new Map() };
  const txt = fs.readFileSync(OLD_PUBLIC, "utf8")
    .replace(/^\s*window\.BOOKMARKS_DATA\s*=\s*/, "").replace(/;\s*$/, "");
  let arr = [];
  try { arr = JSON.parse(txt); } catch { arr = []; }
  const byUrl = new Map(), byTitle = new Map();
  for (const b of arr) {
    const meta = { excerpt: b.excerpt || "", summary: b.summary || "", created: b.created || "" };
    if (b.url) byUrl.set(b.url, meta);
    if (b.title) byTitle.set(b.title.trim(), meta);
  }
  return { byUrl, byTitle };
}

function isoFromEpoch(sec) {
  if (!sec || !/^\d+$/.test(sec)) return "";
  const n = Number(sec);
  if (!n) return "";
  return new Date(n * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const raw = parseRaindrop(SRC_HTML);
const { byUrl, byTitle } = loadOldMeta();

const publicItems = [];
const privateItems = [];
const seenUrls = new Set();
let idSeq = 1;

for (const r of raw) {
  const url = toHomepage(r.rawUrl);
  const categoryKey = applyOverride(pickCategory(r.folderPath), url);
  const site = siteLabel(url) || siteLabel(r.rawUrl);
  const title = r.title || site || "Untitled Bookmark";

  // 去重：降级后 URL 相同的只保留第一条（源文件里存在重复项）
  const dedupeKey = `${url}||${title}`;
  if (seenUrls.has(dedupeKey)) continue;
  seenUrls.add(dedupeKey);

  // 复用旧摘要（先按原始url, 再按降级后url, 再按标题）
  const old = byUrl.get(r.rawUrl) || byUrl.get(url) || byTitle.get(title) || {};
  const created = old.created || isoFromEpoch(r.add) || "";

  const item = {
    id: String(idSeq++),
    title,
    url,
    site,
    excerpt: old.excerpt || "",
    summary: old.summary || "",
    created,
    favorite: Boolean(r.important),
    categoryKey,
    categoryTitle: CATEGORY_LABELS[categoryKey].title,
    folder: r.folderPath.join(" / "),
  };

  if (PRIVATE_KEYS.has(categoryKey)) privateItems.push(item);
  else publicItems.push(item);
}

// 排序: 有时间的按时间倒序, 无时间的排后
const byCreatedDesc = (a, b) => new Date(b.created || 0) - new Date(a.created || 0);
publicItems.sort(byCreatedDesc);
privateItems.sort(byCreatedDesc);

// ---- 写公开数据 ----
const publicOut = publicItems.map(({ categoryTitle, folder, ...keep }) => keep);
fs.writeFileSync(
  path.join(repoRoot, "assets", "bookmarks-data.js"),
  "window.BOOKMARKS_DATA = " + JSON.stringify(publicOut, null, 2) + ";\n",
  "utf8"
);

// ---- 写隐私候选明文（不提交）----
const privateOut = privateItems.map(({ categoryTitle, folder, ...keep }) => keep);
fs.writeFileSync(
  path.join(repoRoot, "bookmarks-private.plain.json"),
  JSON.stringify(privateOut, null, 2),
  "utf8"
);

// ---- 写审核清单 ----
let md = `# 隐私书签审核清单\n\n`;
md += `> 以下 ${privateItems.length} 条默认放入**加密隐私区**（机场订阅 / 账号邮箱）。\n`;
md += `> 请审核：**不需要隐私**的，把该行的 \`[ ]\` 改成 \`[x]\`（= 移回公开）。改完发我。\n`;
md += `> 所有链接已降级为站点首页、已删除全部备注（原备注中的账号/密码/邀请码不再出现）。\n\n`;
for (const key of PRIVATE_KEYS) {
  const rows = privateItems.filter((x) => x.categoryKey === key);
  if (!rows.length) continue;
  md += `## ${CATEGORY_LABELS[key].title}（${rows.length}）\n\n`;
  md += `| 移回公开 | 标题 | 链接 | 原文件夹 |\n|:--:|---|---|---|\n`;
  for (const x of rows) {
    md += `| [ ] | ${x.title.replace(/\|/g, "\\|")} | ${x.url} | ${x.folder} |\n`;
  }
  md += `\n`;
}
fs.writeFileSync(path.join(repoRoot, "隐私清单.md"), md, "utf8");

// ---- 控制台汇总 ----
const dist = {};
for (const x of publicItems) dist[x.categoryKey] = (dist[x.categoryKey] || 0) + 1;
console.log("=== 构建完成 ===");
console.log("源书签总数:", raw.length);
console.log("公开:", publicItems.length, " 隐私候选:", privateItems.length,
            " 合计:", publicItems.length + privateItems.length);
console.log("\n=== 公开分类分布 ===");
for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(3)}  ${CATEGORY_LABELS[k].title} (${k})`);
}
const downgraded = [...publicItems, ...privateItems].filter((x) => {
  const orig = raw.find((r) => (r.title || "") === x.title);
  return orig && toHomepage(orig.rawUrl) !== orig.rawUrl;
}).length;
console.log("\nURL 降级为首页的条数:", downgraded);
