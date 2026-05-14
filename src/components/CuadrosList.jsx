import { ROW_TYPES } from "../utils/constants";
import { makeRow } from "../utils/rows";
import CuadroRow from "./CuadroRow";

/**
 * Grilla de tarjetas de captura. Maneja agregar / quitar / editar líneas.
 * El estado `rows` vive en OrderForm; aquí solo se emiten cambios.
 */
export default function CuadrosList({
  rows,
  onRowsChange,
  products,
  materiales,
  sets,
  rowErrors = {},
  highlightId,
  rowRefs,
}) {
  function addRow(tipo) {
    onRowsChange([...rows, makeRow(tipo)]);
  }

  function removeRow(id) {
    onRowsChange(rows.filter((r) => r.id !== id));
  }

  function patchRow(id, patch) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="cuadros-list">
      <div className="cuadros-add">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => addRow(ROW_TYPES.CATALOGO)}
        >
          + Producto de catálogo
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => addRow(ROW_TYPES.PERSONALIZADO)}
        >
          + Cuadro personalizado
        </button>
      </div>

      {rows.length === 0 && (
        <p className="hint">
          Agrega al menos un producto de catálogo o un cuadro personalizado.
        </p>
      )}

      {rows.map((row, index) => (
        <CuadroRow
          key={row.id}
          ref={(el) => {
            if (rowRefs) rowRefs.current[row.id] = el;
          }}
          row={row}
          index={index}
          products={products}
          materiales={materiales}
          sets={sets}
          errors={rowErrors[row.id] || {}}
          highlighted={highlightId === row.id}
          onChange={(patch) => patchRow(row.id, patch)}
          onRemove={() => removeRow(row.id)}
        />
      ))}
    </div>
  );
}
