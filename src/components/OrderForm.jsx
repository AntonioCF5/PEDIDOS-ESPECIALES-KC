import { useState, useRef } from "react";
import {
  SHIPPING_FIELDS,
  ROW_TYPES,
  TIPO_PEDIDO_OPTIONS,
  TIPO_PEDIDO_VALUES,
  TIENDA_OPTIONS,
  TIENDA_ABBREV,
  DEAL_FIELDS,
  STAGE_VALUES,
} from "../utils/constants";
import { formatCurrency, toNumber, zohoDateTime } from "../utils/formatters";
import { isRowComplete, serializeCuadroRow } from "../utils/rows";
import {
  calcGranTotal,
  calcSubtotal,
  breakdownFieldsFor,
  autoCalcValue,
  validateBreakdown,
} from "../utils/totals";
import { buildWooOrderPayload, createWooOrder } from "../utils/woocommerce";
import { createDeal, updateDeal } from "../utils/zohoApi";
import useProducts from "../hooks/useProducts";
import useMateriales from "../hooks/useMateriales";
import useSets from "../hooks/useSets";
import ContactSearchPanel from "./ContactSearchPanel";
import CuadrosList from "./CuadrosList";
import CuadrosSummary from "./CuadrosSummary";
import ShippingFields from "./ShippingFields";
import TotalsCard from "./TotalsCard";

/**
 * Devuelve el mensaje + dump JSON del error original de Zoho (donde viven
 * details.api_name, details.expected_data_type, etc.) para mostrarlo en el
 * banner rojo del widget. Si no hay originalError, devuelve solo el message.
 */
function formatZohoErrorForUI(err) {
  if (!err) return "Error desconocido";
  const msg = err.message || String(err);
  const original = err.originalError;
  if (original == null) return msg;
  let originalJson;
  try {
    originalJson = JSON.stringify(original, null, 2);
  } catch {
    originalJson = String(original);
  }
  return `${msg}\n\nRespuesta completa de Zoho:\n${originalJson}`;
}

/** Estado inicial de la dirección: todas las claves de SHIPPING_FIELDS vacías. */
function emptyShipping() {
  return SHIPPING_FIELDS.reduce((acc, f) => {
    acc[f.key] = "";
    return acc;
  }, {});
}

/** Calcula los errores de captura de una línea del pedido. */
function validateRow(row) {
  const errors = {};
  if (row.tipo === ROW_TYPES.CATALOGO) {
    if (!row.producto?.id) errors.producto = true;
  } else {
    if (!row.material?.id) errors.material = true;
    if (!(Number(row.base) > 0)) errors.base = true;
    if (!(Number(row.altura) > 0)) errors.altura = true;
  }
  if (!(Number(row.cantidad) > 0)) errors.cantidad = true;
  if (!(Number(row.precioUnitario) > 0)) errors.precioUnitario = true;
  return errors;
}

/**
 * Orquestador del widget de Pedidos Especiales (reemplaza a DealDetail del
 * widget de Krea Studio). Todo el estado vive aquí; los hijos son
 * presentacionales.
 *
 * NFR-1: este componente NO crea ni modifica Deals de Zoho. El "guardado"
 * final solo crea la orden en WooCommerce de Krea Canvas.
 */
