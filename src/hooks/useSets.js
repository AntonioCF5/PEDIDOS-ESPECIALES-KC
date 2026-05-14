import { useEffect, useState } from "react";
import { getSets, normalizeError } from "../utils/zohoApi";
import { SET_FIELDS, TIPO_MEDIDA } from "../utils/constants";
import { getCI } from "../utils/getCI";
import { toNumber } from "../utils/formatters";

/** Normaliza un registro crudo del módulo de Sets. */
export function normalizeSet(raw) {
  const tipo = getCI(raw, SET_FIELDS.TIPO_MEDIDA);
  return {
    id: getCI(raw, SET_FIELDS.ID),
    name: getCI(raw, SET_FIELDS.NAME) || "",
    base: toNumber(getCI(raw, SET_FIELDS.BASE)),
    altura: toNumber(getCI(raw, SET_FIELDS.ALTURA)),
    tipoMedida: tipo || TIPO_MEDIDA.CM,
  };
}

/**
 * Carga los Sets predefinidos (FR-5). Si el módulo de Sets todavía no existe
 * en Zoho (FR-15), `getSets()` devuelve [] y el widget sigue funcionando: el
 * operador podrá ingresar medidas manualmente (FR-5c).
 */
export default function useSets() {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getSets()
      .then((all) => {
        if (cancelled) return;
        const list = all
          .map(normalizeSet)
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        setSets(list);
      })
      .catch((raw) => {
        if (!cancelled) {
          setError(normalizeError(raw, "No se pudieron cargar los sets."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { sets, loading, error };
}
