# Referencia técnica — Widget "Citas Krea Studio"

> **Para qué sirve este documento**
>
> Es el entregable **D-2** del proyecto *Widget de Pedidos Especiales +
> Integración de Productos — Krea Canvas*. Documenta cómo está construido
> el widget de **Citas Krea Studio** para que el implementador del nuevo
> widget pueda **reutilizar patrones, componentes y código** y acelerar el
> desarrollo.
>
> El nuevo widget (Pedidos Especiales KC) comparte ~70% de la mecánica:
> selección de productos de catálogo, captura de cuadros personalizados
> (base/altura/material), tabla resumen, dirección de entrega, métodos de
> pago y **creación de la orden en WooCommerce**. La diferencia principal
> es que **no parte de un Deal de Zoho**: en lugar de hidratar un Deal
> existente, arma el pedido desde cero y trabaja contra Contactos
> (buscar/crear) y catálogos (Productos, Materiales, Sets).
>
> Cada sección termina con un bloque **➜ Para Pedidos Especiales KC** que
> indica qué se reutiliza tal cual, qué se adapta y qué se construye nuevo.

---

## 1. Resumen del widget actual

El widget de Citas Krea Studio es una **web tab** embebida en Zoho CRM
(no vive dentro de un registro: es una pestaña propia). Su flujo:

1. Muestra una **lista de citas** (Deals de la tienda "Krea Studio")
   con búsqueda y filtros.
2. Al abrir una cita, carga el **detalle del Deal**: integrantes,
   cuadros/diseños, totales, método de pago, dirección de envío y datos
   de contacto.
3. El operador captura todo y al **finalizar**:
   - actualiza el Deal y el Contact en Zoho,
   - genera un **recibo PDF** y lo adjunta al Deal,
   - crea la **orden en WooCommerce** vía una Zoho Function.

El nuevo widget toma esa segunda mitad (captura de pedido + creación de
orden WooCommerce) y la convierte en un flujo **standalone** sin Deal.

---

## 2. Stack y estructura del proyecto

### Stack

| Pieza | Versión / herramienta |
|---|---|
| UI | **React 18** (sin router, sin librerías de UI) |
| Build | **Webpack 5** + Babel (`@babel/preset-env`, `preset-react` runtime automático) |
| PDF | **pdf-lib** (generación en cliente) |
| SDK Zoho | `ZohoEmbededAppSDK.min.js` 1.5 (cargado por CDN, **no** se bundlea) |
| Empaquetado | **ZET** (`zoho-extension-toolkit`) → ZIP para el Marketplace |
| Estilos | Un solo `src/styles.css` global (inyectado por `style-loader`) |

### Estructura de carpetas

```
app/
  widget.html          HTML del iframe (carga el SDK + bundle.js)
  js/bundle.js          salida de webpack (gitignored)
  img/                 assets accesibles vía fetch('img/...')
  translations/en/translation.json   requerido por ZET (puede ir vacío)
plugin-manifest.json   manifiesto Zoho (apunta a widget.html, location web.tab)
src/
  index.jsx            bootstrap: init SDK + mount React
  App.jsx              router mínimo (lista ↔ detalle)
  components/          componentes de UI
  hooks/               hooks de carga de datos
  utils/
    zohoApi.js         wrappers sobre ZOHO.CRM.API.*
    constants.js       api_names, picklists, config (ÚNICA fuente de verdad)
    woocommerce.js     builder del payload de orden + invocación a la Zoho Function
    formatters.js      moneda, fechas, zohoDateTime, toNumber
    integrantes.js     helpers de subform / UUIDs
    pdf.js             generador del recibo PDF
server/index.js        servidor HTTPS local para desarrollo
docs/                  documentación
```

### Scripts (`package.json`)

| Script | Comando | Uso |
|---|---|---|
| `npm run dev` | `webpack --mode development --watch` | desarrollo, rebuild en cada save |
| `npm run build` | `webpack --mode production` | bundle minificado |
| `npm start` | `node server/index.js` | servidor HTTPS local `https://127.0.0.1:9000` |
| `npm run validate` | `zet validate` | valida el manifest antes de empacar |
| `npm run pack` | `build` + `zet pack` | genera el ZIP para subir a Zoho |

> Ver `WIDGET_STARTER_GUIDE.md` en la raíz del repo: contiene el
> paso a paso completo de scaffolding, configuración en Developer Hub y
> deployment. **Es el punto de partida ideal para crear el repo del nuevo
> widget.**

**➜ Para Pedidos Especiales KC:** copiar el scaffolding completo (mismo
`webpack.config.js`, `babel.config.json`, `server/index.js`,
`package.json`). Lo único que cambia en `plugin-manifest.json` es el
`name`, `description` y — si el WooCommerce de KC requiere llamadas HTTP
directas — los `cspDomains.connect-src` (en este widget van vacíos porque
WooCommerce se llama desde una Zoho Function, no desde el navegador).

---

## 3. Inicialización del SDK de Zoho

