/**
 * formatters.js — helpers de moneda, números y fechas.
 * Módulo puro (sin React), copiable y testeable.
 */

/** Convierte cualquier valor a número, o null si no es parseable. */
export function toNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  // Sanitiza separadores de miles y normaliza coma decimal a punto.
  let s = String(value).trim().replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(/,/g, ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const NUM = new Intl.NumberFormat("es-MX");

/** Formatea un valor como moneda MXN. Devuelve "—" si no es número. */
export function formatCurrency(value) {
  const n = toNumber(value);
  return n == null ? "—" : MXN.format(n);
}

/** Formatea un número con separadores es-MX. Devuelve "" si no es número. */
export function formatNumber(value) {
  const n = toNumber(value);
  return n == null ? "" : NUM.format(n);
}

/** Redondea a 2 decimales devolviendo un number. */
export function round2(value) {
  const n = toNumber(value);
  if (n == null) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Fecha/hora en el formato que acepta Zoho: YYYY-MM-DDTHH:mm:ss±HH:MM.
 * NUNCA usar Date#toISOString() (sufijo Z) — Zoho lo rechaza con INVALID_DATA.
 */
export function zohoDateTime(date = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Valida un email con una regex razonable (no exhaustiva). */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}
