import { useState, useRef } from "react";
import { SHIPPING_FIELDS, ROW_TYPES } from "../utils/constants";
import { formatCurrency } from "../utils/formatters";
import { isRowComplete } from "../utils/rows";
import {
  calcGranTotal,
  breakdownFieldsFor,
  autoCalcValue,
  validateBreakdown,
} from "../utils/totals";
import { buildWooOrderPayload, createWooOrder } from "../utils/woocommerce";
import useProducts from "../hooks/useProducts";
import useMateriales from "../hooks/useMateriales";
import useSets from "../hooks/useSets";
import ContactSearchPanel from "./ContactSearchPanel";
import CuadrosList from "./CuadrosList";
import CuadrosSummary from "./CuadrosSummary";
import ShippingFields from "./ShippingFields";
import TotalsCard from "./TotalsCard";

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

  const [contacto, setContacto] = useState(null);
  const [rows, setRows] = useState([]);
  const [shipping, setShipping] = useState(emptyShipping);
  const [descuento, setDescuento] = useState(null);
  const [metodoPago, setMetodoPago] = useState("");
  const [breakdown, setBreakdown] = useState({});

  const [contactError, setContactError] = useState(false);
  const [rowsError, setRowsError] = useState(null);
  const [rowErrors, setRowErrors] = useState({});
  const [shippingErrors, setShippingErrors] = useState({});
  const [metodoError, setMetodoError] = useState(false);
  const [breakdownErrors, setBreakdownErrors] = useState({});

  const [highlightId, setHighlightId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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

  async function handleCreateOrder() {
    setSubmitError(null);
    if (!validate()) {
      setSubmitError(
        new Error("Revisa los campos marcados antes de crear el pedido.")
      );
      return;
    }

    // La suma del desglose no cuadra → advertencia no bloqueante.
    const { warning } = validateBreakdown(breakdown, metodoPago, granTotal);
    if (warning && !window.confirm(`${warning}\n\n¿Crear el pedido de todas formas?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const orderInput = buildWooOrderPayload({
        contacto,
        direccion: shipping,
        rows,
        totals: { descuento, granTotal },
        metodoPago,
        breakdown: materializeBreakdown(),
      });
      const result = await createWooOrder(orderInput);
      if (result.ok) {
        onCompleted(result);
      } else {
        setSubmitError(
          new Error(result.error || "No se pudo crear el pedido en WooCommerce.")
        );
      }
    } catch (err) {
      setSubmitError(
        new Error(err?.message || "Error inesperado al crear el pedido.")
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
          <h2>1. Contacto</h2>
          <ContactSearchPanel contacto={contacto} onChange={setContacto} />
          {contactError && (
            <p className="field-error">Selecciona o crea un contacto.</p>
          )}
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
              ? "Creando pedido…"
              : "Crear pedido en WooCommerce KC"}
          </button>
        </div>
      </main>
    </div>
  );
}