`src/index.jsx` — el orden importa:

```jsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/* global ZOHO */

ZOHO.embeddedApp.on("PageLoad", function (pageData) {
  const root = createRoot(document.getElementById("root"));
  root.render(<App pageData={pageData || {}} />);
});

ZOHO.embeddedApp.init();   // SIEMPRE después de registrar el listener
```

Reglas clave:
- **Nunca** llamar `ZOHO.CRM.API.*` antes de que dispare `PageLoad`.
- `webpack.config.js` declara `externals: { ZOHO: "ZOHO" }` para que
  webpack trate `ZOHO` como global y no intente bundlearlo.
- Como es web tab, `PageLoad` puede llegar **sin** `EntityId`. La app
  decide su propia primera pantalla.

`src/App.jsx` es un router mínimo sin dependencias:

```jsx
export default function App({ pageData }) {
  const initialId = pageData?.EntityId || null;
  const [selectedId, setSelectedId] = useState(initialId);
  if (selectedId) return <DealDetail recordId={selectedId} onBack={...} />;
  return <DealsList onSelect={(id) => setSelectedId(id)} />;
}
```

**➜ Para Pedidos Especiales KC:** `index.jsx` es idéntico. `App.jsx`
cambia: en lugar de "lista de Deals ↔ detalle de Deal", el nuevo widget
probablemente sea **una sola pantalla** (el formulario de pedido) o
"lista de pedidos recientes ↔ formulario nuevo". El patrón de estado
local (`useState` para la pantalla activa, sin router) se mantiene.

---

## 4. Arquitectura de estado y flujo de datos

### Principio: estado centralizado en el orquestador

Todo el estado vive en **`DealDetail.jsx`** (~900 líneas). Los componentes
hijos son **presentacionales**: reciben props y emiten eventos vía
callbacks. No hay Context global ni Redux — el widget es pequeño.

```
DealDetail (ORQUESTADOR — todo el estado)
├─ DealHeader            (datos read-only del Deal)
├─ IntegrantesPanel      (subform Integrantes_Sesion)
├─ CuadrosToggle         (¿compró cuadros físicos?)
├─ CuadrosList           (grilla de tarjetas + tabla resumen)
│   └─ CuadroRow         (una tarjeta)
│       ├─ ProductPicker        (dropdown buscable de catálogo)
│       ├─ MaterialPicker       (dropdown de materiales)
│       ├─ CustomDimensionsForm (base/altura)
│       ├─ CurrencyInput        (precio)
│       └─ IntegrantesSelector  (asigna integrantes al cuadro)
│   └─ CuadrosSummary    (tabla resumen acumulada, clickable)
└─ TotalsCard            (totales + método de pago + desglose del cobro)
└─ ShippingFields / ContactConfirmFields
└─ GenerateQuoteButton   (PDF + WooCommerce + persistencia)
```

### Ciclo de vida (los 4 momentos)

**1. Carga** — hooks (`useDeal`, `useProducts`, `useMateriales`)
disparan llamadas a Zoho al montar.

**2. Hidratación** — un `useEffect` que corre **una sola vez por
`deal.id`** (guardado en `hydratedForDealRef`) toma el objeto crudo de
Zoho y lo desempaca en estado local: normaliza subforms, inicializa
`compro`, `totalSesion`, `metodoPago`, `breakdown`, `shipping`, etc.
Recién entonces `hydrated` pasa a `true`.

**3. Edición** — todos los inputs actualizan **solo estado local**. Nada
se persiste al teclear.

**4. Guardado** — un único botón ("Guardar cambios" / "Finalizar")
construye el **snapshot completo** y lo manda a Zoho.

### Patrón "snapshot completo" (crítico)

`buildSnapshotPayload(overrides)` arma **todos** los campos editables +
subforms en cada guardado. No hay diffs incrementales. Esto garantiza
consistencia: lo que ves es lo que se guarda.

```jsx
function buildSnapshotPayload(overrides = {}) {
  return {
    [DEAL_FIELDS.COMPRO_CUADROS]: compro,
    [DEAL_FIELDS.TOTAL_SESION]: totalSesion,
    [DEAL_FIELDS.TOTAL_CUADROS]: calcSubtotal(rows),
    // ...todos los demás campos...
    [DEAL_FIELDS.CUADROS_ORDEN]: rows.map(serializeRow),
    [DEAL_FIELDS.INTEGRANTES_SESION]: integrantes.map(serializeIntegrante),
    ...overrides,
  };
}
```

Para detectar "cambios sin guardar", al hidratar se serializa un
`initialSnapshotRef` y se compara contra el estado actual con
`JSON.stringify`.

**➜ Para Pedidos Especiales KC:** el patrón orquestador + hijos
presentacionales se conserva igual. **Lo que cambia es la fase de
hidratación**: como no hay Deal, no hay nada que "desempacar". El estado
arranca vacío (formulario en blanco) y, en lugar de `updateDeal` con un
snapshot, el guardado final llama a la creación de la orden en
WooCommerce (sección 11). El "snapshot" del nuevo widget es el
`orderInput` de WooCommerce.

