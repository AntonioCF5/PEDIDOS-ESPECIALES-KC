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
  keySize: 2048,
});

https
  .createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

    // El proyecto vive en /app/. Servimos SIEMPRE desde ahí, sin importar si
    // Zoho pide `/` o `/app/widget.html` (evita el redirect 302 que rompía el
    // handshake postMessage del SDK con el CRM padre).
    let rel;
    if (urlPath === "/" || urlPath === "/app/widget.html") {
      rel = "/widget.html";
    } else if (urlPath.startsWith("/app/")) {
      rel = urlPath.slice(4); // "/app/js/bundle.js" -> "/js/bundle.js"
    } else {
      rel = urlPath; // "/js/bundle.js" -> "/js/bundle.js"
    }
    const filePath = path.normalize(path.join(ROOT, "app", rel));

    if (!filePath.startsWith(path.join(ROOT, "app"))) {
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
        // Dev server: nunca cachear. Si no, el browser sirve el bundle.js
        // viejo de su caché HTTP y nunca pide el nuevo después de un rebuild.
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      });
      res.end(data);
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`Widget dev server: https://${HOST}:${PORT}/app/widget.html`);
    console.log("Acepta el certificado self-signed la primera vez que abras la URL.");
  });
