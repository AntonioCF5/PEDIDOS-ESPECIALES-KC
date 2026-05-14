import { TIPO_MEDIDA_OPTIONS } from "../utils/constants";

/**
 * Captura de medidas de un cuadro personalizado: base, altura y tipo de
 * medida (cm / pulgadas). Controlado por la row del padre.
 *
 * Cuando las medidas vienen precargadas de un Set siguen siendo editables
 * (FR-5b): este formulario no se bloquea.
 */
export default function CustomDimensionsForm({
  base,
  altura,
  tipoMedida,
  onChange,
  errors = {},
}) {
  return (
    <div className="dimensions-form">
      <label className="field">
        <span className="field-label">Base</span>
        <input
          type="number"
          min="0"
          step="0.1"
          className={errors.base ? "has-error" : ""}
          value={base ?? ""}
          onChange={(e) => onChange({ base: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">Altura</span>
        <input
          type="number"
          min="0"
          step="0.1"
          className={errors.altura ? "has-error" : ""}
          value={altura ?? ""}
          onChange={(e) => onChange({ altura: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field-label">Tipo de medida</span>
        <select
          value={tipoMedida}
          onChange={(e) => onChange({ tipoMedida: e.target.value })}
        >
          {TIPO_MEDIDA_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
