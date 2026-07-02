// 把隐私候选明文加密成 assets/private-bookmarks.js
// 加密参数必须与 bookmarks.js / app.js 的解密端严格一致：
//   PBKDF2-SHA256, iterations=120000, AES-GCM-256, salt 16B, iv 12B
//
// 用法:
//   PRIVACY_PASS="你的密码" node scripts/encrypt-private-bookmarks.mjs
// 或把密码写入仓库根的 .privacy-pass 文件（该文件不提交）

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const PLAIN = path.join(repoRoot, "bookmarks-private.plain.json");
const OUT = path.join(repoRoot, "assets", "private-bookmarks.js");
const PASS_FILE = path.join(repoRoot, ".privacy-pass");

let password = process.env.PRIVACY_PASS || "";
if (!password && fs.existsSync(PASS_FILE)) {
  password = fs.readFileSync(PASS_FILE, "utf8").trim();
}
if (!password) {
  console.error("缺少密码：设置环境变量 PRIVACY_PASS 或创建 .privacy-pass 文件");
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(PLAIN, "utf8"));
// 隐私区展示时 bookmarks.js 会覆盖 site 为「隐私分类」并加 tag，这里保留原始字段即可
const plaintext = new TextEncoder().encode(JSON.stringify(items));

const iterations = 120000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const keyMaterial = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveKey"]
);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"]
);
const encrypted = new Uint8Array(
  await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
);

const b64 = (u8) => Buffer.from(u8).toString("base64");
const vault = {
  v: 1,
  kdf: "PBKDF2-SHA256",
  iterations,
  count: items.length,
  salt: b64(salt),
  iv: b64(iv),
  data: b64(encrypted),
};

fs.writeFileSync(
  OUT,
  "window.PRIVATE_BOOKMARKS_VAULT = " + JSON.stringify(vault) + ";\n",
  "utf8"
);
console.log(`已生成加密隐私区: ${items.length} 条 -> assets/private-bookmarks.js`);

// 自检：立刻解密验证一遍
const dkey = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["decrypt"]
);
const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, dkey, encrypted);
const back = JSON.parse(new TextDecoder().decode(dec));
console.log(`自检解密成功: ${back.length} 条${back.length === items.length ? " ✓" : " ✗ 数量不符"}`);
