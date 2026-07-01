/**
 * woocommerce.js — builder del payload de la orden + invocación a la Zoho
 * Function que la crea en el WooCommerce de Krea Canvas.
 *
 * `buildWooOrderPayload` es un módulo PURO (sin React, testeable).
 *
 * Arquitectura: el widget NO conoce las credenciales de WooCommerce. Arma el
 * `orderInput` y se lo pasa a la Zoho Function `WOOCOMMERCE.FUNCTION_NAME`,
 * que crea los productos personalizados y la orden server-side.
 * Ver docs/WOOCOMMERCE_FUNCTION.md.
 *
 * NFR-1: este módulo NO crea ni modifica Deals de Zoho bajo ninguna circunstancia.
 */
import {
  WOOCOMMERCE,
  ROW_TYPES,
  TIPO_MEDIDA,
  TIPO_PEDIDO_VALUES,
  METODO_PAGO_BREAKDOWN,
  METODO_PAGO_WC_SLUG,
  ESTADO_WC_CODE,
  DEAL_FIELDS,
} from "./constants";
import { executeFunction, getDeal } from "./zohoApi";
import { toNumber, round2, formatCurrency } from "./formatters";

/** Sleep helper para el polling. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sondea el Deal cada `intervalMs` hasta que aparezca `Numero_de_orden` o
 * se agote `timeoutMs`. Se usa como fallback cuando el SDK
 * `ZOHO.CRM.FUNCTIONS.execute` falla con timeout (la función Deluge tarda
 * ~10s+ y el gateway del widget corta antes, pero la función igual termina
 * server-side y escribe Numero_de_orden / Woocommerce_Order_ID en el Deal).
 *
 * Devuelve el mismo shape que createWooOrder.
 */
async function pollDealForWcOrder(dealId, timeoutMs, intervalMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(intervalMs);
    let deal;
    try {
      deal = await getDeal(dealId);
    } catch {
      continue; // error de red transitorio → seguimos polleando
    }
    const orderNumber = deal?.[DEAL_FIELDS.NUMERO_ORDEN];
    const wcId = deal?.[DEAL_FIELDS.WOOCOMMERCE_ORDER_ID];
    if (orderNumber && String(orderNumber).trim()) {
      return {
        ok: true,
        order_id: wcId || null,
        order_number: orderNumber,
        // La función Deluge ya escribió ambos campos — confirmamos como
        // deal_updated:true para que el widget NO intente la actualización
        // de respaldo (sería un overwrite redundante con los mismos valores).
        deal_updated: true,
        deal_update_error: null,
      };
    }
  }
  return {
    ok: false,
    error: `Timeout esperando confirmación del pedido (${Math.floor(timeoutMs / 1000)}s sin Numero_de_orden en el Deal).`,
  };
}

/**
 * WooCommerce KC tiene prices_include_tax = true. Los precios del widget
 * incluyen IVA, así que se dividen entre (1 + TAX_RATE) antes de enviarlos.
 */
function exTax(amountInclTax) {
  const n = toNumber(amountInclTax);
  if (n == null) return 0;
  return round2(n / (1 + WOOCOMMERCE.TAX_RATE));
}

/** Etiqueta legible de medidas para el nombre del producto personalizado. */
function medidasLabel(row) {
  const unidad = row.tipoMedida === TIPO_MEDIDA.PULGADAS ? "in" : "cm";
  const base = row.base != null && row.base !== "" ? row.base : "?";
  const altura = row.altura != null && row.altura !== "" ? row.altura : "?";
  return `${base}x${altura}${unidad}`;
}

/** Nombre del material de una línea personalizada. */
function materialLabel(row) {
  return row.material?.alias || row.material?.name || "Material";
}

/** Subtotal (con IVA) de una línea del pedido. */
export function rowSubtotal(row) {
  const qty = toNumber(row.cantidad) || 0;
  const pu = toNumber(row.precioUnitario) || 0;
  return round2(qty * pu);
}

/**
 * Construye los detalles del cuadro custom — los usamos en DOS lugares por
 * cada line_item: como `meta_data` (línea de orden) y como `attributes`
 * (producto en sí). Doble vía hace el display inmune al tema/template:
 *   - meta_data: lo que WooCommerce muestra por default bajo cada línea.
 *   - attributes con visible:true: queda pegado al producto, aparece en
 *     correo de orden, página de producto y página de orden incluso si
 *     el tema sobreescribe `order-details-item-meta.php`.
 */
