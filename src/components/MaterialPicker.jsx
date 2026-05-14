import { useState, useRef, useEffect } from "react";

/**
 * Dropdown de materiales (lista corta, sin campo de búsqueda).
 * Display = Alias del material, fallback a Name. Emite el objeto material.
 */
export default function MaterialPicker({
  materiales,
  value,
  onSelect,
  disabled = false,
  placeholder = "Seleccionar material...",
  hasError = false,
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

  const label = (m) => m.alias || m.name;

  return (
    <div className={`picker ${hasError ? "has-error" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="picker-trigger"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? (
          <span className="picker-value">{label(value)}</span>
        ) : (
          <span className="picker-placeholder">{placeholder}</span>
        )}
        <span className="picker-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="picker-panel">
          <ul className="picker-list">
            {(materiales || []).length === 0 && (
              <li className="picker-empty">Sin materiales</li>
            )}
            {(materiales || []).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="picker-option"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                  }}
                >
                  <span className="picker-option-name">{label(m)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
