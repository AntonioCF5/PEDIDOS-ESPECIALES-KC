import { forwardRef } from "react";
import { ROW_TYPES } from "../utils/constants";
import { formatCurrency } from "../utils/formatters";
import { rowSubtotal } from "../utils/woocommerce";
import ProductPicker from "./ProductPicker";
import MaterialPicker from "./MaterialPicker";
import SetPicker from "./SetPicker";
import CustomDimensionsForm from "./CustomDimensionsForm";
import CurrencyInput from "./CurrencyInput";

/**
 * Tarjeta de captura de una línea del pedido (producto de catálogo o cuadro
 * personalizado). Componente presentacional: recibe la `row` y emite cambios
 * vía onChange(patch). El estado vive en OrderForm.
 */
const CuadroRow = forwardRef(function CuadroRow(
  {
    row,
    index,
    products,
    materiales,
    sets,
    errors = {},
    highlighted = false,
    onChange,
    onRemove,
  },
  ref
) {
  const isCatalogo = row.tipo === ROW_TYPES.CATALOGO;

  function selectProducto(producto) {
    onChange({
      producto,
      precioUnitario:
        producto?.unitPrice != null ? producto.unitPrice : row.precioUnitario,
    });
  }

  function selectSet(set) {
    if (set) {
      // Precarga base/altura/tipo de medida; siguen siendo editables (FR-5b).
      onChange({
        set,
        base: set.base ?? "",
        altura: set.altura ?? "",
        tipoMedida: set.tipoMedida || row.tipoMedida,
      });
    } else {
      onChange({ set: null });
    }
  }

  return (
    <div
      ref={ref}
      className={`cuadro ${highlighted ? "cuadro-highlight" : ""}`}
    >
      <div className="cuadro-head">
        <span className={`badge badge-${row.tipo}`}>
          {isCatalogo ? "Catálogo" : "Personalizado"} #{index + 1}
        </span>
        <button
          type="button"
          className="btn-icon"
          title="Quitar línea"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>

      <div className="cuadro-body">
        {isCatalogo && (
          <>
            <label className="field field-wide">
              <span className="field-label">
                Producto<span className="req">*</span>
              </span>
              <ProductPicker
                products={products}
                value={row.producto}
                onSelect={selectProducto}
              />
              {errors.producto && (
                <span className="field-error">Selecciona un producto</span>
              )}
            </label>
            {row.producto && (
              <p className="cuadro-detail">
                {row.producto.material?.name
                  ? `Material: ${row.producto.material.name} · `
                  : ""}
                {row.producto.base && row.producto.altura
                  ? `${row.producto.base}×${row.producto.altura} ${
                      row.producto.metrica || ""
                    }`
                  : ""}
              </p>
            )}
          </>
        )}

        {!isCatalogo && (
          <>
            <label className="field field-wide">
              <span className="field-label">Set predefinido</span>
              <SetPicker sets={sets} value={row.set} onSelect={selectSet} />
            </label>

            <CustomDimensionsForm
              base={row.base}
              altura={row.altura}
              tipoMedida={row.tipoMedida}
              errors={errors}
              onChange={(patch) => onChange(patch)}
            />

            <label className="field">
              <span className="field-label">
                Material<span className="req">*</span>
              </span>
              <MaterialPicker
                materiales={materiales}
                value={row.material}
                hasError={!!errors.material}
                onSelect={(material) => onChange({ material })}
              />
            </label>
          </>
        )}

        <label className="field field-sm">
          <span className="field-label">
            Cantidad<span className="req">*</span>
          </span>
          <input
            type="number"
            min="1"
            step="1"
            className={errors.cantidad ? "has-error" : ""}
            value={row.cantidad}
            onChange={(e) => onChange({ cantidad: e.target.value })}
          />
        </label>

        <label className="field field-sm">
          <span className="field-label">
            Precio unitario<span className="req">*</span>
          </span>
          <CurrencyInput
            value={row.precioUnitario}
            hasError={!!errors.precioUnitario}
            onChange={(v) => onChange({ precioUnitario: v })}
          />
        </label>

        <label className="field field-wide">
          <span className="field-label">Notas</span>
          <textarea
            rows={2}
            value={row.notas}
            onChange={(e) => onChange({ notas: e.target.value })}
          />
        </label>
      </div>

      <div className="cuadro-foot">
        <span>Subtotal</span>
        <strong>{formatCurrency(rowSubtotal(row))}</strong>
      </div>
    </div>
  );
});

export default CuadroRow;