function buildCuadroFields(row) {
  const fields = [
    { name: "Tipo", value: "Cuadro personalizado" },
    { name: "Material", value: materialLabel(row) },
    { name: "Base", value: String(row.base ?? "") },
    { name: "Altura", value: String(row.altura ?? "") },
    { name: "Tipo de medida", value: row.tipoMedida || TIPO_MEDIDA.CM },
  ];
  if (row.set?.name) fields.push({ name: "Set", value: String(row.set.name) });
  if (row.notas) fields.push({ name: "Notas", value: String(row.notas) });
  return fields;
}

/** Construye una línea `line_items` para WooCommerce a partir de un row. */
function buildLineItem(row, tipoPedido) {
  const qty = toNumber(row.cantidad) || 1;
  const puExTax = exTax(row.precioUnitario);
  const totalExTax = round2(puExTax * qty);

  // Producto de catálogo con Woocommerce_ID → se referencia directo.
  if (row.tipo === ROW_TYPES.CATALOGO && row.producto?.woocommerceId) {
    const item = {
      product_id: Number(row.producto.woocommerceId),
      quantity: qty,
    };
    // Solo override de precio si el operador lo cambió respecto al de catálogo.
    if (row.precioUnitario != null && row.precioUnitario !== "") {
      item.subtotal = String(totalExTax);
      item.total = String(totalExTax);
    }
    if (row.notas) {
      item.meta_data = [{ key: "Notas", value: String(row.notas) }];
    }
    return item;
  }

  // Pieza personalizada — la Zoho Function crea el producto en WooCommerce
  // antes de postear la orden. Prefijo dinámico según tipoPedido:
  //   Muestra        → "Muestra | 1 Canvas 60x80cm"
  //   Reposición     → "Reposición | 1 Canvas 60x80cm"
  //   Pedido Especial → "Pedido Especial | 1 Canvas 60x80cm"
  const prefix =
    (tipoPedido && String(tipoPedido).trim()) ||
    WOOCOMMERCE.CUSTOM_PRODUCT_PREFIX;
  const nombre =
    `${prefix} | ${qty} ${materialLabel(row)} ` + medidasLabel(row);

  const fields = buildCuadroFields(row);

  // Para attributes de WooCommerce: name, visible:true, options:[<value>].
  const attributes = fields.map((f) => ({
    name: f.name,
    visible: true,
    options: [f.value],
  }));

  // Para meta_data del line_item: key/value plano (formato heredado, sigue
  // funcionando como antes en Krea Studio).
  const meta_data = fields.map((f) => ({ key: f.name, value: f.value }));

  return {
    product_id: 0,
    create_product: true,
    product_draft: {
      name: nombre,
      type: "simple",
      regular_price: String(puExTax),
      status: "publish",
      catalog_visibility: "hidden",
      attributes,
    },
    quantity: qty,
    subtotal: String(totalExTax),
    total: String(totalExTax),
    meta_data,
  };
}

/**
 * Construye las entradas de `meta_data` a nivel ORDEN para que el pago aparezca
 * legible en la página de la orden de WooCommerce. Las keys son texto plano
 * sin underscore inicial (las que empiezan con `_` WC las trata como meta
 * privado y no las muestra en la UI).
 *
 * Recorre el `METODO_PAGO_BREAKDOWN[metodoPago]` para saber qué campos pide
 * el método elegido, agarra el valor capturado del `breakdown`, y los empuja
 * usando el `label` declarativo (mismo que el operador vio en el widget).
 */
function buildPaymentMetaForOrder(metodoPago, breakdown) {
  const out = [];
  if (!metodoPago) return out;
  out.push({ key: "Método de pago", value: metodoPago });
  const fields = METODO_PAGO_BREAKDOWN[metodoPago] || [];
  for (const f of fields) {
    const raw = breakdown?.[f.key];
    if (raw == null || raw === "") continue;
    if (f.type === "amount") {
      const num = toNumber(raw);
      if (num == null) continue;
      out.push({ key: f.label, value: formatCurrency(num) });
    } else {
      out.push({ key: f.label, value: String(raw) });
    }
  }
  return out;
}

