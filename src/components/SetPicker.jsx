import { useState, useRef, useEffect } from "react";

/**
 * Dropdown de Sets predefinidos (FR-5).
 * Incluye la opción "Medidas manuales" para no usar un set (FR-5c).
 * Al elegir un set, el contenedor precarga base/altura/tipo de medida.
 */
export default function SetPicker({
  sets,
  value,
  onSelect,
  disabled = false,
  placeholder = "Medidas manuales (sin set)",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="picker-trigger"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? (
          <span className="picker-value">{value.name}</span>
        ) : (
          <span className="picker-placeholder">{placeholder}</span>
        )}
        <span className="picker-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="picker-panel">
          <ul className="picker-list">
            <li>
              <button
                type="button"
                className="picker-option"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <span className="picker-option-name">
                  Medidas manuales (sin set)
                </span>
              </button>
            </li>
            {(sets || []).length === 0 && (
              <li className="picker-empty">
                No hay sets disponibles todavía
              </li>
            )}
            {(sets || []).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="picker-option"
                  onClick={() => {
                    onSelect(s);
                    setOpen(false);
                  }}
                >
                  <span className="picker-option-name">{s.name}</span>
                  <span className="picker-option-meta">
                    {s.base ?? "?"}×{s.altura ?? "?"} {s.tipoMedida}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
