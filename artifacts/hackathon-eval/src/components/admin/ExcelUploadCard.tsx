import { useRef, useState } from "react";

interface ExcelUploadCardProps {
  title: string;
  subtitle: string;
  expectedColumns: string[];
  optionalColumns?: string[];
  uploading: boolean;
  progress?: { done: number; total: number };
  onFileSelected: (file: File) => void;
  children?: React.ReactNode;
}

export default function ExcelUploadCard({
  title,
  subtitle,
  expectedColumns,
  optionalColumns = [],
  uploading,
  progress,
  onFileSelected,
  children,
}: ExcelUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    onFileSelected(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-subtitle">{subtitle}</div>
      </div>

      <div
        style={{
          border: `2px dashed ${dragOver ? "hsl(221 83% 53%)" : "hsl(var(--border))"}`,
          borderRadius: 12,
          padding: "1.5rem",
          textAlign: "center",
          background: dragOver ? "hsl(221 83% 53% / 0.04)" : "hsl(210 40% 98%)",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.7 : 1,
          transition: "border-color 0.15s, background 0.15s",
        }}
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          disabled={uploading}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="hsl(221 83% 53%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 0.75rem" }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.35rem" }}>
          {uploading ? "Processing…" : "Click or drag Excel file here"}
        </div>
        <div style={{ fontSize: "0.78rem", color: "hsl(215 16% 47%)" }}>
          Supports .xlsx, .xls, .csv
        </div>
        {uploading && progress && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ fontSize: "0.78rem", color: "hsl(215 16% 47%)", marginBottom: 4 }}>
              {progress.done} / {progress.total}
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: "0.875rem", fontSize: "0.78rem", color: "hsl(215 16% 47%)" }}>
        <strong>Required columns:</strong> {expectedColumns.join(", ")}
        {optionalColumns.length > 0 && (
          <>
            <br />
            <strong>Optional:</strong> {optionalColumns.join(", ")}
          </>
        )}
      </div>

      {children}
    </div>
  );
}