/**
 * Construye el JSON que espera `POST /wp-json/wc/v3/orders` (con la extensión
 * `create_product` que interpreta la Zoho Function para las piezas nuevas).
 *
 * El widget arma este payload y se lo pasa a `krea_create_woocommerce_order`
 * vía `createWooOrder(payload, dealId)`. La función Deluge lo parsea como
 * `order_input.toJSONMap()` y postea a WooCommerce server-side. La tienda
 * (KC/KS) la lee del Deal, no del payload.
 */
export function buildWooOrderPayload({
  tipoPedido,
  ordenAReponer,
  tienda,
  contacto,
  direccion,
  rows,
  totals,
  metodoPago,
  breakdown,
  dealId,
}) {
  // tipoPedido lo necesita buildLineItem para el prefijo del producto custom.
  const _tipoPedido = tipoPedido || "";
  const firstName = contacto?.firstName || "";
  const lastName = contacto?.lastName || contacto?.fullName || "";

  // WC para México exige código ISO 3166-2 ("COA"), no el nombre completo
  // ("Coahuila"). Si el operador no eligió estado, mandamos string vacío
  // (WC lo acepta vacío; rechaza solo cuando llega un valor desconocido).
  const estadoNombre = direccion?.ESTADO || "";
  const estadoCode = ESTADO_WC_CODE[estadoNombre] || "";

  const address = {
    first_name: firstName,
    last_name: lastName,
    address_1: direccion?.CALLE_Y_NUMERO || "",
    address_2: direccion?.COLONIA || "",
    city: direccion?.CIUDAD || "",
    state: estadoCode,
    postcode: direccion?.CODIGO_POSTAL || "",
    country: "MX",
  };

  const billing = {
    ...address,
    email: contacto?.email || "",
    phone: contacto?.phone || "",
  };

  const line_items = (rows || []).map((row) => buildLineItem(row, _tipoPedido));

  const fee_lines = [];
  const descuento = toNumber(totals?.descuento) || 0;
  if (descuento > 0) {
    fee_lines.push({
      name: "Descuento",
      total: String(-exTax(descuento)),
      tax_status: "taxable",
    });
  }

  // "Orden a reponer" — solo aplica a reposiciones; se usa tanto en el
  // customer_note (banda visible arriba del pedido) como en meta_data.
  const orden = String(ordenAReponer || "").trim();
  const isReposicion =
    tipoPedido === TIPO_PEDIDO_VALUES.REPOSICION && Boolean(orden);

  const customer_note = [
    tipoPedido ? `Tipo de pedido: ${tipoPedido}` : "",
    tienda ? `Tienda: ${tienda}` : "",
    direccion?.NOTAS_ENTREGA ? `Entrega: ${direccion.NOTAS_ENTREGA}` : "",
    metodoPago ? `Método de pago: ${metodoPago}` : "",
    isReposicion ? `Orden a reponer: ${orden}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  // Meta legible para la UI de la orden en WC (primero, así aparece arriba).
  const paymentMeta = buildPaymentMetaForOrder(metodoPago, breakdown);

  // Misma "Orden a reponer" también como meta_data legible (key sin "_"
  // inicial para que WC la muestre en la página de la orden).
  const reposicionMeta = isReposicion
    ? [{ key: "Orden a reponer", value: orden }]
    : [];

  const meta_data = [
    // 1) Bloque visible para el cliente / staff en la página de la orden WC.
    ...paymentMeta,
    ...reposicionMeta,
    // 2) Bloque legacy (snake_case) para downstream — Zoho Functions,
    //    reportes, integraciones. WC los muestra igual, pero la información
    //    útil ya quedó arriba con labels en español.
    { key: "origen", value: "Widget Pedidos Especiales KC" },
    { key: "tipo_pedido", value: tipoPedido || "" },
    { key: "tienda", value: tienda || "" },
    { key: "metodo_pago", value: metodoPago || "" },
    { key: "desglose_cobro", value: JSON.stringify(breakdown || {}) },
    { key: "contacto_zoho_id", value: String(contacto?.id || "") },
    { key: "deal_zoho_id", value: String(dealId || "") },
    { key: "total_capturado", value: String(toNumber(totals?.granTotal) || 0) },
  ];

  // payment_method (slug) y payment_method_title (display) llenan los campos
  // nativos de WC. set_paid: true cuando el operador seleccionó método —
  // significa que la transacción se cerró en el widget; WC marca la orden
  // como pagada y le aplica el ORDER_STATUS sin pasar por "pending".
  const paymentSlug = METODO_PAGO_WC_SLUG[metodoPago] || "";

  return {
    status: WOOCOMMERCE.ORDER_STATUS,
    payment_method: paymentSlug,
    payment_method_title: metodoPago || "",
    set_paid: Boolean(metodoPago),
    billing,
    shipping: address,
    line_items,
    fee_lines,
    customer_note,
    meta_data,
  };
}

/**
 * Invoca la Zoho Function `krea_create_woocommerce_order`.
 *
 * Firma Deluge:
 *   string standalone.krea_create_woocommerce_order(String order_input,
 *                                                   String deal_id)
 *
 * `order_input` viaja como string JSON serializado del WC payload (line_items,
 * billing, shipping, fee_lines, meta_data). La función parsea, crea productos
 * personalizados si aplica, postea la orden en WooCommerce y actualiza el
 * Deal con Numero_de_orden / Woocommerce_Order_ID. La tienda (KC/KS) la
 * resuelve leyendo el Deal — no se manda como argumento.
 *
 * Nunca lanza: devuelve { ok, order_id, order_number } | { ok:false, error }.
 */
export async function createWooOrder(orderInput, dealId) {
  let primaryError = null;
  try {
    // Single-stringify es suficiente ahora que executeFunction NO envuelve
    // en `arguments` (ver zohoApi.js). El SDK entrega `order_input` como
    // String al param nombrado de la firma Deluge.
    const res = await executeFunction(WOOCOMMERCE.FUNCTION_NAME, {
      order_input: JSON.stringify(orderInput || {}),
      deal_id: String(dealId || ""),
    });

    // La Function puede devolver el resultado en distintas envolturas.
    let raw =
      res?.details?.output ??
      res?.output ??
      res?.details?.outputs ??
      res?.result ??
      res;

    let parsed = raw;
    if (typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { ok: false, error: raw };
      }
    }

    if (parsed && parsed.ok) {
      // Camino feliz — la función terminó antes del timeout del SDK.
      // `deal_updated` indica si la Deluge logró escribir Numero_de_orden /
      // Woocommerce_Order_ID. Default seguro `true` cuando viene ausente.
      return {
        ok: true,
        order_id: parsed.order_id,
        order_number: parsed.order_number || parsed.order_id,
        deal_updated: parsed.deal_updated !== false,
        deal_update_error: parsed.deal_update_error || null,
      };
    }
    primaryError =
      parsed?.error ||
      "La función de WooCommerce no devolvió un resultado válido.";
  } catch (err) {
    primaryError = err?.message || String(err) || "Error al invocar la función.";
  }

  // Si llegamos acá: el SDK falló o devolvió un resultado raro. La causa
  // más común es el TIMEOUT del gateway del widget (~10s) cuando la función
  // tarda más (crear producto WC custom + crear orden suele tomar 10-15s).
  // La función Deluge, sin embargo, sigue corriendo server-side hasta
  // terminar — y al terminar escribe Numero_de_orden en el Deal.
  //
  // Polling de respaldo: revisamos el Deal cada 3 s hasta encontrar
  // Numero_de_orden o cumplir 90 s. Si lo encontramos → el pedido SÍ se
  // creó y devolvemos ok=true con los datos del Deal.
  if (!dealId) {
    return { ok: false, error: primaryError };
  }
  // 180 s (3 min) es el techo — la función Deluge con /products/batch termina
  // <30 s incluso para pedidos de 100 productos custom, así que rarísimo
  // llegamos ahí. Intervalo de 2 s = detección más rápida (30 pings/min).
  const polled = await pollDealForWcOrder(dealId, 180000, 2000);
  if (polled.ok) {
    return polled;
  }
  return {
    ok: false,
    error: `${primaryError}\n\nReintenté leyendo el Deal por 90 s y tampoco apareció el número de orden, así que la función no completó. ${polled.error}`,
  };
}
