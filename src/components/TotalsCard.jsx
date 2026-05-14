import { formatCurrency } from "../utils/formatters";
import CurrencyInput from "./CurrencyInput";
import useMetodosPago from "../hooks/useMetodosPago";
import {
  calcSubtotal,
  calcGranTotal,
  breakdownFieldsFor,
  autoCalcValue,
} from "../utils/totals";

/**
 * Totales + método de pago + desglso del cobro (FR-8).
 *
 * Versión simplificada respecto al widget de Krea Studio: no hay "Total
 * Sesión" ni "Anticipo" provenientes de un Deal. El Gran Total es la suma de
 * los productos/cuadros menos el descuento.
 */
export default function TotalsCard({
  rows,
  descuento,
  onDescuentoChange,
  metodoPago,
  onMetodoPagoChange,
  breakdown,
  onBreakdownChange,
  breakdownErrors = {},
}) {
  const { metodos } = useMetodosPago();
  const subtotal = calcSubtotal(rows);
  const granTotal = calcGranTotal(rows, descuento);
  const fields = breakdownFieldsFor(metodoPago);

  function setBreakdownValue(key, value) {
    onBreakdownChange({ ...breakdown, [key]: value });
  }

  return (
    <div className="totals">
      <div className="totals-grid">
        <div className="totals-line">
          <span>Total productos</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="totals-line">
          <span>Descuento</span>
          <CurrencyInput
            value={descuento}
            onChange={onDescuentoChange}
            placeholder="0.00"
          />
        </div>
        <div className="totals-line totals-grand">
          <span>Gran Total</span>
          <span>{formatCurrency(granTotal)}</span>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Método de pago</span>
        <select
          value={metodoPago || ""}
          onChange={(e) => onMetodoPagoChange(e.target.value)}
        >
          <option value="">— Selecciona —</option>
          {metodos.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      {fields.length > 0 && (
        <div className="breakdown">
          <h4>Desglose del cobro</h4>
          {fields.map((f) => {
            const hasError = !!breakdownErrors[f.key];
            if (f.type === "amount") {
              const autoVal = f.autoCalc
                ? autoCalcValue(breakdown, metodoPago, granTotal)
                : breakdown?.[f.key];
              return (
                <label key={f.key} className="field">
                  <span className="field-label">
                    {f.label}
                    {f.autoCalc && (
                      <span className="hint"> (auto-calculado)</span>
                    )}
                  </span>
                  <CurrencyInput
                    value={autoVal}
                    disabled={f.autoCalc}
                    hasError={hasError}
                    onChange={(v) => setBreakdownValue(f.key, v)}
                  />
                </label>
              );
            }
            return (
              <label key={f.key} className="field">
                <span className="field-label">
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </span>
                <input
                  type="text"
                  className={hasError ? "has-error" : ""}
                  value={breakdown?.[f.key] ?? ""}
                  onChange={(e) => setBreakdownValue(f.key, e.target.value)}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
