/**
 * rows.js — helpers para las líneas (rows) del pedido.
 *
 * Cada row es una línea del pedido especial: un producto de catálogo o un
 * cuadro personalizado. El estado del pedido es una lista de rows en
 * `OrderForm`; cada row se serializa al construir el `orderInput` de
 * WooCommerce (no a un subform de Zoho).
 */
import { ROW_TYPES, TIPO_MEDIDA, SUBFORM_FIELDS } from "./constants";
import { toNumber } from "./formatters";

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

/**
 * Serializa una row al formato del subform `Cuadros_Orden` del Deal.
 *
 *   Es_Personalizado: true|false
 *   Product:          {id} si la fila viene del catálogo (lookup Products);
 *                     null si es personalizada (no existe en Zoho Products).
 *   Material:         {id} cuando hay material asociado, null si no.
 *   Base_cm/Altura_cm: número plano (cm). Para catálogo se toman del producto;
 *                     para personalizado de los inputs del row.
 *   Notas:            texto del campo Notas de la fila.
 *
 * Nota: NO se incluye `id` de fila de subform — Zoho borra y recrea las
 * filas en cada update, así que mandar id local rompe con
 * "the subform id given seems to be invalid".
 */
export function serializeCuadroRow(row) {
  const isCustom = row.tipo === ROW_TYPES.PERSONALIZADO;
  const baseSrc = isCustom ? row.base : row.producto?.base;
  const alturaSrc = isCustom ? row.altura : row.producto?.altura;
  const material = isCustom ? row.material : row.producto?.material;

  return {
    [SUBFORM_FIELDS.ES_PERSONALIZADO]: isCustom,
    [SUBFORM_FIELDS.PRODUCT]:
      !isCustom && row.producto?.id ? { id: row.producto.id } : null,
    [SUBFORM_FIELDS.MATERIAL]: material?.id ? { id: material.id } : null,
    [SUBFORM_FIELDS.BASE_CM]: toNumber(baseSrc) || 0,
    [SUBFORM_FIELDS.ALTURA_CM]: toNumber(alturaSrc) || 0,
    [SUBFORM_FIELDS.CANTIDAD]: toNumber(row.cantidad) || 0,
    [SUBFORM_FIELDS.PRECIO_UNITARIO]: toNumber(row.precioUnitario) || 0,
    [SUBFORM_FIELDS.NOTAS]: String(row.notas || ""),
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
