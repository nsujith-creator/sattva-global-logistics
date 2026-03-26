const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  const sendFile = (target) => {
    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  };
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.access(filePath, fs.constants.F_OK, (accessErr) => {
      if (accessErr) sendFile(path.join(root, 'index.html'));
      else sendFile(filePath);
    });
  });
});
server.listen(4173, '127.0.0.1', () => console.log('preview server on http://127.0.0.1:4173'));
