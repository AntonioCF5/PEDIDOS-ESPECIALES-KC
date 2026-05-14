# Zoho Function — `krea_create_woocommerce_order_kc`

Función **standalone** en Deluge que crea la orden de un pedido especial en el
**WooCommerce de Krea Canvas**. El widget no conoce las credenciales de
WooCommerce: arma el `order_input` y se lo pasa a esta función, que crea
server-side los productos personalizados y la orden.

```
Widget (JS)                    Zoho Function (Deluge)            WooCommerce KC
─────────────                  ───────────────────────           ──────────────
buildWooOrderPayload()  ──┐
                          │ executeFunction(...)
createWooOrder()  ────────┴─▶ krea_create_woocommerce_order_kc
                               ├─ lee Variable CRM (base_url)
                               ├─ POST /products  (por cada línea
                               │   con create_product:true)        ──▶ crea producto
                               └─ POST /orders                     ──▶ crea la orden
                          ◀──── { ok, order_id, order_number }
```

> **NFR-1:** esta función **no** crea ni modifica Deals de Zoho. Tampoco
> escribe de vuelta a ningún módulo del CRM (a diferencia del widget de Krea
> Studio, que actualizaba el Deal). Su única responsabilidad es WooCommerce.

---

## 1. Prerrequisitos en Zoho CRM

| # | Recurso | Detalle |
|---|---|---|
| 1 | **Connection** `woocommerce_kc` | Tipo *Basic Authentication*. Usuario = Consumer Key, contraseña = Consumer Secret de la REST API de WooCommerce KC (WooCommerce → Ajustes → Avanzado → REST API, permisos *Read/Write*). |
| 2 | **Variable CRM** `woocommerce_kc_base_url` | URL base del sitio, p. ej. `https://kreacanvas.com`. Sin slash final. |
| 3 | **Connection** `crmsettings` | Para leer la Variable CRM desde Deluge (`zoho.crm` scope con `ZohoCRM.settings.variables.READ`). |
| 4 | **Función standalone** | Nombre API: `krea_create_woocommerce_order_kc`. Un parámetro: `arguments` (string). |

> El WooCommerce de KC es **otra tienda** que la de Krea Studio: requiere su
> propia Connection, su propia Variable CRM y esta función dedicada.

### Q-4 — webhook de Zoho Flow

El Componente 2 (integración de productos) usa Zoho Flow. Esta función es
independiente de Flow; no comparte conexión. Confirmar con el implementador si
WooCommerce KC ya tiene el plugin/keys de Flow o se configuran aparte.

---

## 2. Código Deluge

