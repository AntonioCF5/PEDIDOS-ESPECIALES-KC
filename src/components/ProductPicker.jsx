import { useState, useRef, useEffect } from "react";
import { UI } from "../utils/constants";
import { formatCurrency } from "../utils/formatters";

/**
 * Dropdown buscable del catálogo de productos.
 * Filtra por nombre o código (máx UI.PICKER_MAX_RESULTS resultados) y cierra
 * al hacer click fuera. Al seleccionar emite el objeto producto normalizado.
 */
export default function ProductPicker({
  products,
  value,
  onSelect,
  disabled = false,
  placeholder = "Buscar producto de catálogo...",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  const q = query.trim().toLowerCase();
  const filtered = (products || [])
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q))
    )
    .slice(0, UI.PICKER_MAX_RESULTS);

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
          <input
            className="picker-search"
            type="text"
            autoFocus
            placeholder="Escribe para filtrar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="picker-list">
            {filtered.length === 0 && (
              <li className="picker-empty">Sin resultados</li>
            )}
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="picker-option"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="picker-option-name">{p.name}</span>
                  <span className="picker-option-meta">
                    {p.code ? `${p.code} · ` : ""}
                    {formatCurrency(p.unitPrice)}
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
