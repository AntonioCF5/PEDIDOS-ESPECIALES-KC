/**
 * Lookup case-insensitive sobre objetos de Zoho.
 *
 * Zoho a veces devuelve api_names con distinta capitalización según el
 * endpoint (getRecord vs getAllRecords vs searchRecord). `getCI` busca la
 * clave sin importar mayúsculas/minúsculas.
 */
export function getCI(obj, key) {
  if (!obj || key == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  const lower = String(key).toLowerCase();
  const found = Object.keys(obj).find((k) => k.toLowerCase() === lower);
  return found ? obj[found] : undefined;
}
