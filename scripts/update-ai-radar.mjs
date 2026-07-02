import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AI_PATTERN = /AI|AIGC|LLM|OpenAI|Claude|ChatGPT|Gemini|DeepSeek|Agent|Hugging Face|模型|大模型|人工智能|智能体|生成式/i;
const outputPath = fileURLToPath(new URL("../assets/ai-radar.json", import.meta.url));

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return base;
  }
}

async function requestText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "nanan910-ai-radar/1.0",
      accept: "text/html,application/rss+xml,application/json;q=0.9,*/*;q=0.8",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": "nanan910-ai-radar/1.0",
      accept: "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function parseRssItems(xml) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => {
    const item = match[0];
    const read = (tag) => {
      const value = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
      return stripHtml(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
    };
    return {
      title: read("title"),
      url: read("link"),
      summary: read("description"),
      date: read("pubDate"),
    };
  });
}

function firstAiRssItem(xml) {
  const items = parseRssItems(xml);
  return items.find((item) => AI_PATTERN.test(`${item.title} ${item.summary}`)) || items[0];
}

async function fetchGithub() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const query = encodeURIComponent(`AI OR LLM OR agent OR diffusion created:>${since}`);
  const data = await requestJson(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=1`);
  const item = data.items?.[0];
  if (!item) throw new Error("GitHub has no result");
  return {
    source: "GitHub",
    title: item.full_name,
    summary: item.description || "近期新增的 AI 相关开源项目。",
    url: item.html_url,
    meta: `Stars ${item.stargazers_count || 0}`,
  };
}

async function fetchHackerNews() {
  const after = Math.floor((Date.now() - 72 * 60 * 60 * 1000) / 1000);
  const data = await requestJson(`https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=created_at_i>${after}&hitsPerPage=8`);
  const item = (data.hits || []).find((hit) => AI_PATTERN.test(hit.title || hit.story_title || "")) || data.hits?.[0];
  if (!item) throw new Error("HN has no result");
  return {
    source: "Hacker News",
    title: item.title || item.story_title,
    summary: "来自 Hacker News 的 AI 技术讨论或资讯线索。",
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    meta: `${item.points || 0} points`,
  };
}

async function fetchHuggingFace() {
  const data = await requestJson("https://huggingface.co/api/models?sort=likes&direction=-1&limit=1&search=AI");
  const models = Array.isArray(data?.models) ? data.models : Array.isArray(data) ? data : [];
  const item = models[0];
  const id = item?.id || item?.modelId || item?.repo_id || item?.name || item?.fullname;
  if (!id) throw new Error("Hugging Face has no result");
  return {
    source: "Hugging Face",
    title: id,
    summary: item.description || item.pipeline_tag || "正在趋势上升的开源 AI 模型或 Space。",
    url: item.url || `https://huggingface.co/${id}`,
    meta: item.likes ? `${item.likes} likes` : "趋势",
  };
}

async function fetchDevTo() {
  const data = await requestJson("https://dev.to/api/articles?tag=ai&top=1&per_page=1");
  const item = Array.isArray(data) ? data[0] : null;
  if (!item) throw new Error("DEV has no result");
  return {
    source: "DEV",
    title: item.title,
    summary: item.description || "来自 DEV 社区的 AI 技术文章。",
    url: item.url,
    meta: `${item.public_reactions_count || 0} reactions`,
  };
}

async function fetchLandian() {
  const xml = await requestText("https://rsshub.rssforever.com/landiannews/tag/claude");
  const item = firstAiRssItem(xml);
  if (!item?.title || !item?.url) throw new Error("Landian RSS has no result");
  return {
    source: "蓝点网",
    title: item.title,
    summary: item.summary ? `${item.summary.slice(0, 96)}...` : "来自蓝点网的 AI 相关资讯。",
    url: item.url,
    meta: item.date ? item.date.slice(5, 16) : "资讯",
  };
}

async function fetchSoPilot() {
  const html = await requestText("https://sopilot.net/zh/hot-tweets");
  const textMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((text) => AI_PATTERN.test(text) && text.length > 24);
  const link = html.match(/href=["']([^"']*x\.com\/[^"']*status\/[^"']+)["']/i)?.[1] || "https://sopilot.net/zh/hot-tweets";
  if (!textMatches[0]) throw new Error("SoPilot has no AI result");
  return {
    source: "SoPilot",
    title: "热门 AI 讨论",
    summary: textMatches[0].slice(0, 130),
    url: absoluteUrl(link, "https://sopilot.net"),
    meta: "热帖",
  };
}

async function fetchNewsNow() {
  const html = await requestText("https://newsnow.busiyi.world/");
  const texts = [...html.matchAll(/>([^<>]{8,120})</g)].map((match) => stripHtml(match[1])).filter((text) => AI_PATTERN.test(text));
  const title = texts[0];
  if (!title) throw new Error("NewsNow has no AI result");
  return {
    source: "NewsNow",
    title,
    summary: "来自 NewsNow 聚合页的 AI 热点线索。",
    url: "https://newsnow.busiyi.world/",
    meta: "聚合",
  };
}

async function fetchTopHub() {
  const html = await requestText("https://tophub.today/c/tech");
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ url: absoluteUrl(match[1], "https://tophub.today"), title: stripHtml(match[2]) }))
    .filter((item) => AI_PATTERN.test(item.title));
  const item = links[0];
  if (!item) throw new Error("TopHub has no AI result");
  return {
    source: "TopHub",
    title: item.title,
    summary: "来自 TopHub 科技热榜的 AI 相关热点。",
    url: item.url,
    meta: "科技榜",
  };
}

const sources = [
  fetchGithub,
  fetchHackerNews,
  fetchHuggingFace,
  fetchDevTo,
  fetchLandian,
  fetchNewsNow,
  fetchTopHub,
  fetchSoPilot,
];

const settled = await Promise.allSettled(sources.map((source) => source()));
const items = settled
  .filter((result) => result.status === "fulfilled")
  .map((result) => result.value)
  .filter((item) => item?.title && item?.url);

const payload = {
  updatedAt: new Date().toISOString(),
  sourceCount: new Set(items.map((item) => item.source)).size,
  items,
  errors: settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "Unknown source error"),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`AI radar updated: ${payload.items.length} items, ${payload.errors.length} errors.`);
