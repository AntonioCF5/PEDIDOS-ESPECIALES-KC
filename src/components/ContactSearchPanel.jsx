import { useState, useEffect, useRef } from "react";
import { searchContacts, createContact, normalizeError } from "../utils/zohoApi";
import { CONTACT_FIELDS } from "../utils/constants";
import { getCI } from "../utils/getCI";
import { isValidEmail } from "../utils/formatters";

/** Normaliza un registro de contacto de Zoho a un objeto plano. */
function normalizeContact(raw) {
  const first = getCI(raw, CONTACT_FIELDS.FIRST_NAME) || "";
  const last = getCI(raw, CONTACT_FIELDS.LAST_NAME) || "";
  return {
    id: getCI(raw, CONTACT_FIELDS.ID),
    firstName: first,
    lastName: last,
    fullName:
      getCI(raw, CONTACT_FIELDS.FULL_NAME) ||
      [first, last].filter(Boolean).join(" "),
    email: getCI(raw, CONTACT_FIELDS.EMAIL) || "",
    phone:
      getCI(raw, CONTACT_FIELDS.PHONE) ||
      getCI(raw, CONTACT_FIELDS.MOBILE) ||
      "",
  };
}

/**
 * Búsqueda y selección de contacto existente (FR-1) o creación de uno nuevo
 * (FR-2). Emite el contacto normalizado vía onChange.
 */
export default function ContactSearchPanel({ contacto, onChange }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("search"); // "search" | "create"
  const [draft, setDraft] = useState({ nombre: "", telefono: "", email: "" });
  const [creating, setCreating] = useState(false);
  const [draftErrors, setDraftErrors] = useState({});
  const debounceRef = useRef(null);

  // Búsqueda con debounce.
  useEffect(() => {
    if (mode !== "search") return undefined;
    const t = term.trim();
    if (t.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    setError(null);
    clearTimeout(debounceRef.current);
    let cancelled = false;
    debounceRef.current = setTimeout(() => {
      searchContacts(t)
        .then((rows) => {
          if (!cancelled) setResults(rows.map(normalizeContact));
        })
        .catch((raw) => {
          if (!cancelled) {
            setError(normalizeError(raw, "Error al buscar contactos."));
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [term, mode]);

  function selectContact(c) {
    onChange(c);
    setResults([]);
    setTerm("");
  }

  async function handleCreate() {
    const errs = {};
    if (!draft.nombre.trim()) errs.nombre = true;
    if (!draft.telefono.trim()) errs.telefono = true;
    if (draft.email && !isValidEmail(draft.email)) errs.email = true;
    setDraftErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCreating(true);
    setError(null);
    try {
      const created = await createContact(draft);
      selectContact(normalizeContact(created));
      setMode("search");
      setDraft({ nombre: "", telefono: "", email: "" });
    } catch (raw) {
      setError(normalizeError(raw, "No se pudo crear el contacto."));
    } finally {
      setCreating(false);
    }
  }

  // Contacto ya seleccionado.
  if (contacto) {
    return (
      <div className="contact-selected">
        <div className="contact-card">
          <div className="contact-name">
            {contacto.fullName || "(sin nombre)"}
          </div>
          <div className="contact-meta">
            {contacto.phone || "Sin teléfono"} ·{" "}
            {contacto.email || "Sin email"}
          </div>
        </div>
        <button
          type="button"
          className="btn-link"
          onClick={() => onChange(null)}
        >
          Cambiar contacto
        </button>
      </div>
    );
  }

  return (
    <div className="contact-panel">
      <div className="contact-tabs">
        <button
          type="button"
          className={mode === "search" ? "tab active" : "tab"}
          onClick={() => setMode("search")}
        >
          Buscar existente
        </button>
        <button
          type="button"
          className={mode === "create" ? "tab active" : "tab"}
          onClick={() => setMode("create")}
        >
          Crear nuevo
        </button>
      </div>

      {mode === "search" && (
        <div className="contact-search">
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {searching && <p className="hint">Buscando…</p>}
          {!searching && term.trim().length >= 2 && results.length === 0 && (
            <p className="hint">
              Sin coincidencias.{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => setMode("create")}
              >
                Crear contacto nuevo
              </button>
            </p>
          )}
          {results.length > 0 && (
            <ul className="contact-results">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="contact-result"
                    onClick={() => selectContact(c)}
                  >
                    <span className="contact-name">
                      {c.fullName || "(sin nombre)"}
                    </span>
                    <span className="contact-meta">
                      {c.phone || "—"} · {c.email || "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === "create" && (
        <div className="contact-create">
          <label className="field">
            <span className="field-label">
              Nombre completo<span className="req">*</span>
            </span>
            <input
              type="text"
              className={draftErrors.nombre ? "has-error" : ""}
              value={draft.nombre}
              onChange={(e) =>
                setDraft((d) => ({ ...d, nombre: e.target.value }))
              }
            />
          </label>
          <label className="field">
            <span className="field-label">
              Teléfono<span className="req">*</span>
            </span>
            <input
              type="text"
              className={draftErrors.telefono ? "has-error" : ""}
              value={draft.telefono}
              onChange={(e) =>
                setDraft((d) => ({ ...d, telefono: e.target.value }))
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              className={draftErrors.email ? "has-error" : ""}
              value={draft.email}
              onChange={(e) =>
                setDraft((d) => ({ ...d, email: e.target.value }))
              }
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={creating}
            onClick={handleCreate}
          >
            {creating ? "Creando…" : "Crear y seleccionar contacto"}
          </button>
        </div>
      )}

      {error && <p className="error-msg">{error.message}</p>}
    </div>
  );
}
