import { useEffect, useState } from "react";
import { brDateToISO, isoDateToBR } from "../utils/formatDate.js";

/** Campo de data com máscara DD/MM/AAAA; valor externo em YYYY-MM-DD. */
export default function BrDateInput({ className = "", value, onChange, ...props }) {
  const [text, setText] = useState(() => isoDateToBR(value));

  useEffect(() => {
    setText(isoDateToBR(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      autoComplete="off"
      className={className}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const iso = brDateToISO(raw);
        if (iso) onChange(iso);
        else if (!raw.trim()) onChange("");
      }}
      onBlur={() => {
        const iso = brDateToISO(text);
        if (iso) {
          onChange(iso);
          setText(isoDateToBR(iso));
        } else if (!text.trim()) {
          onChange("");
          setText("");
        } else {
          setText(isoDateToBR(value));
        }
      }}
      {...props}
    />
  );
}
