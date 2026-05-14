import { SHIPPING_FIELDS } from "../utils/constants";

/**
 * Dirección de entrega. Renderiza los inputs en bucle a partir del
 * declarativo SHIPPING_FIELDS. Soporta text, select y textarea.
 * Marca visualmente los campos con error vía el prop `errors`.
 */
export default function ShippingFields({ values, errors = {}, onChange }) {
  return (
    <div className="shipping-fields">
      {SHIPPING_FIELDS.map((f) => {
        const val = values?.[f.key] ?? "";
        const hasError = !!errors[f.key];
        const id = `ship-${f.key}`;
        return (
          <label
            key={f.key}
            className={`field ${f.type === "textarea" ? "field-wide" : ""}`}
            htmlFor={id}
          >
            <span className="field-label">
              {f.label}
              {f.required && <span className="req">*</span>}
            </span>

            {f.type === "select" && (
              <select
                id={id}
                className={hasError ? "has-error" : ""}
                value={val}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">— Selecciona —</option>
                {f.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {f.type === "textarea" && (
              <textarea
                id={id}
                rows={2}
                className={hasError ? "has-error" : ""}
                value={val}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )}

            {f.type === "text" && (
              <input
                id={id}
                type="text"
                className={hasError ? "has-error" : ""}
                value={val}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
