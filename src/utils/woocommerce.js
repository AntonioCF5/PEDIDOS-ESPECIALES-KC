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
import { WOOCOMMERCE, ROW_TYPES, TIPO_MEDIDA } from "./constants";
import { executeFunction } from "./zohoApi";
import { toNumber, round2 } from "./formatters";

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

/** Construye una línea `line_items` para WooCommerce a partir de un row. */
function buildLineItem(row) {
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

  // Pieza personalizada (sin WC ID) → la Zoho Function crea el producto en
  // WooCommerce antes de la orden, con el prefijo "Pedido Especial".
  const nombre =
    `${WOOCOMMERCE.CUSTOM_PRODUCT_PREFIX} | ${qty} ${materialLabel(row)} ` +
    medidasLabel(row);

  const item = {
    product_id: 0,
    create_product: true,
    product_draft: {
      name: nombre,
      type: "simple",
      regular_price: String(puExTax),
      status: "publish",
      catalog_visibility: "hidden",
    },
    quantity: qty,
    subtotal: String(totalExTax),
    total: String(totalExTax),
    meta_data: [
      { key: "Tipo", value: "Cuadro personalizado" },
      { key: "Material", value: materialLabel(row) },
      { key: "Base", value: String(row.base ?? "") },
      { key: "Altura", value: String(row.altura ?? "") },
      {
        key: "Tipo de medida",
        value: row.tipoMedida || TIPO_MEDIDA.CM,
      },
    ],
  };
  if (row.set?.name) {
    item.meta_data.push({ key: "Set", value: String(row.set.name) });
  }
  if (row.notas) {
    item.meta_data.push({ key: "Notas", value: String(row.notas) });
  }
  return item;
}

/**
 * Construye el JSON que espera `POST /wp-json/wc/v3/orders` (con la extensión
 * `create_product` que interpreta la Zoho Function para las piezas nuevas).
 */
export function buildWooOrderPayload({
  contacto,
  direccion,
  rows,
  totals,
  metodoPago,
  breakdown,
}) {
  const firstName = contacto?.firstName || "";
  const lastName = contacto?.lastName || contacto?.fullName || "";

  const address = {
    first_name: firstName,
    last_name: lastName,
    address_1: direccion?.CALLE_Y_NUMERO || "",
    address_2: direccion?.COLONIA || "",
    city: direccion?.CIUDAD || "",
    state: direccion?.ESTADO || "",
    postcode: direccion?.CODIGO_POSTAL || "",
    country: "MX",
  };

  const billing = {
    ...address,
    email: contacto?.email || "",
    phone: contacto?.phone || "",
  };

  const line_items = (rows || []).map(buildLineItem);

  const fee_lines = [];
  const descuento = toNumber(totals?.descuento) || 0;
  if (descuento > 0) {
    fee_lines.push({
      name: "Descuento",
      total: String(-exTax(descuento)),
      tax_status: "taxable",
    });
  }

  const customer_note = [
    direccion?.NOTAS_ENTREGA ? `Entrega: ${direccion.NOTAS_ENTREGA}` : "",
    metodoPago ? `Método de pago: ${metodoPago}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const meta_data = [
    { key: "origen", value: "Widget Pedidos Especiales KC" },
    { key: "metodo_pago", value: metodoPago || "" },
    { key: "desglose_cobro", value: JSON.stringify(breakdown || {}) },
    { key: "contacto_zoho_id", value: String(contacto?.id || "") },
    { key: "total_capturado", value: String(toNumber(totals?.granTotal) || 0) },
  ];

  return {
    status: WOOCOMMERCE.ORDER_STATUS,
    set_paid: false,
    billing,
    shipping: address,
    line_items,
    fee_lines,
    customer_note,
    meta_data,
  };
}

/**
 * Invoca la Zoho Function que crea la orden en WooCommerce KC.
 * Nunca lanza: devuelve { ok, order_id, order_number } | { ok:false, error }.
 */
export async function createWooOrder(orderInput) {
  try {
    const res = await executeFunction(WOOCOMMERCE.FUNCTION_NAME, {
      order_input: orderInput,
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
      return {
        ok: true,
        order_id: parsed.order_id,
        order_number: parsed.order_number || parsed.order_id,
      };
    }
    return {
      ok: false,
      error:
        parsed?.error ||
        "La función de WooCommerce no devolvió un resultado válido.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err) || "Error al invocar la función.",
    };
  }
}
