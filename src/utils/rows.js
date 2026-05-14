/**
 * rows.js — helpers para las líneas (rows) del pedido.
 *
 * Cada row es una línea del pedido especial: un producto de catálogo o un
 * cuadro personalizado. El estado del pedido es una lista de rows en
 * `OrderForm`; cada row se serializa al construir el `orderInput` de
 * WooCommerce (no a un subform de Zoho).
 */
import { ROW_TYPES, TIPO_MEDIDA } from "./constants";

/** Genera un id local único para una row. */
export function rowId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `row_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Crea una row vacía del tipo indicado. */
export function makeRow(tipo) {
  return {
    id: rowId(),
    tipo,
    // catálogo
    producto: null,
    // personalizado
    set: null,
    material: null,
    base: "",
    altura: "",
    tipoMedida: TIPO_MEDIDA.CM,
    // común
    cantidad: 1,
    precioUnitario: "",
    notas: "",
  };
}

/** True si la row tiene la información mínima para ir al pedido. */
export function isRowComplete(row) {
  const cant = Number(row.cantidad);
  const precio = Number(row.precioUnitario);
  if (!Number.isFinite(cant) || cant <= 0) return false;
  if (!Number.isFinite(precio) || precio <= 0) return false;

  if (row.tipo === ROW_TYPES.CATALOGO) {
    return !!row.producto?.id;
  }
  // personalizado: material + base + altura
  if (!row.material?.id) return false;
  const base = Number(row.base);
  const altura = Number(row.altura);
  return Number.isFinite(base) && base > 0 && Number.isFinite(altura) && altura > 0;
}
