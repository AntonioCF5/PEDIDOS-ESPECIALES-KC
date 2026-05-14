/**
 * totals.js — cálculos puros de totales y desglose del cobro.
 */
import { METODO_PAGO_BREAKDOWN } from "./constants";
import { toNumber, round2 } from "./formatters";
import { rowSubtotal } from "./woocommerce";

/** Suma de subtotales de todas las líneas del pedido. */
export function calcSubtotal(rows) {
  return round2(
    (rows || []).reduce((acc, r) => acc + rowSubtotal(r), 0)
  );
}

/** Gran Total = subtotal − descuento (nunca negativo). */
export function calcGranTotal(rows, descuento) {
  const d = toNumber(descuento) || 0;
  return round2(Math.max(0, calcSubtotal(rows) - d));
}

/**
 * Devuelve los campos del desglose para un método, marcando con `autoCalc`
 * el último campo de monto cuando hay 2+ montos (se calcula en vivo como
 * Gran Total − suma(otros montos)).
 */
export function breakdownFieldsFor(metodo) {
  const fields = METODO_PAGO_BREAKDOWN[metodo] || [];
  const amounts = fields.filter((f) => f.type === "amount");
  const lastAmount = amounts[amounts.length - 1];
  return fields.map((f) => ({
    ...f,
    autoCalc: f.type === "amount" && amounts.length > 1 && f === lastAmount,
  }));
}

/** Suma de todos los campos de monto del desglose. */
export function sumBreakdownAmount(breakdown, metodo) {
  const fields = METODO_PAGO_BREAKDOWN[metodo] || [];
  return round2(
    fields
      .filter((f) => f.type === "amount")
      .reduce((acc, f) => acc + (toNumber(breakdown?.[f.key]) || 0), 0)
  );
}

/** Valor del campo auto-calculado: Gran Total − suma(otros montos). */
export function autoCalcValue(breakdown, metodo, granTotal) {
  const fields = breakdownFieldsFor(metodo);
  const sumOthers = fields
    .filter((f) => f.type === "amount" && !f.autoCalc)
    .reduce((acc, f) => acc + (toNumber(breakdown?.[f.key]) || 0), 0);
  return round2(Math.max(0, (toNumber(granTotal) || 0) - sumOthers));
}

/**
 * Valida el desglose del cobro.
 *   - `blocking`: campos obligatorios vacíos (detiene el guardado).
 *   - `warning`: la suma de montos no cuadra con el Gran Total (no bloquea).
 */
export function validateBreakdown(breakdown, metodo, granTotal) {
  const fields = METODO_PAGO_BREAKDOWN[metodo] || [];
  const blocking = [];
  for (const f of fields) {
    if (f.required && !String(breakdown?.[f.key] ?? "").trim()) {
      blocking.push(f.label);
    }
  }
  let warning = null;
  if (fields.some((f) => f.type === "amount")) {
    const sum = sumBreakdownAmount(breakdown, metodo);
    const gt = toNumber(granTotal) || 0;
    if (Math.abs(sum - gt) > 0.5) {
      warning =
        `La suma del desglose del cobro (${sum.toFixed(2)}) no coincide ` +
        `con el Gran Total (${gt.toFixed(2)}).`;
    }
  }
  return { blocking, warning };
}
