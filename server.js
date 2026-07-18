const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const api = require("./api");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (reqPath.startsWith("/api/")) {
    await api.handle(req, res, reqPath);
    return;
  }

  const urlPath = reqPath === "/" ? "/index.html" : reqPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fbErr, fbData) => {
        if (fbErr) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("파일을 찾을 수 없습니다.");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fbData);
      });
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

async function start() {
  try {
    const result = await db.init();
    if (result.ok) {
      console.log(
        `[db] MySQL 연결 OK — ${result.host}/${result.database}` +
          (result.seeded ? " (초기 데이터 삽입)" : ""),
      );
    } else {
      console.warn("[db] MySQL 미연결:", result.error);
    }
  } catch (err) {
    console.error("[db] 초기화 실패:", err.message);
  }

  server.listen(PORT, HOST, () => {
    console.log(`panmae 서버 실행 중: http://${HOST}:${PORT}`);
  });
}

start();