export default function OrderForm({ onCompleted }) {
  const { products, loading: loadingProducts, error: errProducts } = useProducts();
  const { materiales, loading: loadingMats, error: errMats } = useMateriales();
  const { sets, error: errSets } = useSets();

  const [tienda, setTienda] = useState("");
  const [tipoPedido, setTipoPedido] = useState("");
  const [motivoReposicion, setMotivoReposicion] = useState("");
  const [ordenAReponer, setOrdenAReponer] = useState("");
  const [contacto, setContacto] = useState(null);
  const [rows, setRows] = useState([]);
  const [shipping, setShipping] = useState(emptyShipping);
  const [descuento, setDescuento] = useState(null);
  const [metodoPago, setMetodoPago] = useState("");
  const [breakdown, setBreakdown] = useState({});

  const [tiendaError, setTiendaError] = useState(false);
  const [tipoPedidoError, setTipoPedidoError] = useState(false);
  const [motivoReposicionError, setMotivoReposicionError] = useState(false);
  const [ordenAReponerError, setOrdenAReponerError] = useState(false);
  const [contactError, setContactError] = useState(false);
  const [rowsError, setRowsError] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [shippingErrors, setShippingErrors] = useState({});
  const [metodoError, setMetodoError] = useState(false);
  const [breakdownErrors, setBreakdownErrors] = useState({});

  const [highlightId, setHighlightId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  /**
   * Estado de reanudación tras un fallo parcial. Cuando un paso del
   * handleCreateOrder se completa exitosamente y un paso posterior falla,
   * guardamos lo que ya se hizo para que el siguiente clic no lo repita
   * (evita crear Deal o orden WC duplicados).
   *
   *   null              → no hay intento en curso, primer envío normal.
   *   { dealId, wcResult: null }
   *                     → Deal ya creado; falta crear WC y renombrar.
   *   { dealId, wcResult: {ok, order_id, order_number} }
   *                     → Deal y orden WC ya creados; solo falta renombrar.
   */
  const [resumeState, setResumeState] = useState(null);

  const rowRefs = useRef({});

  const granTotal = calcGranTotal(rows, descuento);

  function handleShippingChange(key, value) {
    setShipping((s) => ({ ...s, [key]: value }));
  }

  function handleFocusRow(id) {
    setHighlightId(id);
    const el = rowRefs.current[id];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /** Materializa el desglose incluyendo el monto auto-calculado. */
  function materializeBreakdown() {
    const fields = breakdownFieldsFor(metodoPago);
    const out = { ...breakdown };
    for (const f of fields) {
      if (f.autoCalc) {
        out[f.key] = autoCalcValue(breakdown, metodoPago, granTotal);
      }
    }
    return out;
  }

  function validate() {
    let ok = true;

    // Tienda (paso 1).
    if (!tienda) {
      setTiendaError(true);
      ok = false;
    } else {
      setTiendaError(false);
    }

    // Tipo de pedido (paso 1).
    if (!tipoPedido) {
      setTipoPedidoError(true);
      ok = false;
    } else {
      setTipoPedidoError(false);
    }

    // Motivo de reposición — requerido solo si tipo === Reposición.
    if (
      tipoPedido === TIPO_PEDIDO_VALUES.REPOSICION &&
      !motivoReposicion.trim()
    ) {
      setMotivoReposicionError(true);
      ok = false;
    } else {
      setMotivoReposicionError(false);
    }

    // Orden a reponer — requerido solo si tipo === Reposición.
    if (
      tipoPedido === TIPO_PEDIDO_VALUES.REPOSICION &&
      !ordenAReponer.trim()
    ) {
      setOrdenAReponerError(true);
      ok = false;
    } else {
      setOrdenAReponerError(false);
    }

    // Contacto (FR-1 / FR-2).
    if (!contacto?.id) {
      setContactError(true);
      ok = false;
    } else {
      setContactError(false);
    }

    // Al menos una línea, y todas completas.
    if (rows.length === 0) {
      setRowsError("Agrega al menos un producto al pedido.");
      ok = false;
    } else {
      setRowsError(null);
    }
    const re = {};
    for (const row of rows) {
      const errs = validateRow(row);
      if (Object.keys(errs).length > 0) {
        re[row.id] = errs;
        ok = false;
      }
    }
    setRowErrors(re);

    // Dirección de entrega (FR-7).
    const se = {};
    for (const f of SHIPPING_FIELDS) {
      if (f.required && !String(shipping[f.key] || "").trim()) {
        se[f.key] = true;
        ok = false;
      }
    }
    setShippingErrors(se);

    // Método de pago (FR-8).
    if (!metodoPago) {
      setMetodoError(true);
      ok = false;
    } else {
      setMetodoError(false);
    }

    // Desglose del cobro: campos obligatorios.
    const { blocking } = validateBreakdown(breakdown, metodoPago, granTotal);
    const be = {};
    if (blocking.length > 0) {
      for (const f of breakdownFieldsFor(metodoPago)) {
        if (f.required && !String(breakdown[f.key] || "").trim()) {
          be[f.key] = true;
        }
      }
      ok = false;
    }
    setBreakdownErrors(be);

    return ok;
  }

  /** Nombre legible del contacto seleccionado (con fallbacks). */
  function contactDisplayName() {
    return (
      contacto?.fullName ||
      [contacto?.firstName, contacto?.lastName].filter(Boolean).join(" ") ||
      contacto?.lastName ||
      "Sin nombre"
    );
  }

  /**
   * Payload del Deal al CREARLO. Incluye:
   *   - Deal_Name = nombre del contacto (después de WC ok, se renombra a
   *     "{KC|KS}-{order_number}-{cliente}" — ver handleCreateOrder).
   *   - Stage = "En Produccion"
   *   - Contact_Name = lookup al contacto
   *   - Tienda = "Krea Canvas" | "Krea Studio"
   *   - Motivo_de_reposicion = solo si tipo === Reposición
   *   - Total_Guias = null / Ciudad_Sesi_n = null (los completa otro proceso)
   *   - Pago y totales como NÚMEROS planos (Zoho los rechaza si llegan con "$" o ",")
   *   - Metodo_de_pago = texto visible (ej. "Tarjeta de débito")
   *   - Fecha_y_Hora = momento actual en ISO 8601 con offset MX (zohoDateTime)
   *   - Dirección de envío = espejo de billing/shipping de WC
   */
  function buildDealPayload() {
    const isReposicion = tipoPedido === TIPO_PEDIDO_VALUES.REPOSICION;
    const motivo = isReposicion ? motivoReposicion.trim() : "";
    const ordenRep = isReposicion ? ordenAReponer.trim() : "";
    const subtotal = calcSubtotal(rows);
    const desc = toNumber(descuento) || 0;
    return {
      [DEAL_FIELDS.DEAL_NAME]: contactDisplayName(),
      [DEAL_FIELDS.CONTACT_NAME]: contacto?.id ? { id: contacto.id } : null,
      [DEAL_FIELDS.STAGE]: STAGE_VALUES.INICIAL,
      [DEAL_FIELDS.TIENDA]: tienda,
      // Picklist — "Reposición" / "Muestra" / "Pedido Especial" exactos.
      [DEAL_FIELDS.TIPO_PEDIDO]: tipoPedido || "",
      [DEAL_FIELDS.MOTIVO_REPOSICION]: motivo,
      [DEAL_FIELDS.ORDEN_A_REPONER]: ordenRep,
      [DEAL_FIELDS.TOTAL_GUIAS]: null,
      [DEAL_FIELDS.CIUDAD_SESION]: null,
      // Pago y totales — números planos, NO strings con formato.
      [DEAL_FIELDS.TOTAL_CUADRO]: subtotal,
      [DEAL_FIELDS.DESCUENTO]: desc,
      [DEAL_FIELDS.GRAN_TOTAL]: granTotal,
      [DEAL_FIELDS.METODO_PAGO]: metodoPago || "",
      [DEAL_FIELDS.FECHA_Y_HORA]: zohoDateTime(),
      // Dirección de envío.
      [DEAL_FIELDS.CALLE_Y_NUMERO]: shipping?.CALLE_Y_NUMERO || "",
      [DEAL_FIELDS.COLONIA]: shipping?.COLONIA || "",
      [DEAL_FIELDS.CIUDAD]: shipping?.CIUDAD || "",
      [DEAL_FIELDS.CODIGO_POSTAL]: shipping?.CODIGO_POSTAL || "",
      [DEAL_FIELDS.ESTADO]: shipping?.ESTADO || "",
      [DEAL_FIELDS.NOTAS_ENTREGA]: shipping?.NOTAS_ENTREGA || "",
      // Subform — un renglón por cada cuadro del pedido.
      [DEAL_FIELDS.CUADROS_ORDEN]: (rows || []).map(serializeCuadroRow),
    };
  }

  /**
   * Descarta el intento parcial. Se llama desde el botón "Cancelar intento".
   * El Deal (y la orden WC si existe) ya están en CRM/WC y quedan huérfanos:
   * el operador debe limpiarlos manual. Solo limpiamos el estado local.
   */
  function handleCancelRetry() {
    if (!resumeState) return;
    const wc = resumeState.wcResult
      ? `y la orden WC #${resumeState.wcResult.order_number} `
      : "";
    const msg =
      `Si cancelas, el Deal ${resumeState.dealId} ${wc}quedan en CRM/WC ` +
      `sin completar y tendrás que limpiarlos manualmente. Después de cancelar, ` +
      `el siguiente clic en "Crear pedido" creará un Deal nuevo desde cero. ` +
      `¿Continuar?`;
    if (window.confirm(msg)) {
      setResumeState(null);
      setSubmitError(null);
    }
  }

  async function handleCreateOrder() {
    setSubmitError(null);

    // En modo reanudación los datos del Deal ya fueron persistidos —
    // saltamos validación y la advertencia del desglose. El operador no
    // puede modificar lo que ya está en el Deal; si necesita cambiar algo,
    // debe cancelar el intento y empezar de nuevo.
    if (!resumeState) {
      if (!validate()) {
        setSubmitError(
          new Error("Revisa los campos marcados antes de crear el pedido.")
        );
        return;
      }
      const { warning } = validateBreakdown(breakdown, metodoPago, granTotal);
      if (warning && !window.confirm(`${warning}\n\n¿Crear el pedido de todas formas?`)) {
        return;
      }
    }

    setSubmitting(true);
    // Arrancamos con lo que ya esté hecho del intento anterior (o null).
    let dealId = resumeState?.dealId || null;
    let wcResult = resumeState?.wcResult || null;

    try {
      // 1) Crear el Deal en Zoho — SOLO si no existía de un intento previo.
      if (!dealId) {
        const deal = await createDeal(buildDealPayload());
        dealId = deal.id;
      }

      // 2) Crear la orden WC — SOLO si no se había completado.
      if (!wcResult) {
        const orderInput = buildWooOrderPayload({
          tipoPedido,
          ordenAReponer,
          tienda,
          contacto,
          direccion: shipping,
          rows,
          totals: { descuento, granTotal },
          metodoPago,
          breakdown: materializeBreakdown(),
          dealId,
        });
        const result = await createWooOrder(orderInput, dealId);
        if (!result.ok) {
          // Deal sí creado; WC falló. Guardamos resume state para que el
          // siguiente clic NO cree otro Deal y arranque desde WC.
          setResumeState({ dealId, wcResult: null });
          setSubmitError(
            new Error(
              `Deal ${dealId} creado, pero la función WooCommerce falló: ` +
                (result.error || "error desconocido.") +
                `\n\nAl reintentar, el widget reusará este Deal sin crear uno nuevo.`
            )
          );
          return;
        }
        wcResult = result;
      }

      // 2.5) Fallback: la Deluge reporta deal_updated=false cuando creó la
      //      orden WC pero su updateRecord interno NO logró escribir
      //      Numero_de_orden / Woocommerce_Order_ID. Lo intentamos desde
      //      el widget — si esto también falla, lo tratamos como fallo
      //      parcial (resumeState) para que el operador se entere y reintente.
      if (wcResult.deal_updated === false) {
        try {
          await updateDeal(dealId, {
            [DEAL_FIELDS.NUMERO_ORDEN]: String(wcResult.order_number || ""),
            [DEAL_FIELDS.WOOCOMMERCE_ORDER_ID]: String(wcResult.order_id || ""),
          });
          // Marca el wcResult local como ya guardado, así si el rename falla
          // después no volvemos a intentar este paso al reanudar.
          wcResult = { ...wcResult, deal_updated: true };
        } catch (backupErr) {
          // Persistimos el wcResult CON deal_updated:false para que al
          // reintentar saltemos createDeal y createWooOrder pero retomemos
          // este fallback.
          setResumeState({ dealId, wcResult });
          const delugeMsg = wcResult.deal_update_error
            ? `\n\nLa Zoho Function reportó originalmente: ${wcResult.deal_update_error}`
            : "";
          setSubmitError(
            new Error(
              `Pedido WC #${wcResult.order_number} creado y Deal ${dealId} creado, ` +
                `pero falló al guardar el número de orden en el Deal:\n\n` +
                formatZohoErrorForUI(backupErr) +
                delugeMsg +
                `\n\nAl reintentar, el widget reusará el Deal y la orden WC; ` +
                `solo se reintenta guardar Numero_de_orden / Woocommerce_Order_ID.`
            )
          );
          return;
        }
      }

      // 3) Renombrar el Deal con "{KC|KS}-{order_number}-{cliente}".
      let renameFailed = null;
      try {
        const prefix = TIENDA_ABBREV[tienda] || "KC";
        const newDealName = `${prefix}-${wcResult.order_number}-${contactDisplayName()}`;
        await updateDeal(dealId, { [DEAL_FIELDS.DEAL_NAME]: newDealName });
      } catch (renameErr) {
        renameFailed = renameErr;
      }

      if (renameFailed) {
        // Deal + WC ya están. Guardamos resume state para que el siguiente
        // clic NO cree otro Deal NI otra orden WC — solo reintente el rename.
        setResumeState({ dealId, wcResult });
        setSubmitError(
          new Error(
            `Pedido WC #${wcResult.order_number} creado y Deal ${dealId} creado, ` +
              `pero falló al renombrar el Deal:\n\n` +
              formatZohoErrorForUI(renameFailed) +
              `\n\nAl reintentar, el widget reusará el Deal y la orden WC; ` +
              `solo se reintenta el renombrado.`
          )
        );
        return;
      }

      // Todo OK — limpiamos resume state y vamos a la pantalla de éxito.
      setResumeState(null);
      onCompleted({ ...wcResult, deal_id: dealId });
    } catch (err) {
      // Falló el insert del Deal o excepción inesperada. Si dealId YA existía
      // (resumeState previo), lo conservamos para no perderlo.
      if (dealId && !resumeState) {
        setResumeState({ dealId, wcResult });
      }
      const where = dealId
        ? `después de crear Deal ${dealId}`
        : "al crear el Deal en Zoho";
      setSubmitError(
        new Error(`Error ${where}:\n\n${formatZohoErrorForUI(err)}`)
      );
    } finally {
      setSubmitting(false);
    }
  }

  const loading = loadingProducts || loadingMats;
  const loadError = errProducts || errMats;
  const completeRows = rows.filter(isRowComplete).length;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Pedidos Especiales — Krea Canvas</h1>
        <span className="topbar-total">
          Gran Total: <strong>{formatCurrency(granTotal)}</strong>
        </span>
      </header>

      <main className="content">
        {loadError && (
          <div className="banner banner-error">
            Error al cargar catálogos: {loadError.message}
          </div>
        )}
        {errSets && (
          <div className="banner banner-warn">
            No se pudieron cargar los Sets ({errSets.message}). Puedes capturar
            medidas manualmente.
          </div>
        )}
        {loading && <div className="banner">Cargando catálogos…</div>}

        <section className="card">
          <h2>1. Datos del pedido</h2>

          <div className="datos-pedido-tienda">
            <h3 className="subhead">Tienda</h3>
            <div className="tienda-picker">
              {TIENDA_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={
                    tienda === opt ? "tienda-btn active" : "tienda-btn"
                  }
                  onClick={() => setTienda(opt)}
                  aria-pressed={tienda === opt}
                >
                  <span className="tienda-abbrev">{TIENDA_ABBREV[opt]}</span>
                  <span className="tienda-name">{opt}</span>
                </button>
              ))}
            </div>
            {tiendaError && (
              <p className="field-error">Selecciona la tienda.</p>
            )}
          </div>

          <div className="datos-pedido-grid">
            <div className="datos-pedido-col datos-pedido-col-tipo">
              <h3 className="subhead">Tipo de pedido</h3>
              <div className="tipo-pedido-picker">
                {TIPO_PEDIDO_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={
                      tipoPedido === opt
                        ? "tipo-pedido-btn active"
                        : "tipo-pedido-btn"
                    }
                    onClick={() => setTipoPedido(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {tipoPedidoError && (
                <p className="field-error">Selecciona el tipo de pedido.</p>
              )}

              {tipoPedido === TIPO_PEDIDO_VALUES.REPOSICION && (
                <div className="motivo-reposicion">
                  <label className="field">
                    <span className="field-label">
                      Motivo de reposición<span className="req">*</span>
                    </span>
                    <textarea
                      rows={3}
                      placeholder="¿Por qué se está reponiendo? (ej. cuadro defectuoso, pieza perdida en envío...)"
                      className={motivoReposicionError ? "has-error" : ""}
                      value={motivoReposicion}
                      onChange={(e) => setMotivoReposicion(e.target.value)}
                    />
                  </label>
                  {motivoReposicionError && (
                    <p className="field-error">
                      Indica el motivo de la reposición.
                    </p>
                  )}

                  <label className="field" style={{ marginTop: 10 }}>
                    <span className="field-label">
                      Orden a reponer<span className="req">*</span>
                    </span>
                    <input
                      type="text"
                      placeholder="Número de la orden original que se está reponiendo (ej. 132580)"
                      className={ordenAReponerError ? "has-error" : ""}
                      value={ordenAReponer}
                      onChange={(e) => setOrdenAReponer(e.target.value)}
                    />
                  </label>
                  {ordenAReponerError && (
                    <p className="field-error">
                      Indica el número de la orden original que se está reponiendo.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="datos-pedido-col datos-pedido-col-contacto">
              <h3 className="subhead">Contacto</h3>
              <ContactSearchPanel contacto={contacto} onChange={setContacto} />
              {contactError && (
                <p className="field-error">Selecciona o crea un contacto.</p>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <h2>2. Productos del pedido</h2>
          <CuadrosList
            rows={rows}
            onRowsChange={setRows}
            products={products}
            materiales={materiales}
            sets={sets}
            rowErrors={rowErrors}
            highlightId={highlightId}
            rowRefs={rowRefs}
          />
          {rowsError && <p className="field-error">{rowsError}</p>}
          <h3 className="subhead">
            Resumen del pedido
            {rows.length > 0 && (
              <span className="subhead-meta">
                {completeRows}/{rows.length} líneas completas
              </span>
            )}
          </h3>
          <CuadrosSummary rows={rows} onFocusRow={handleFocusRow} />
        </section>

        <section className="card">
          <h2>3. Dirección de entrega</h2>
          <ShippingFields
            values={shipping}
            errors={shippingErrors}
            onChange={handleShippingChange}
          />
        </section>

        <section className="card">
          <h2>4. Pago</h2>
          <TotalsCard
            rows={rows}
            descuento={descuento}
            onDescuentoChange={setDescuento}
            metodoPago={metodoPago}
            onMetodoPagoChange={setMetodoPago}
            breakdown={breakdown}
            onBreakdownChange={setBreakdown}
            breakdownErrors={breakdownErrors}
          />
          {metodoError && (
            <p className="field-error">Selecciona un método de pago.</p>
          )}
        </section>

        {resumeState && (
          <div className="banner banner-warn">
            Intento anterior pausado.{" "}
            <strong>Deal {resumeState.dealId}</strong>
            {resumeState.wcResult
              ? <> y orden WC <strong>#{resumeState.wcResult.order_number}</strong> ya creados.</>
              : " ya creado, falta la orden WC."}
            {" "}Al hacer clic en "Reintentar", el widget continúa desde donde
            falló <strong>sin duplicar el Deal</strong>.
            {" "}
            <button
              type="button"
              className="btn-link"
              onClick={handleCancelRetry}
            >
              Cancelar intento (deja registros huérfanos)
            </button>
          </div>
        )}

        {submitError && (
          <div className="banner banner-error">{submitError.message}</div>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn-primary btn-lg"
            disabled={submitting}
            onClick={handleCreateOrder}
          >
            {submitting
              ? "Procesando…"
              : resumeState
              ? resumeState.wcResult
                ? resumeState.wcResult.deal_updated === false
                  ? `Reintentar guardar Nº orden en Deal ${resumeState.dealId.slice(-6)}`
                  : `Reintentar renombrar Deal ${resumeState.dealId.slice(-6)}`
                : `Reintentar crear orden WC (Deal ${resumeState.dealId.slice(-6)})`
              : "Crear pedido en WooCommerce KC"}
          </button>
        </div>
      </main>
    </div>
  );
}
