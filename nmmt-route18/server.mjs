import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 4178);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    const safePath = path.normalize(path.join(root, requestedPath));
    if (!safePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    sendFile(res, safePath);
  })
  .listen(port, () => {
    console.log(`NMMT Route 18 MVP running at http://127.0.0.1:${port}`);
  });
