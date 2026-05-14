import { ROW_TYPES } from "../utils/constants";
import { formatCurrency } from "../utils/formatters";
import { rowSubtotal } from "../utils/woocommerce";
import { calcSubtotal } from "../utils/totals";

/** Descripción legible de una row para la tabla resumen. */
function describeRow(row) {
  if (row.tipo === ROW_TYPES.CATALOGO) {
    return row.producto?.name || "(producto sin seleccionar)";
  }
  const mat = row.material?.alias || row.material?.name || "(sin material)";
  const medidas =
    row.base && row.altura
      ? `${row.base}×${row.altura} ${row.tipoMedida}`
      : "(sin medidas)";
  const setLabel = row.set?.name ? ` · Set: ${row.set.name}` : "";
  return `${mat} · ${medidas}${setLabel}`;
}

/**
 * Tabla resumen acumulada de todas las líneas del pedido (FR-6).
 * Cada renglón es clickable: llama onFocusRow(id) para que el contenedor
 * haga scroll a la tarjeta correspondiente y la resalte.
 */
export default function CuadrosSummary({ rows, onFocusRow }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="summary-empty">
        Aún no hay productos en el pedido. Agrega productos de catálogo o
        cuadros personalizados arriba.
      </p>
    );
  }

  const total = calcSubtotal(rows);

  return (
    <table className="cuadros-summary">
      <thead>
        <tr>
          <th>#</th>
          <th>Tipo</th>
          <th>Descripción</th>
          <th>Notas</th>
          <th className="num">Cant.</th>
          <th className="num">P. Unitario</th>
          <th className="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id}
            className="summary-row"
            onClick={() => onFocusRow && onFocusRow(row.id)}
            title="Click para editar esta línea"
          >
            <td>{i + 1}</td>
            <td>
              <span className={`badge badge-${row.tipo}`}>
                {row.tipo === ROW_TYPES.CATALOGO ? "Catálogo" : "Personalizado"}
              </span>
            </td>
            <td>{describeRow(row)}</td>
            <td className="summary-notas">{row.notas || "—"}</td>
            <td className="num">{row.cantidad || 0}</td>
            <td className="num">{formatCurrency(row.precioUnitario)}</td>
            <td className="num">{formatCurrency(rowSubtotal(row))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={6} className="num">
            Total productos
          </td>
          <td className="num total-cell">{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
