import { useState, useEffect } from "react";
import { toNumber, formatNumber } from "../utils/formatters";

/**
 * Input de moneda con prefijo "$".
 * - Mientras se edita muestra el valor crudo (evita saltos de cursor).
 * - Al perder el foco formatea con separadores es-MX.
 * - Emite `number | null` a través de onChange.
 */
export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
  className = "",
  hasError = false,
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    const n = toNumber(value);
    setText(n == null ? "" : formatNumber(n));
  }, [value, focused]);

  function handleChange(e) {
    const raw = e.target.value;
    setText(raw);
    onChange(toNumber(raw));
  }

  function handleFocus() {
    setFocused(true);
    const n = toNumber(value);
    setText(n == null ? "" : String(n));
  }

  function handleBlur() {
    setFocused(false);
    const n = toNumber(text);
    setText(n == null ? "" : formatNumber(n));
    onChange(n);
  }

  return (
    <div
      className={`currency-input ${hasError ? "has-error" : ""} ${className}`}
    >
      <span className="currency-prefix">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </div>
  );
}