---

## 5. `constants.js` — la única fuente de verdad

**Todos** los api_names de Zoho, valores de picklist y configuración
viven en `src/utils/constants.js`. Ningún componente escribe un api_name
literal. Si un campo cambia de nombre en Zoho, se corrige **solo aquí**.

Mapas que define:

| Constante | Contenido |
|---|---|
| `MODULES` | api_names de módulos: `Deals`, `Products`, `Materiales_Producci_n`, `Contacts` |
| `DEAL_FIELDS` | todos los campos del Deal que toca el widget |
| `CONTACT_FIELDS` | `id`, `Phone`, `Email` |
| `PRODUCT_FIELDS` | `Product_Name`, `Unit_Price`, `Material`, `Base`, `Altura`, `Metrica`, `Woocommerce_ID`, ... |
| `MATERIAL_FIELDS` | `Name`, `Alias`, `Costo_por_m2`, `Activo` |
| `SUBFORM_FIELDS` | columnas del subform `Cuadros_Orden` |
| `INTEGRANTE_FIELDS` | columnas del subform `Integrantes_Sesion` |
| `STAGE_VALUES` | valores literales del picklist `Stage` |
| `METODO_PAGO_VALUES` | valores literales del picklist `Metodo_de_pago` |
| `METODO_PAGO_BREAKDOWN` | qué campos de cobro pide cada método de pago |
| `SHIPPING_FIELDS` | declarativo de los inputs de dirección (label, required, type) |
| `ESTADOS_MEXICO` | los 32 estados, para el dropdown de dirección |
| `WOOCOMMERCE` | config de la integración (function name, IDs de productos, IVA, etc.) |

Ejemplo del patrón declarativo de `SHIPPING_FIELDS` (permite renderizar y
validar los inputs en bucle, sin repetir JSX):

```js
export const SHIPPING_FIELDS = [
  { key: "CALLE_Y_NUMERO", label: "Calle y número", required: true, type: "text" },
  { key: "COLONIA", label: "Colonia", required: true, type: "text" },
  { key: "CODIGO_POSTAL", label: "Código postal", required: true, type: "text" },
  { key: "CIUDAD", label: "Ciudad", required: true, type: "text" },
  { key: "ESTADO", label: "Estado", required: true, type: "select", options: ESTADOS_MEXICO },
  { key: "NOTAS_ENTREGA", label: "Notas extra de entrega", required: false, type: "textarea" },
];
```

**➜ Para Pedidos Especiales KC:** reutilizar el archivo completo como
plantilla. Se conservan `MODULES` (agregando el módulo **Sets**),
`PRODUCT_FIELDS`, `MATERIAL_FIELDS`, `SHIPPING_FIELDS`, `ESTADOS_MEXICO`,
`METODO_PAGO_VALUES`, `METODO_PAGO_BREAKDOWN` y `WOOCOMMERCE`. Se
**elimina** `DEAL_FIELDS`, `STAGE_VALUES`, `INTEGRANTE_FIELDS` y el
subform `Cuadros_Orden` (no hay Deal). Se **agrega** un `SET_FIELDS`
(`Name`, `Base`, `Altura`, `Tipo_de_medida`) para el nuevo módulo de
Sets, y se confirma con el cliente el api_name real del módulo.

---

## 6. `zohoApi.js` — wrappers sobre el SDK

Ningún componente llama a `ZOHO.CRM.API.*` directamente. Todo pasa por
wrappers en `src/utils/zohoApi.js`. Esto centraliza la normalización de
errores y los nombres de módulos.

### Funciones que expone

```js
normalizeError(err, fallback)        // el SDK rechaza con objetos planos, no Error
getDeal(recordId)                    // getRecord
updateDeal(recordId, data, { suppressTriggers })   // updateRecord
getContact(id) / updateContact(id, data, opts)
getAllRecords(entity, { perPage })   // pagina automáticamente (getAllRecords)
attachFile({ recordId, filename, blob })
executeFunction(funcName, args)      // ZOHO.CRM.FUNCTIONS.execute (args JSON-stringify)
listUpcomingDealsForTienda(tienda)   // COQL
searchDealsForTienda(tienda, term)   // COQL: Deal_Name like '%term%'
listDealsByDateForTienda(tienda, "YYYY-MM-DD")  // COQL del día completo
```

### Normalización de errores (importante)

El SDK de Zoho **rechaza promesas con objetos planos** (`{ code, message }`),
no instancias de `Error`. Siempre normalizar antes de mostrar/lanzar:

```js
export function normalizeError(err, fallback = "Ocurrió un error inesperado") {
  if (err instanceof Error) return err;
  const message =
    typeof err === "string" ? err
    : err?.message || err?.error || err?.data?.[0]?.message
      || err?.statusText || JSON.stringify(err);
  const e = new Error(message || fallback);
  e.originalError = err;
  return e;
}
```

### Paginación

