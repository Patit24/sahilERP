import { copyFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const serverDir = path.join(distDir, "server");
const openaiDir = path.join(distDir, ".openai");
const hostingSource = path.join(root, ".openai", "hosting.json");
const hostingTarget = path.join(openaiDir, "hosting.json");
const serverTarget = path.join(serverDir, "index.js");

if (!existsSync(path.join(distDir, "index.html"))) {
  throw new Error("Vite build output is missing dist/index.html");
}

if (!existsSync(hostingSource)) {
  throw new Error("Missing .openai/hosting.json");
}

await mkdir(serverDir, { recursive: true });
await mkdir(openaiDir, { recursive: true });
await copyFile(hostingSource, hostingTarget);

const serverEntry = String.raw`import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(serverDir, "..");

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".map", "application/json; charset=utf-8"],
]);

function getFilePath(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") pathname = "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";

  const requestedPath = path.resolve(publicDir, "." + pathname);
  const isSafePath = requestedPath === publicDir || requestedPath.startsWith(publicDir + path.sep);

  if (isSafePath && existsSync(requestedPath)) {
    return requestedPath;
  }

  return path.join(publicDir, "index.html");
}

async function handleRequest(request) {
  const filePath = getFilePath(request.url);
  const body = await readFile(filePath);
  const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
  const isHtml = path.basename(filePath) === "index.html";

  return new Response(body, {
    headers: {
      "content-type": contentType,
      "cache-control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

export default { fetch: handleRequest };
export { handleRequest as fetch };
`;

await readFile(path.join(distDir, "index.html"), "utf8");
await import("node:fs/promises").then(({ writeFile }) => writeFile(serverTarget, `${serverEntry}\n`));

console.log("Prepared Sites build output in dist/");