```javascript
// Función standalone: krea_create_woocommerce_order_kc
// Parámetro: arguments (STRING)  -> JSON: { "order_input": { ... } }

response = Map();

// --- 1. Parsear argumentos -------------------------------------------------
argMap = Map();
try {
    argMap = arguments.toMap();
} catch (e) {
    response.put("ok", false);
    response.put("error", "arguments no es un JSON válido");
    return response.toString();
}

orderInput = argMap.get("order_input");
if (orderInput == null) {
    response.put("ok", false);
    response.put("error", "Falta order_input");
    return response.toString();
}
// Si vino como string, convertir a Map.
if (orderInput.getDataType() == "text") {
    orderInput = orderInput.toMap();
}

// --- 2. Leer URL base desde Variable CRM -----------------------------------
baseUrl = "";
try {
    varResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v3/settings/variables/woocommerce_kc_base_url"
        type: GET
        connection: "crmsettings"
    ];
    baseUrl = varResp.get("variables").get(0).get("value");
} catch (e) {
    response.put("ok", false);
    response.put("error", "No se pudo leer woocommerce_kc_base_url: " + e.toString());
    return response.toString();
}
apiBase = baseUrl + "/wp-json/wc/v3";

// --- 3. Crear productos personalizados y armar line_items ------------------
finalLineItems = List();
inLineItems = orderInput.get("line_items");
if (inLineItems == null) {
    inLineItems = List();
}

for each li in inLineItems
{
    if (li.get("create_product") == true)
    {
        draft = li.get("product_draft");
        prodResp = invokeurl
        [
            url: apiBase + "/products"
            type: POST
            parameters: draft.toString()
            content-type: "application/json"
            connection: "woocommerce_kc"
        ];
        newProductId = prodResp.get("id");
        if (newProductId == null) {
            response.put("ok", false);
            response.put("error", "No se pudo crear el producto: " + prodResp.toString());
            return response.toString();
        }
        item = Map();
        item.put("product_id", newProductId);
        item.put("quantity", li.get("quantity"));
        if (li.get("subtotal") != null) { item.put("subtotal", li.get("subtotal")); }
        if (li.get("total") != null) { item.put("total", li.get("total")); }
        if (li.get("meta_data") != null) { item.put("meta_data", li.get("meta_data")); }
        finalLineItems.add(item);
    }
    else
    {
        // Producto de catálogo: ya trae product_id. Se quita la marca de extensión.
        li.remove("create_product");
        li.remove("product_draft");
        finalLineItems.add(li);
    }
}

// --- 4. Crear la orden -----------------------------------------------------
orderPayload = Map();
orderPayload.put("status", orderInput.get("status"));
orderPayload.put("set_paid", orderInput.get("set_paid"));
orderPayload.put("billing", orderInput.get("billing"));
orderPayload.put("shipping", orderInput.get("shipping"));
orderPayload.put("line_items", finalLineItems);
if (orderInput.get("fee_lines") != null) {
    orderPayload.put("fee_lines", orderInput.get("fee_lines"));
}
if (orderInput.get("customer_note") != null) {
    orderPayload.put("customer_note", orderInput.get("customer_note"));
}
if (orderInput.get("meta_data") != null) {
    orderPayload.put("meta_data", orderInput.get("meta_data"));
}

orderResp = invokeurl
[
    url: apiBase + "/orders"
    type: POST
    parameters: orderPayload.toString()
    content-type: "application/json"
    connection: "woocommerce_kc"
];

orderId = orderResp.get("id");
if (orderId == null) {
    response.put("ok", false);
    response.put("error", "No se pudo crear la orden: " + orderResp.toString());
    return response.toString();
}

// --- 5. Respuesta ----------------------------------------------------------
response.put("ok", true);
response.put("order_id", orderId);
response.put("order_number", orderResp.get("number"));
return response.toString();
```

> El widget (`createWooOrder` en `src/utils/woocommerce.js`) parsea esta cadena
> JSON. Si `ok` es `false`, el widget muestra `error` y **no** avanza a la
> pantalla de confirmación.

---

## 3. Debugging de errores comunes

| Síntoma | Causa / solución |
|---|---|
| `WC 404` al llamar `/products` o `/orders` | Permalinks de WordPress en *Plain*: cámbialos a *Post name*. También revisa redirects del servidor (www / no-www / http→https). |
| `woocommerce_rest_authentication_error` | La Connection `woocommerce_kc` no está autorizada o las keys no tienen permiso *Read/Write*. Regenera las keys y reautoriza la Connection. |
| `No se pudo leer woocommerce_kc_base_url` | Falta la Variable CRM o la Connection `crmsettings` no tiene el scope `ZohoCRM.settings.variables.READ`. |
| Precios con IVA duplicado | WooCommerce KC tiene `prices_include_tax = true`. El widget ya divide los precios entre `1 + TAX_RATE` (`src/utils/woocommerce.js`). No volver a aplicar IVA aquí. |
| El producto personalizado aparece en el catálogo público | El `product_draft` se manda con `catalog_visibility: "hidden"`. Verifica que WooCommerce respete ese flag; si no, créalo como borrador (`status: "draft"`). |
| Productos personalizados se sincronizan a Zoho por error | Su nombre empieza con `Pedido Especial` — la integración del Componente 2 debe excluir ese prefijo (FR-14). |
