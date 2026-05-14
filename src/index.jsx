import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* global ZOHO */

// El listener SIEMPRE se registra antes de init(). Como es una web tab,
// PageLoad puede llegar sin EntityId — la app decide su primera pantalla.
ZOHO.embeddedApp.on("PageLoad", function () {
  const root = createRoot(document.getElementById("root"));
  root.render(<App />);
});

ZOHO.embeddedApp.init();
