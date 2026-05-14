/**
 * Servidor HTTPS local para desarrollo del widget.
 * Sirve la carpeta app/ en https://127.0.0.1:9000.
 * El certificado self-signed se genera en memoria al arrancar; la primera vez
 * el navegador pedirá aceptar la advertencia de seguridad.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const selfsigned = require("selfsigned");

const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const PORT = 9000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

const pems = selfsigned.generate([{ name: "commonName", value: HOST }], {
  days: 365,
});

https
  .createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const rel = urlPath === "/" ? "/app/widget.html" : urlPath;
    const filePath = path.normalize(path.join(ROOT, rel));

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`Widget dev server: https://${HOST}:${PORT}/app/widget.html`);
    console.log("Acepta el certificado self-signed la primera vez que abras la URL.");
  });
