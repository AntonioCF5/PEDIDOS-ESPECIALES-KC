import { useEffect, useState } from "react";
import { getAllRecords, normalizeError } from "../utils/zohoApi";
import { MODULES, MATERIAL_FIELDS } from "../utils/constants";
import { getCI } from "../utils/getCI";
import { toNumber } from "../utils/formatters";

/** Normaliza un registro crudo de Materiales_Producci_n. */
export function normalizeMaterial(raw) {
  return {
    id: getCI(raw, MATERIAL_FIELDS.ID),
    name: getCI(raw, MATERIAL_FIELDS.NAME) || "",
    alias: getCI(raw, MATERIAL_FIELDS.ALIAS) || "",
    costoM2: toNumber(getCI(raw, MATERIAL_FIELDS.COSTO_M2)),
    activo: getCI(raw, MATERIAL_FIELDS.ACTIVO),
  };
}

/** Carga los materiales activos del módulo Materiales_Producci_n. */
export default function useMateriales() {
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAllRecords(MODULES.MATERIALES)
      .then((all) => {
        if (cancelled) return;
        const list = all
          .map(normalizeMaterial)
          .filter((m) => m.activo !== false)
          .sort((a, b) =>
            (a.alias || a.name).localeCompare(b.alias || b.name, "es")
          );
        setMateriales(list);
      })
      .catch((raw) => {
        if (!cancelled) {
          setError(normalizeError(raw, "No se pudieron cargar los materiales."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { materiales, loading, error };
}
