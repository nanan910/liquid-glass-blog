const fs = require("fs");
const vm = require("vm");

const DATA_FILES = [
  "assets/bookmarks-data.js",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const TIMEOUT_MS = 9000;
const CONCURRENCY = 8;

function loadBookmarks(file) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window.BOOKMARKS_DATA || [];
}

function writeBookmarks(file, data) {
  fs.writeFileSync(file, `window.BOOKMARKS_DATA = ${JSON.stringify(data, null, 2)};\n`, "utf8");
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function cleanText(value) {
  return decodeEntities(stripHtml(value))
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]+/g, " ")
    .trim();
}

function pickMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function pickTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function truncateSentence(value, max = 58) {
  const text = cleanText(value).replace(/[。；;.!?？]+$/g, "");
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function hasChinese(value) {
  return /[\u4e00-\u9fff]/.test(value || "");
}

function fallbackByCategory(bookmark, title, host) {
  const text = `${title} ${bookmark.title || ""} ${bookmark.excerpt || ""} ${host}`.toLowerCase();
  const key = bookmark.categoryKey || "";
  if (/github\.com/.test(host)) return "这是一个 GitHub 开源项目页面，可查看项目介绍、源码、版本和使用说明";
  if (/movie|cinema|影视|影院|视频|vod|tv|moovie|libvio|flix/i.test(text)) {
    return "这是一个影视资源或在线视频站点，用来查找电影、电视剧、综艺等内容";
  }
  if (/pdf|word|excel|ppt|markdown|文档|表格|office|doc/i.test(text) || key === "docs-office") {
    return "这是一个文档办公工具站，用来处理格式转换、翻译、PDF、表格或在线文档";
  }
  if (/book|ebook|gutenberg|z-library|小说|电子书|阅读|图书/i.test(text) || key === "study-learning") {
    return "这是一个学习和阅读资源站，用来查找课程、练习、电子书或长期知识资料";
  }
  if (/ai|gpt|llm|claude|gemini|model|智能|模型/i.test(text) || key === "ai-platforms") {
    return "这是一个 AI 工具或模型服务入口，用来体验智能对话、内容生成或开发能力";
  }
  if (/download|资源|网盘|云盘|pan|磁力|素材/i.test(text) || key === "downloads-resources") {
    return "这是一个资源下载或聚合站，用来查找软件、素材、电子书、游戏或网盘资源";
  }
  if (/music|audio|flac|mp3|音乐|音频/i.test(text) || key === "anime-music") {
    return "这是一个音乐或音频相关站点，用来查找歌曲、音源、播放或格式转换工具";
  }
  if (/search|导航|热榜|news|新闻|资讯/i.test(text) || key === "search-navigation" || key === "news-reading") {
    return "这是一个搜索导航或资讯聚合入口，用来快速发现网站、热点和内容线索";
  }
  if (/draw|design|image|图片|设计|图表|可视化/i.test(text) || key === "visual-tools") {
    return "这是一个视觉创作工具站，用来制作图片、图表、画板、签名或设计素材";
  }
  return "这是一个工具或资源入口，适合按标题打开后查看具体功能和使用场景";
}

function buildSummary(bookmark, page) {
  const host = getHost(bookmark.url);
  const title = truncateSentence(page.title || bookmark.title || "", 34);
  const sourceText = [page.description, bookmark.excerpt, page.h1, page.bodyLead]
    .map(cleanText)
    .find((text) => text && text.length >= 8 && !/^点击标题/.test(text));
  let purpose = "";

  if (sourceText && hasChinese(sourceText)) {
    purpose = truncateSentence(sourceText, 62);
  } else if (sourceText) {
    purpose = fallbackByCategory(bookmark, `${title} ${sourceText}`, host);
  } else {
    purpose = fallbackByCategory(bookmark, title, host);
  }

  if (title && purpose && !purpose.includes(title) && purpose.length < 46) {
    purpose = `${title}：${purpose}`;
  }
  return `${purpose}。来源：${host || "原网页"}。`;
}

async function fetchPage(bookmark) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(bookmark.url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { ok: response.ok, title: bookmark.title || "", description: bookmark.excerpt || "" };
    }
    const html = await response.text();
    const bodyLead = cleanText(
      stripHtml(
        [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
          .slice(0, 4)
          .map((match) => match[1])
          .join(" ")
      )
    );
    return {
      ok: response.ok,
      title: pickMeta(html, "og:title") || pickTag(html, "title") || bookmark.title || "",
      description:
        pickMeta(html, "description") ||
        pickMeta(html, "og:description") ||
        pickMeta(html, "twitter:description") ||
        bookmark.excerpt ||
        "",
      h1: pickTag(html, "h1"),
      bodyLead,
    };
  } catch {
    return {
      ok: false,
      title: bookmark.title || "",
      description: bookmark.excerpt || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, worker) {
  let index = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current, index, items.length);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const data = loadBookmarks(DATA_FILES[0]);
  let done = 0;
  await runPool(data, async (bookmark) => {
    const page = await fetchPage(bookmark);
    bookmark.summary = buildSummary(bookmark, page);
    bookmark.site = bookmark.site || getHost(bookmark.url);
    done += 1;
    if (done % 20 === 0 || done === data.length) {
      console.log(`summarized ${done}/${data.length}`);
    }
  });

  for (const file of DATA_FILES) {
    writeBookmarks(file, data);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
