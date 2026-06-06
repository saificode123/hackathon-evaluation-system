import { useMemo, useState } from "react";

interface SearchableMultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

/** Multi-select with local search — no extra Firestore reads. */
export default function SearchableMultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Search…",
  emptyMessage = "No matches",
  disabled,
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q),
    );
  }, [options, search]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAllFiltered = () => {
    const ids = filtered.map((o) => o.value);
    const merged = new Set([...selected, ...ids]);
    onChange([...merged]);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="form-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
        <label className="form-label" style={{ marginBottom: 0 }}>{label}</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={selectAllFiltered} disabled={disabled || filtered.length === 0}>
            Select all shown
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll} disabled={disabled || selected.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
          {selected.map((id) => (
            <span key={id} className="badge badge-blue" style={{ fontSize: "0.75rem" }}>
              {id}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <input
        className="form-input"
        style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />

      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          background: disabled ? "hsl(var(--muted))" : "hsl(var(--card))",
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: "0.75rem", fontSize: "0.82rem", color: "hsl(215 16% 47%)" }}>
            {emptyMessage}
          </div>
        ) : (
          filtered.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.55rem 0.75rem",
                fontSize: "0.85rem",
                cursor: disabled ? "not-allowed" : "pointer",
                borderBottom: "1px solid hsl(var(--border))",
                background: selected.includes(o.value) ? "hsl(221 83% 53% / 0.06)" : undefined,
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                disabled={disabled}
              />
              <span>{o.label}</span>
            </label>
          ))
        )}
      </div>

      <div style={{ fontSize: "0.78rem", color: "hsl(215 16% 47%)", marginTop: "0.35rem" }}>
        {selected.length} team{selected.length !== 1 ? "s" : ""} selected
      </div>
    </div>
  );
}