- `getAllRecords` usa **número de página** (`page: 1, 2, ...`, máx 200/página).
- COQL usa **offset** (`limit offset, count`) y se controla con
  `response.info.more_records`. El helper `coqlPaged` lo encapsula.

### COQL — reglas que Zoho exige

- Sintaxis del límite: `limit offset, count` (NO `LIMIT`/`OFFSET` separados).
- **No soporta** el operador `<` en datetime: usar `>=`, `<=` o `between`.
- Con 3+ condiciones, cada una entre paréntesis y agrupadas binariamente:
  `where ((c1) and (c2)) and (c3)`.
- Escapar comillas simples en los valores (`q()` helper).

### Búsqueda y alta de registros (no usados aún, pero necesarios para el nuevo widget)

El `WIDGET_STARTER_GUIDE.md` documenta los métodos que el nuevo widget
necesitará y este aún no usa:

```js
// Buscar contactos
const res = await ZOHO.CRM.API.searchRecord({
  Entity: "Contacts", Type: "email", Query: "jane@example.com",
});
// Type puede ser "email", "phone", "word", o "criteria"

// Crear un registro nuevo
const res = await ZOHO.CRM.API.insertRecord({
  Entity: "Contacts",
  APIData: { First_Name: "Jane", Last_Name: "Doe", Email: "...", Phone: "..." },
});
const newId = res?.data?.[0]?.details?.id;
```

**➜ Para Pedidos Especiales KC:** se reutilizan `normalizeError`,
`getAllRecords`, `executeFunction` y el patrón `coqlPaged` tal cual. Se
**agregan** wrappers nuevos:
- `searchContacts(term)` — `searchRecord` por nombre/teléfono/email
  (FR-1). Considerar `Type: "criteria"` para buscar en varios campos a la
  vez, o COQL con `like`.
- `createContact({ nombre, telefono, email })` — `insertRecord` en
  `Contacts` (FR-2). Devuelve el `id` del nuevo contacto.
- `getSets()` — `getAllRecords` del nuevo módulo de Sets (FR-5).
Se eliminan los wrappers `*DealsForTienda` y `getDeal`/`updateDeal`.

---

## 7. Hooks de carga de datos

Patrón uniforme: cada hook hace una llamada al montar, expone
`{ data, loading, error }` y cancela vía un flag `cancelled` en el
cleanup del `useEffect`.

| Hook | Qué carga | Notas |
|---|---|---|
| `useDeal(recordId)` | el Deal actual | expone también `patchDeal` (merge local) y `reload` |
| `useProducts()` | todos los Products activos | filtra por `Product_Active` |
| `useMateriales()` | Materiales_Producci_n activos | filtra por `Activo`; display = `Alias` |
| `useMetodosPago()` | opciones del picklist `Metodo_de_pago` | usa `ZOHO.CRM.META.getFields` |

Ejemplo (`useProducts`):

```js
export default function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getAllRecords(MODULES.PRODUCTS)
      .then((all) => {
        if (cancelled) return;
        setProducts(all.filter((p) => p[PRODUCT_FIELDS.ACTIVE] !== false));
      })
      .catch((raw) => !cancelled && setError(normalizeError(raw, "...")))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);
  return { products, loading, error };
}
```

`useMetodosPago` muestra cómo leer un picklist dinámicamente (en vez de
hardcodearlo):

```js
ZOHO.CRM.META.getFields({ Entity: MODULES.DEALS }).then((res) => {
  const field = (res?.fields || []).find((f) => f.api_name === DEAL_FIELDS.METODO_PAGO);
  const list = field?.pick_list_values || [];
  setOptions(list.map((o) => o.actual_value || o.display_value).filter(Boolean));
});
```

**➜ Para Pedidos Especiales KC:** se reutilizan `useProducts` y
`useMateriales` casi sin cambios. `useMetodosPago` se reutiliza, pero el
picklist `Metodo_de_pago` vivirá en otro módulo (o se vuelve una lista
estática en `constants.js` si el pedido especial no se guarda en un
módulo Zoho con ese campo). Se **elimina** `useDeal`. Se **agrega**
`useSets()` (idéntico a `useMateriales`, contra el módulo de Sets).

---

## 8. Componentes reutilizables (catálogo)

Estos componentes son genéricos y se llevan casi tal cual al nuevo widget.

### `ProductPicker` — dropdown buscable

Selector con campo de búsqueda que filtra por nombre/código (máx 50
resultados), cierra al hacer blur fuera. Al seleccionar, emite un objeto
plano con `{ id, name, unitPrice, material, base, altura, metrica }`.

### `MaterialPicker` — dropdown de materiales

Igual que `ProductPicker` pero sin búsqueda (lista corta). Display =
`Alias` del material, fallback a `Name`. Emite `{ id, alias, name, costoM2 }`.

### `CurrencyInput` — input de moneda

Input con prefijo `$`, formato es-MX al perder el foco, valor crudo
mientras se edita (evita saltos de cursor). Sanitiza separadores de miles
y normaliza coma decimal a punto. Emite `number | null`.

