import { useMemo, useState } from "react";

interface SearchableSelectProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

export default function SearchableSelect({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = "Search…",
  disabled,
  emptyMessage = "No matches",
}: SearchableSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q),
    );
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="form-group" style={{ position: "relative" }}>
      <label className="form-label">
        {label}
        {required && " *"}
      </label>
      <button
        type="button"
        className="form-input"
        style={{
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "hsl(var(--muted))" : undefined,
        }}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        {value ? selectedLabel : `Select ${label.toLowerCase()}…`}
      </button>

      {open && !disabled && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 50,
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              marginTop: 4,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "0.5rem", borderBottom: "1px solid hsl(var(--border))" }}>
              <input
                className="form-input"
                style={{ fontSize: "0.85rem" }}
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "0.75rem", fontSize: "0.82rem", color: "hsl(215 16% 47%)" }}>
                  {emptyMessage}
                </div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "0.6rem 0.75rem",
                      fontSize: "0.85rem",
                      border: "none",
                      background: o.value === value ? "hsl(221 83% 53% / 0.08)" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {o.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
