# Widget de Pedidos Especiales — Krea Canvas

Widget standalone (web tab) de Zoho CRM para generar **pedidos especiales** en
el WooCommerce de Krea Canvas, sin depender de un Deal. Componente 1 del
proyecto *Widget de Pedidos Especiales + Integración de Productos — Krea
Canvas* (entregable **D-1**).

Construido siguiendo `REFERENCIA_WIDGET_KREA_STUDIO.md` (entregable D-2), que
documenta el widget de Citas Krea Studio del que se reutiliza ~70% de la
mecánica.

## Qué hace

- **Contacto** — busca un contacto existente en Zoho CRM por nombre, teléfono o
  email (FR-1), o crea uno nuevo con nombre, teléfono y email (FR-2).
- **Productos** — agrega líneas al pedido:
  - **Catálogo**: productos del WooCommerce de Krea Canvas (FR-3, excluye los
    que empiezan con `Pedido Especial`).
  - **Cuadro personalizado**: set predefinido (FR-5/FR-5b) o medidas manuales
    base/altura/tipo de medida (FR-5c), más material, cantidad y notas.
- **Resumen** — tabla acumulada de todas las líneas; cada renglón es clickable
  y enfoca su tarjeta (FR-6).
- **Entrega** — captura la dirección de entrega (FR-7).
- **Pago** — método de pago + desglose del cobro y totales (FR-8).
- **Crear pedido** — crea la orden en WooCommerce KC vía una Zoho Function
  (FR-9). **No** crea ni toca Deals de Zoho (NFR-1).

## Stack

React 18 · Webpack 5 + Babel · SDK embebido de Zoho (por CDN) · empaquetado con
ZET. Un solo `src/styles.css` global.

## Estructura

```
app/
  widget.html                 HTML del iframe (carga SDK + bundle.js)
  js/bundle.js                salida de webpack (gitignored)
  translations/en/translation.json
plugin-manifest.json          manifiesto Zoho (location web.tab)
src/
  index.jsx                   bootstrap: init SDK + mount React
  App.jsx                     formulario ↔ pantalla de confirmación
  components/                 UI (OrderForm = orquestador)
  hooks/                      carga de datos (useProducts, useMateriales, useSets)
  utils/
    constants.js              api_names, picklists, config (única fuente de verdad)
    zohoApi.js                wrappers sobre ZOHO.CRM.*
    woocommerce.js            builder del payload + invocación a la Zoho Function
    totals.js / rows.js       cálculos puros
    formatters.js / getCI.js  helpers
server/index.js               servidor HTTPS local para desarrollo
docs/WOOCOMMERCE_FUNCTION.md  Zoho Function (Deluge) que crea la orden
```

## Desarrollo

```bash
npm install
npm run dev      # webpack --watch -> app/js/bundle.js
npm start        # servidor HTTPS local en https://127.0.0.1:9000
```

Acepta el certificado self-signed la primera vez. En el Developer Hub de Zoho,
apunta el widget a esa URL para probar.

## Build y empaquetado

```bash
npm run build    # bundle de producción
npm run validate # zet validate (valida plugin-manifest.json)
npm run pack     # build + zet pack -> ZIP para subir a Zoho
```

## Configuración pendiente (antes del go-live)

Centralizada en `src/utils/constants.js` y `docs/WOOCOMMERCE_FUNCTION.md`:

| Tema | Acción |
|---|---|
| **Módulo de Sets** | `MODULES.SETS` es un placeholder (`"Sets"`). Crear el módulo en Zoho CRM KC con campos `Name`, `Base`, `Altura`, `Tipo_de_medida` (FR-15 / D-6) y confirmar el api_name. Si no existe, el widget igual funciona con medidas manuales. |
| **Zoho Function** | Crear `krea_create_woocommerce_order_kc` con su Connection y Variable CRM (ver `docs/WOOCOMMERCE_FUNCTION.md`). Confirmar el api_name en `WOOCOMMERCE.FUNCTION_NAME`. |
| **Métodos de pago** | `METODO_PAGO_VALUES` / `METODO_PAGO_BREAKDOWN` son una propuesta; confirmar contra el desglose real del widget de Krea Studio. |
| **IVA** | `WOOCOMMERCE.TAX_RATE = 0.16`; confirmar la config `prices_include_tax` de WooCommerce KC. |
| **Filtro de catálogo** | El catálogo se filtra por `Tienda = "Krea Canvas"` (productos sin `Tienda` también se incluyen). Validar contra los datos reales (Q-2). |

Preguntas abiertas del spec relacionadas: **Q-1** (campos del módulo Productos),
**Q-2** (cuántos productos), **Q-3** (validación de stock — hoy el widget no
valida stock), **Q-4** (webhook de Zoho Flow).

## api_names usados (Zoho CRM KC)

Tomados del org real, salvo el módulo de Sets:

- `Products`: `Product_Name`, `Product_Code`, `Unit_Price`, `Product_Active`,
  `Base`, `Altura`, `Metrica` (cm/pulgadas), `Material` (lookup),
  `Woocommerce_ID`, `Tienda` (Krea Canvas / Krea Studio).
- `Materiales_Producci_n`: `Name`, `Alias`, `Costo_por_m2`, `Activo`.
- `Contacts`: `First_Name`, `Last_Name`, `Full_Name`, `Email`, `Phone`,
  `Mobile`.
- `Sets` *(a crear)*: `Name`, `Base`, `Altura`, `Tipo_de_medida`.