### `CustomDimensionsForm` — base/altura

Dos inputs numéricos (base y altura en cm). Controlado por el `row`
padre.

### `CuadrosSummary` — tabla resumen acumulada

Tabla con todas las filas capturadas (material, medidas, diseño,
integrantes, notas, cantidad, P.U., subtotal + fila de total). Cada
renglón es **clickable**: llama `onFocusRow(i)` para que el contenedor
haga scroll a la tarjeta correspondiente y la resalte.

### `ShippingFields` — dirección de entrega

Renderiza los inputs en bucle a partir del declarativo `SHIPPING_FIELDS`.
Soporta `text`, `select` (con `options`) y `textarea`. Marca visualmente
los campos con error vía el prop `errors`.

### `TotalsCard` — totales + método de pago + desglose

Muestra Total Sesión, Total Cuadros, Descuento, Anticipo, Gran Total y
Restante. Incluye el dropdown de método de pago y, según el método, los
campos del **desglose del cobro** (efectivo/transferencia/tarjetas).
Exporta helpers reutilizables: `calcSubtotal(rows)`,
`sumBreakdownAmount(breakdown, metodo)`, `isBreakdownComplete(...)`.

### Helper `getCI(obj, key)` — lookup case-insensitive

Aparece duplicado en `CuadroRow`, `CuadrosSummary`, `pdf.js` y
`woocommerce.js`. Zoho a veces devuelve api_names con distinta
capitalización según el endpoint (`getRecord` vs `getAllRecords`).
`getCI` busca la clave sin importar mayúsculas.

**➜ Para Pedidos Especiales KC:**
- `ProductPicker`, `MaterialPicker`, `CurrencyInput`,
  `CustomDimensionsForm`, `CuadrosSummary`, `ShippingFields` → **se
  copian tal cual**.
- `TotalsCard` → se reutiliza, pero se simplifica: no hay "Total Sesión"
  ni "Anticipo" provenientes de un Deal. El Gran Total es la suma de
  productos + cuadros personalizados; el desglose del cobro se mantiene
  igual.
- **Componente nuevo:** un `SetPicker` (clon de `MaterialPicker`) que
  liste los Sets del nuevo módulo. Al elegir un set, precarga
  base/altura/tipo de medida en el `row` (editables después) y deja que
  el usuario solo seleccione el material (FR-5, FR-5b).
- Conviene **extraer `getCI` a `utils/`** y dejar de duplicarlo.

---

## 9. Subforms — el patrón "borrar y recrear"

El widget escribe dos subforms del Deal: `Cuadros_Orden` (las
piezas/diseños) e `Integrantes_Sesion` (las personas).

### Serialización

Cada fila se normaliza al hidratar (`normalizeRow` / `normalizeIntegrante`)
y se serializa al guardar (`serializeRow` / `serializeIntegrante`). Los
lookups se mandan como `{ id }`:

```js
out[SUBFORM_FIELDS.PRODUCTO] = prod?.id ? { id: prod.id } : null;
out[SUBFORM_FIELDS.MATERIAL] = mat?.id ? { id: mat.id } : null;
```

### Estrategia: nunca enviar el `id` de la fila del subform

`serializeIntegrante` **NUNCA** incluye el `id` de la fila. Zoho
interpreta el envío como un **reemplazo completo**: borra todas las filas
y crea las nuevas. Esto evita el error
`"the subform id given seems to be invalid"` que aparecía cuando un id
local quedaba desincronizado.

La continuidad lógica del integrante se mantiene con un campo **`UUID`**
generado por el widget (`crypto.randomUUID()` con fallback) y persistido
en Zoho. Las filas de cuadros referencian integrantes por ese UUID
(`Integrantes_UUIDs` es un CSV de UUIDs), no por el id de Zoho.

### Reconciliación

`reconcileCuadrosRows(rows, integrantes)` (en `utils/integrantes.js`)
limpia de los cuadros los UUIDs de integrantes que ya no existen y
recomputa el campo denormalizado `Integrantes_Nombres`.

