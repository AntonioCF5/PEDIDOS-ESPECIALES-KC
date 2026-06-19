/**
 * zohoApi.js — wrappers sobre el SDK embebido de Zoho (ZOHO.CRM.*).
 *
 * Ningún componente debe llamar a ZOHO.CRM.* directamente. Todo pasa por aquí
 * para centralizar la normalización de errores y los nombres de módulos.
 */
/* global ZOHO */
import { MODULES, CONTACT_FIELDS } from "./constants";

/**
 * El SDK de Zoho rechaza promesas con objetos planos ({ code, message }), no
 * instancias de Error. Siempre normalizar antes de mostrar o relanzar.
 */
export function normalizeError(err, fallback = "Ocurrió un error inesperado") {
  if (err instanceof Error) return err;
  let message;
  if (typeof err === "string") {
    message = err;
  } else {
    message =
      err?.message ||
      err?.error ||
      err?.data?.[0]?.message ||
      err?.statusText;
    if (!message) {
      try {
        message = JSON.stringify(err);
      } catch {
        message = "";
      }
    }
  }
  const e = new Error(message || fallback);
  e.originalError = err;
  return e;
}

/** Escapa comillas simples en valores para COQL / criteria. */
function q(value) {
  return String(value == null ? "" : value).replace(/'/g, "\\'");
}

/**
 * Trae todos los registros de un módulo paginando por número de página
 * (máx 200/página).
 */
export async function getAllRecords(entity, { perPage = 200 } = {}) {
  const out = [];
  let page = 1;
  // Salvaguarda para no entrar en bucle infinito.
  for (let guard = 0; guard < 200; guard += 1) {
    const res = await ZOHO.CRM.API.getAllRecords({
      Entity: entity,
      sort_order: "asc",
      per_page: perPage,
      page,
    });
    const data = res?.data || [];
    out.push(...data);
    if (!res?.info?.more_records || data.length === 0) break;
    page += 1;
  }
  return out;
}

/**
 * Ejecuta una consulta COQL paginando por offset.
 * `selectQuery` NO debe incluir la cláusula `limit` — se agrega aquí.
 * Recuerda: COQL usa `limit offset, count` (no LIMIT/OFFSET separados).
 */
export async function coqlPaged(selectQuery) {
  const out = [];
  let offset = 0;
  const count = 200;
  for (let guard = 0; guard < 200; guard += 1) {
    const res = await ZOHO.CRM.API.coql({
      select_query: `${selectQuery} limit ${offset}, ${count}`,
    });
    const data = res?.data || [];
    out.push(...data);
    if (!res?.info?.more_records || data.length === 0) break;
    offset += count;
  }
  return out;
}

/**
 * Busca contactos por nombre, teléfono o email (FR-1).
 * Usa búsqueda por criteria para cubrir varios campos a la vez.
 * Devuelve [] si no hay coincidencias (el SDK lanza error en ese caso).
 */
export async function searchContacts(term) {
  const t = (term || "").trim();
  if (t.length < 2) return [];
  const safe = q(t);
  const query =
    `((${CONTACT_FIELDS.FULL_NAME}:starts_with:${safe})` +
    `or(${CONTACT_FIELDS.LAST_NAME}:starts_with:${safe})` +
    `or(${CONTACT_FIELDS.EMAIL}:starts_with:${safe})` +
    `or(${CONTACT_FIELDS.PHONE}:starts_with:${safe})` +
    `or(${CONTACT_FIELDS.MOBILE}:starts_with:${safe}))`;
  try {
    const res = await ZOHO.CRM.API.searchRecord({
      Entity: MODULES.CONTACTS,
      Type: "criteria",
      Query: query,
    });
    return res?.data || [];
  } catch (err) {
    const e = normalizeError(err);
    // "no record found" no es un error real para una búsqueda.
    if (/no\s*record|no_data|204/i.test(e.message)) return [];
    throw e;
  }
}

/**
 * Crea un contacto nuevo en Zoho CRM (FR-2). El nombre completo se parte en
 * First_Name / Last_Name (Last_Name es obligatorio en Zoho).
 * Devuelve { id, ...campos } del contacto creado.
 */
export async function createContact({ nombre, telefono, email }) {
  const parts = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  let firstName = "";
  let lastName = "";
  if (parts.length === 0) {
    lastName = "Sin nombre";
  } else if (parts.length === 1) {
    lastName = parts[0];
  } else {
    firstName = parts.slice(0, -1).join(" ");
    lastName = parts[parts.length - 1];
  }

  const APIData = { [CONTACT_FIELDS.LAST_NAME]: lastName };
  if (firstName) APIData[CONTACT_FIELDS.FIRST_NAME] = firstName;
  if (email) APIData[CONTACT_FIELDS.EMAIL] = email;
  if (telefono) APIData[CONTACT_FIELDS.PHONE] = telefono;

  let res;
  try {
    res = await ZOHO.CRM.API.insertRecord({
      Entity: MODULES.CONTACTS,
      APIData,
    });
  } catch (err) {
    throw normalizeError(err, "No se pudo crear el contacto");
  }

  const rec = res?.data?.[0];
  if (!rec || (rec.code && rec.code !== "SUCCESS")) {
    throw normalizeError(rec, "No se pudo crear el contacto");
  }
  return {
    id: rec.details?.id,
    [CONTACT_FIELDS.FIRST_NAME]: firstName,
    [CONTACT_FIELDS.LAST_NAME]: lastName,
    [CONTACT_FIELDS.FULL_NAME]: [firstName, lastName].filter(Boolean).join(" "),
    [CONTACT_FIELDS.EMAIL]: email || "",
    [CONTACT_FIELDS.PHONE]: telefono || "",
  };
}

/**
 * Trae todos los Sets del módulo de Sets (FR-5).
 * El módulo de Sets puede no existir todavía (FR-15) — en ese caso devuelve []
 * sin romper el widget: el usuario podrá ingresar medidas manualmente.
 */
export async function getSets() {
  try {
    return await getAllRecords(MODULES.SETS);
  } catch (err) {
    const e = normalizeError(err);
    // Zoho reporta el módulo inexistente con varias frases:
    //   "INVALID_MODULE", "the module name given seems to be invalid",
    //   "No such module", "invalid url Pattern", 404, etc.
    if (
      /invalid[_\s]*module|module.*invalid|not\s*found|no\s*module|no such module|invalid url|404/i.test(
        e.message
      )
    ) {
      return [];
    }
    throw e;
  }
}

/**
 * Ejecuta una Zoho Function standalone con args nombrados.
 *
 * Las keys de `args` se entregan DIRECTO al SDK y el SDK las mapea uno-a-uno
 * a los parámetros de la firma Deluge. Ejemplo:
 *
 *   executeFunction("foo", { order_input: "...", deal_id: "..." })
 *   →  Deluge: standalone.foo(String order_input, String deal_id)
 *
 * NOTA: NO envolver en `{ arguments: args }`. Ese patrón solo aplica cuando
 * la función Deluge tiene un único param literal llamado `arguments`
 * (legacy del widget de Krea Studio). Con args nombrados, el wrapper hace
 * que el SDK ignore las keys reales y la función recibe todo como null.
 */
export async function executeFunction(funcName, args = {}) {
  return ZOHO.CRM.FUNCTIONS.execute(funcName, args);
}

/**
 * Crea un Deal en Zoho CRM con los campos ya formateados según api_names del
 * módulo Deals. Devuelve { id, ...APIData } del Deal creado. Si Zoho rechaza
 * lanza un Error normalizado con el mensaje real (típicamente INVALID_DATA
 * cuando un picklist o api_name no coincide).
 */
export async function createDeal(APIData) {
  // Debug temporal — qué le mandamos al insertRecord y qué nos devuelve.
  // eslint-disable-next-line no-console
  console.log(
    "[Deal] Cuadros_Orden:",
    JSON.stringify(APIData?.Cuadros_Orden)
  );
  let res;
  try {
    res = await ZOHO.CRM.API.insertRecord({
      Entity: MODULES.DEALS,
      APIData,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("[Deal] insertRecord error:", JSON.stringify(err));
    throw normalizeError(err, "No se pudo crear el Deal en Zoho.");
  }

  // eslint-disable-next-line no-console
  console.log("[Deal] insert FULL:", JSON.stringify(res));

  const rec = res?.data?.[0];
  if (!rec || (rec.code && rec.code !== "SUCCESS")) {
    // Zoho devuelve { code: "INVALID_DATA", details: {...}, message: "..." }
    // dentro de data[0] cuando la inserción falla — no como rejection.
    throw normalizeError(rec, "Zoho rechazó la creación del Deal.");
  }
  return { id: rec.details?.id, ...APIData };
}

/**
 * Actualiza un Deal existente. Sigue el mismo patrón que createDeal:
 * data[0].code === "SUCCESS" es OK; cualquier otro código se vuelve Error
 * normalizado.
 */
export async function updateDeal(dealId, APIData) {
  if (!dealId) throw new Error("updateDeal: falta dealId.");
  // El SDK exige el `id` DENTRO del APIData además del RecordID externo.
  // Sin el `id` en el body, Zoho responde MANDATORY_NOT_FOUND con
  // details.api_name = "id".
  const APIDataWithId = { id: String(dealId), ...APIData };
  // Debug temporal — qué APIData estamos mandando al updateRecord.
  // eslint-disable-next-line no-console
  console.log(
    "[Deal] update APIData:",
    JSON.stringify({ RecordID: String(dealId), APIData: APIDataWithId })
  );
  let res;
  try {
    res = await ZOHO.CRM.API.updateRecord({
      Entity: MODULES.DEALS,
      RecordID: String(dealId),
      APIData: APIDataWithId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("[Deal] update SDK error FULL:", JSON.stringify(err));
    throw normalizeError(err, "No se pudo actualizar el Deal en Zoho.");
  }

  // eslint-disable-next-line no-console
  console.log("[Deal] update FULL:", JSON.stringify(res));

  const rec = res?.data?.[0];
  if (!rec || (rec.code && rec.code !== "SUCCESS")) {
    throw normalizeError(rec, "Zoho rechazó la actualización del Deal.");
  }
  return { id: dealId, ...APIData };
}
