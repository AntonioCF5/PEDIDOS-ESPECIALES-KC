import { useEffect, useState } from "react";
import { getAllRecords, normalizeError } from "../utils/zohoApi";
import {
  MODULES,
  PRODUCT_FIELDS,
  WOOCOMMERCE,
  CUSTOM_PRODUCT_PREFIXES,
} from "../utils/constants";
import { getCI } from "../utils/getCI";
import { toNumber } from "../utils/formatters";

/** Normaliza un registro crudo de Products a un objeto plano de catálogo. */
export function normalizeProduct(raw) {
  const material = getCI(raw, PRODUCT_FIELDS.MATERIAL);
  return {
    id: getCI(raw, PRODUCT_FIELDS.ID),
    name: getCI(raw, PRODUCT_FIELDS.NAME) || "",
    code: getCI(raw, PRODUCT_FIELDS.CODE) || "",
    unitPrice: toNumber(getCI(raw, PRODUCT_FIELDS.UNIT_PRICE)),
    active: getCI(raw, PRODUCT_FIELDS.ACTIVE),
    base: toNumber(getCI(raw, PRODUCT_FIELDS.BASE)),
    altura: toNumber(getCI(raw, PRODUCT_FIELDS.ALTURA)),
    metrica: getCI(raw, PRODUCT_FIELDS.METRICA) || "",
    material: material
      ? { id: material.id, name: material.name }
      : null,
    woocommerceId: getCI(raw, PRODUCT_FIELDS.WOOCOMMERCE_ID) || "",
    tienda: getCI(raw, PRODUCT_FIELDS.TIENDA) || "",
  };
}

/**
 * Carga el catálogo de productos de Krea Canvas.
 * Filtra (FR-3 / FR-14):
 *   - productos activos,
 *   - de la tienda Krea Canvas,
 *   - excluyendo los que empiezan con el prefijo "Pedido Especial".
 */
export default function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAllRecords(MODULES.PRODUCTS)
      .then((all) => {
        if (cancelled) return;
        // Excluye todos los productos custom creados por este widget,
        // independientemente del tipo de pedido (Pedido Especial / Reposición / Muestra).
        const customPrefixes = CUSTOM_PRODUCT_PREFIXES.map((p) =>
          p.toLowerCase()
        );
        const list = all
          .map(normalizeProduct)
          .filter((p) => p.active !== false)
          .filter((p) => {
            const lname = p.name.trim().toLowerCase();
            return !customPrefixes.some((prefix) => lname.startsWith(prefix));
          })
          .filter((p) => !p.tienda || p.tienda === WOOCOMMERCE.TIENDA_KC)
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        setProducts(list);
      })
      .catch((raw) => {
        if (!cancelled) {
          setError(normalizeError(raw, "No se pudo cargar el catálogo de productos."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error };
}