**➜ Para Pedidos Especiales KC:** la relación cuadro↔integrante **no
aplica** (los pedidos especiales son cuadros personalizados "sin
integrantes asociados", según el spec §2). Esto **simplifica mucho**: se
elimina `IntegrantesPanel`, `IntegrantesSelector`, `integrantes.js` y
todo el manejo de UUIDs.
Lo que **sí se conserva** es el patrón de **lista de filas en estado
local** (`rows`, `setRows`, `normalizeRow`, `serializeRow`): el pedido
especial es justamente una lista de líneas (productos de catálogo +
cuadros personalizados). Cada fila se serializa al construir el
`orderInput` de WooCommerce (sección 11), no a un subform de Zoho.

---

## 10. Validaciones y reglas de negocio

### Validación del desglose del cobro

`validateBreakdown()` devuelve `{ blocking, warning }`:
- **`blocking`** — campos obligatorios vacíos (referencias de
  transferencia, números de aprobación de tarjeta). **Detiene** el
  guardado.
- **`warning`** — la suma del desglose no cuadra con el restante. **No
  bloquea**: dispara un `window.confirm` y el operador decide.

`METODO_PAGO_BREAKDOWN` define qué campos pide cada método. Para métodos
con 2+ montos, el **último** campo de monto se auto-calcula en vivo como
`Restante − suma(otros montos)`.

### Validación de finalización

`validateFinalizar()` revisa, según el modo:
- con cuadros físicos → todos los campos requeridos de `SHIPPING_FIELDS`,
- sin cuadros → teléfono y email del contacto (con regex de email).

Marca los inputs con error vía los estados `shippingErrors` /
`contactErrors`.

### Campos fórmula de Zoho — nunca escribir

`Gran_Total` y `Restante_por_Pagar` son **fórmula** en Zoho. El widget
los **lee** pero **nunca** los incluye en el payload de `updateDeal`.
`Total_Cuadro` sí se escribe (es numérico regular).

### Datetime a Zoho

`Date#toISOString()` (sufijo `Z`) es **rechazado** por Zoho con
`INVALID_DATA`. Usar siempre `zohoDateTime()` de `formatters.js`, que
emite `YYYY-MM-DDTHH:mm:ss±HH:MM` con offset local.

**➜ Para Pedidos Especiales KC:** la validación del desglose del cobro y
`METODO_PAGO_BREAKDOWN` se reutilizan **tal cual**. La validación de
dirección de entrega (`SHIPPING_FIELDS` + `validateFinalizar`) también.
Las reglas de campos fórmula y `zohoDateTime` solo aplican si el nuevo
widget escribe a un módulo de Zoho; si solo crea la orden en WooCommerce,
no son relevantes — pero conviene conservar `zohoDateTime` por si se
registra metadata.

---

## 11. Integración con WooCommerce (la pieza clave a reutilizar)

Esta es la parte que el nuevo widget **necesita casi idéntica**: crear un
pedido en WooCommerce. Está documentada en detalle en
`docs/WOOCOMMERCE_FUNCTION.md`. Resumen:

### Arquitectura

El widget **no conoce las credenciales de WooCommerce**. El flujo es:

```
Widget (JS)                     Zoho Function (Deluge)         WooCommerce
─────────────                   ──────────────────────         ───────────
buildWooOrderPayload()  ──┐
                          │  executeFunction(...)
createWooOrder()  ────────┴──▶ krea_create_woocommerce_order
                                 ├─ lee Variable CRM (base_url)
                                 ├─ POST /products (por cada
                                 │   línea personalizada)      ──▶ crea producto
                                 ├─ POST /orders               ──▶ crea la orden
                                 └─ updateRecord en el Deal
                                    (Numero_de_orden, WC_ID)
                          ◀──── { ok, order_id, order_number }
```

Credenciales server-side: una **Zoho Connection** (`woocommerce`, Basic
auth con Consumer Key/Secret) + una **Variable CRM**
(`woocommerce_base_url`) + una Connection `crmsettings` para leer la
variable.

### `buildWooOrderPayload(...)` — el builder (`utils/woocommerce.js`)

Módulo **puro** (sin React, testeable). Construye el JSON que espera
`POST /wp-json/wc/v3/orders`:

- `billing` / `shipping` — del contacto + la dirección capturada.
- `line_items` — una línea por cada pieza:
  - **Producto de catálogo con `Woocommerce_ID`** → `product_id` directo.
  - **Pieza personalizada** (sin WC ID) → `product_id: 0` +
    `create_product: true` + `product_draft` (la Zoho Function crea el
    producto en WC antes de la orden, con nombre
    `"Pedido Especial | {cant} {material} {base}x{altura}cm"`).
  - **Diseño digital** → un `product_id` fijo de placeholder.
- `fee_lines` — si hay descuento, una línea negativa `"Descuento"`.
- `meta_data` — referencias para rastrear el pedido.
- Manejo de **IVA**: WooCommerce está configurado con
  `prices_include_tax: true`; los precios en el widget incluyen IVA, así
  que el builder los divide entre `1 + TAX_RATE` (0.16) antes de mandarlos.

### `createWooOrder(orderInput, dealId)` — la invocación

```js
export async function createWooOrder(orderInput, dealId) {
  const res = await executeFunction(WOOCOMMERCE.FUNCTION_NAME, {
    order_input: JSON.stringify(orderInput),
    deal_id: String(dealId || ""),
  });
  const raw = res?.details?.output || res?.output || ...;
  const parsed = JSON.parse(raw);
  return parsed.ok
    ? { ok: true, order_id, order_number, deal_updated }
    : { ok: false, error: parsed.error };
}
```

Nunca lanza: devuelve `{ ok: false, error }` y el caller decide. En el
widget actual, si falla NO se bloquea el flujo (el PDF y el guardado
continúan; el próximo intento reintenta).

### La Zoho Function (Deluge)

`krea_create_woocommerce_order` — función **standalone** que:
1. parsea el `order_input`,
2. lee la URL base desde la Variable CRM,
3. crea en WooCommerce los productos marcados `create_product: true`,
4. hace `POST /orders`,
5. escribe `Numero_de_orden` y `Woocommerce_Order_ID` de vuelta en el Deal.

El código Deluge completo está en `docs/WOOCOMMERCE_FUNCTION.md`, junto
con los prerrequisitos (Connection, Variable CRM, productos placeholder
en WP) y una guía de debugging de errores comunes (`WC 404`, permalinks,
connection no autorizada, etc.).

**➜ Para Pedidos Especiales KC:** este es el corazón reutilizable.
- `buildWooOrderPayload` y `createWooOrder` se copian y se **adaptan**:
  - El WooCommerce de **Krea Canvas** es otra tienda → nueva Connection,
    nueva Variable CRM, nueva Zoho Function (mismo código Deluge,
    apuntando a KC). Confirmar credenciales con el cliente.
  - El builder ya no recibe un `deal`: recibe directamente el contacto
    (seleccionado o recién creado), la dirección y las filas. La línea de
    "sesión" desaparece (no hay sesión fotográfica en un pedido especial).
  - El `deal_id` que se pasa a la función se vuelve opcional o se elimina
    (no hay Deal que actualizar). Importante por **NFR-1**: el widget de
    Pedidos Especiales **no debe crear ni modificar Deals**.
  - El naming de productos personalizados (`"Pedido Especial | ..."`) ya
    coincide con lo que pide el spec — y además es el **prefijo que la
    integración de productos del Componente 2 excluye** de la
    sincronización (SC-4, FR-14). Mantenerlo exactamente igual.
  - El manejo de IVA, `fee_lines` de descuento y `meta_data` se conservan.
- La Zoho Function Deluge se reutiliza casi línea por línea, solo
  cambiando las connections y, si se decide, quitando el bloque que
  escribe de vuelta al Deal.

---

## 12. Generación de PDF (referencia, fuera de alcance del nuevo widget)

`utils/pdf.js` genera el recibo con **pdf-lib** en el cliente:
estructura top-down (header con logo → bloque de cliente → detalle de
sesión → tabla de cuadros → totales → datos de envío → footer).

Gotchas documentados:
- pdf-lib con fuentes estándar usa **WinAnsi**; pasar todo texto de Zoho
  por `nfc()` para normalizar acentos (NFD→NFC) y quitar caracteres
  invisibles.
- El guion `−` (U+2212) no existe en WinAnsi: usar ASCII `-`.
- El logo se carga con `fetch('img/ks-logo.png')`; si falla, cae a un
  placeholder de texto.

**➜ Para Pedidos Especiales KC:** según el spec §4 ("Fuera del
Alcance" → *"Generación de recibo de entrega — no aplica para este
widget"*), el nuevo widget **no genera PDF**. Se omite `pdf.js`,
`GenerateQuoteButton` (la parte de PDF) y la dependencia `pdf-lib`. El
botón final solo dispara la creación de la orden en WooCommerce.

---

## 13. Estilos y UX

- `src/styles.css` — único CSS global. Design tokens en `:root`
  (`--brand`, `--accent`, `--bg`, `--ink`, ...).
- Topbar con `position: sticky` + `z-index` para quedar fija al
  scrollear (ningún ancestro debe tener `overflow: hidden`).
- Tooltips en CSS puro con `[data-tooltip]` + `.info-dot`.
- No introducir librerías de UI (MUI, Mantine): la UI se hace a mano.

**➜ Para Pedidos Especiales KC:** copiar `styles.css` como base y ajustar
los design tokens al branding de Krea Canvas. Las clases de los
componentes reutilizados (`.picker`, `.currency-input`, `.cuadro`,
`.cuadros-summary`, `.field`, `.totals`, etc.) ya vienen con el CSS.

---

## 14. Gotchas y errores conocidos

| Síntoma | Causa / solución |
|---|---|
| `INVALID_DATA` al guardar | datetime sin offset (usar `zohoDateTime`) o intento de escribir un campo fórmula |
| `"the subform id given seems to be invalid"` | nunca enviar el `id` de filas de subform — Zoho borra y recrea |
| Material con acento no muestra Alias | `Alias` no llega en `getAllRecords`: verificar que esté en el layout default del módulo |
| `SES_UNCAUGHT_EXCEPTION` en consola (Firefox) | ruido de extensiones del navegador / WMS de Zoho — ignorable |
| `WC 404` / `WC :` al crear orden | permalinks de WordPress en "Plain", redirects del servidor, o connection no autorizada — ver `WOOCOMMERCE_FUNCTION.md` §Debugging |
| El bundle desplegado no refleja cambios | `app/js/bundle.js` es generado; recompilar con `npm run build` y re-empacar con `zet pack` |
| Cert self-signed rechazado en dev | re-visitar `https://127.0.0.1:9000` y aceptar la advertencia al inicio de cada sesión de navegador |

---

## 15. Checklist de arranque para el widget de Pedidos Especiales KC

1. **Scaffolding** — clonar la estructura del repo siguiendo
   `WIDGET_STARTER_GUIDE.md` (webpack, babel, server, manifest).
2. **`constants.js`** — partir del de Krea Studio: conservar `MODULES`
   (+ módulo Sets), `PRODUCT_FIELDS`, `MATERIAL_FIELDS`, `SHIPPING_FIELDS`,
   `ESTADOS_MEXICO`, `METODO_PAGO_*`, `WOOCOMMERCE`; agregar `SET_FIELDS`;
   quitar `DEAL_FIELDS`, `STAGE_VALUES`, `INTEGRANTE_FIELDS`.
3. **`zohoApi.js`** — conservar `normalizeError`, `getAllRecords`,
   `executeFunction`, `coqlPaged`; agregar `searchContacts`,
   `createContact`, `getSets`; quitar wrappers de Deals.
4. **Hooks** — reutilizar `useProducts`, `useMateriales`; agregar
   `useSets`; quitar `useDeal`.
5. **Componentes reutilizables** — copiar `ProductPicker`,
   `MaterialPicker`, `CurrencyInput`, `CustomDimensionsForm`,
   `CuadrosSummary`, `ShippingFields`, `TotalsCard` (simplificado).
6. **Componentes nuevos** — `ContactSearchPanel` (buscar/crear contacto,
   FR-1/FR-2), `SetPicker` (FR-5), `OrderForm` (el orquestador, reemplaza
   a `DealDetail`).
7. **WooCommerce** — copiar `woocommerce.js`, adaptar `buildWooOrderPayload`
   (sin Deal, sin línea de sesión) y `createWooOrder`; crear la nueva
   Connection + Variable CRM + Zoho Function para el WooCommerce de KC.
8. **Verificar NFR-1** — el widget **no** debe tocar Deals en ninguna
   ruta de código.
9. **Quitar** — `pdf.js`, `GenerateQuoteButton` (PDF), `IntegrantesPanel`,
   `IntegrantesSelector`, `integrantes.js`, `DealsList`, `DealHeader`,
   `CitaTerminadaPanel`, `CuadrosToggle`, la dependencia `pdf-lib`.

---

## 16. Mapa de archivos: qué reutilizar

| Archivo de Krea Studio | Acción para Pedidos Especiales KC |
|---|---|
| `webpack.config.js`, `babel.config.json`, `server/index.js` | **copiar tal cual** |
| `package.json` | copiar, quitar `pdf-lib` |
| `plugin-manifest.json` | copiar, cambiar `name`/`description` |
| `src/index.jsx` | **copiar tal cual** |
| `src/App.jsx` | adaptar (una sola pantalla o lista↔formulario) |
| `src/utils/constants.js` | **base directa** — ver checklist §15.2 |
| `src/utils/zohoApi.js` | **base directa** — ver checklist §15.3 |
| `src/utils/formatters.js` | **copiar tal cual** |
| `src/utils/woocommerce.js` | **base directa** — adaptar builder (§11) |
| `src/hooks/useProducts.js`, `useMateriales.js`, `useMetodosPago.js` | copiar / adaptar |
| `src/hooks/useDeal.js` | descartar |
| `src/components/ProductPicker.jsx` | **copiar tal cual** |
| `src/components/MaterialPicker.jsx` | **copiar tal cual** (+ clonar como `SetPicker`) |
| `src/components/CurrencyInput.jsx` | **copiar tal cual** |
| `src/components/CustomDimensionsForm.jsx` | copiar (+ campo "tipo de medida") |
| `src/components/CuadrosSummary.jsx` | copiar, ajustar columnas |
| `src/components/CuadroRow.jsx` | adaptar (quitar integrantes, agregar SetPicker) |
| `src/components/CuadrosList.jsx` | copiar, adaptar |
| `src/components/ShippingFields.jsx` | **copiar tal cual** |
| `src/components/TotalsCard.jsx` | copiar, simplificar (sin sesión/anticipo) |
| `src/components/DealDetail.jsx` | **referencia del orquestador** — reescribir como `OrderForm` |
| `src/components/DealsList.jsx`, `DealHeader.jsx`, `CitaTerminadaPanel.jsx`, `CuadrosToggle.jsx` | descartar |
| `src/components/IntegrantesPanel.jsx`, `IntegrantesSelector.jsx`, `src/utils/integrantes.js` | descartar |
| `src/utils/pdf.js`, `GenerateQuoteButton.jsx` | descartar (PDF fuera de alcance) |
| `docs/WOOCOMMERCE_FUNCTION.md` | **referencia directa** para la nueva Zoho Function |
| `WIDGET_STARTER_GUIDE.md` | **referencia directa** para el scaffolding y deploy |

---

*Documento generado como entregable D-2 del proyecto Widget de Pedidos
Especiales + Integración de Productos — Krea Canvas. Basado en el código
del widget Citas Krea Studio (rama `main`).*
