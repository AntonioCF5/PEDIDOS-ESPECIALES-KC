import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* global ZOHO */

// Estado compartido para evitar montar React dos veces (si PageLoad dispara
// después del fallback, o si llega varias veces).
let mounted = false;

function stage(txt) {
  if (typeof window.__bootStage === "function") window.__bootStage(txt);
}
function showBootError(message) {
  if (typeof window.__bootError === "function") {
    window.__bootError(message);
  } else {
    // eslint-disable-next-line no-console
    console.error("[widget]", message);
  }
}

stage("4/6] index.jsx ejecutando");

/** ¿Está el SDK de Zoho disponible (cargado y con embeddedApp)? */
function sdkReady() {
  return typeof ZOHO !== "undefined" && ZOHO && ZOHO.embeddedApp;
}

/**
 * Espera hasta `timeoutMs` a que el SDK termine de cargar. Resuelve con
 * `true` si el SDK aparece, `false` si se agota el tiempo.
 */
function waitForSdk(timeoutMs) {
  return new Promise(function (resolve) {
    if (sdkReady()) return resolve(true);
    const start = Date.now();
    const iv = setInterval(function () {
      if (sdkReady()) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(iv);
        resolve(false);
      }
    }, 100);
  });
}

function mountApp(reason) {
  if (mounted) return;
  mounted = true;
  try {
    const container = document.getElementById("root");
    if (!container) {
      showBootError("No se encontró el contenedor #root.");
      return;
    }
    stage("6/6] montando React (" + reason + ")");
    // Limpia el loader inicial del widget.html.
    container.innerHTML = "";
    const root = createRoot(container);
    root.render(<App />);
  } catch (err) {
    showBootError("Error al renderizar la app: " + (err?.message || err));
  }
}

// El bundle puede ejecutarse antes que el SDK (cargado en async). Esperamos
// hasta 3 s a que el SDK aparezca; si no llega, montamos en modo degradado
// para que el operador al menos vea la UI.
waitForSdk(3000).then(function (ok) {
  if (!ok) {
    showBootError(
      "SDK de Zoho no disponible tras 3s — la app se va a abrir, pero las " +
        "llamadas a Zoho (buscar contactos, crear pedido) fallarán."
    );
    mountApp("sin-SDK");
    return;
  }

  try {
    ZOHO.embeddedApp.on("PageLoad", function () {
      stage("5/6] PageLoad recibido");
      mountApp("PageLoad");
    });
    stage("5/6] llamando init()");
    const initRes = ZOHO.embeddedApp.init();
    if (initRes && typeof initRes.then === "function") {
      initRes.then(
        function () { stage("5/6] init() resuelto"); },
        function (err) {
          showBootError(
            "init() del SDK falló: " + (err?.message || JSON.stringify(err))
          );
        }
      );
    }
  } catch (err) {
    showBootError("Fallo al inicializar el SDK de Zoho: " + (err?.message || err));
  }

  // Fallback: si PageLoad no dispara en 3 s tras init(), montamos igual.
  // Web tabs a veces no reciben PageLoad cuando no hay contexto de registro.
  setTimeout(function () {
    if (!mounted) {
      stage("5/6] timeout — montando sin PageLoad");
      mountApp("fallback-timeout");
    }
  }, 3000);
});
