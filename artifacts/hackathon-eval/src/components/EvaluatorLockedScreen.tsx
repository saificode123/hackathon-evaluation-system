import { useAuth } from "../lib/auth";
import { useLocation } from "wouter";

export default function EvaluatorLockedScreen() {
  const { signOut } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "2rem", background: "hsl(var(--background))",
    }}>
      <div style={{
        maxWidth: 580, width: "100%", textAlign: "center",
        background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
        borderRadius: 16, padding: "3rem 2.5rem",
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, #fef3c7, #fde68a)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 1.5rem",
          boxShadow: "0 4px 16px rgba(251,191,36,0.3)",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="6"/>
            <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        </div>

        <img
          src="/university-logo.png"
          alt="CUST"
          style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 10, marginBottom: "1.25rem" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />

        <h1 style={{
          fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem",
          background: "linear-gradient(135deg, #1e40af, #7c3aed)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Hackathon 2026 — AI for a Sustainable Future
        </h1>

        <p style={{
          fontSize: "1rem", lineHeight: 1.85, color: "hsl(215 25% 30%)",
          marginBottom: "2rem", fontStyle: "italic",
        }}>
          "Thank you for your valuable time, expertise, and thoughtful evaluations. Your contributions played a vital role in the success of this event and the growth of our participants."
        </p>

        <div style={{
          background: "hsl(210 40% 96%)", borderRadius: 10,
          padding: "0.85rem 1.25rem", marginBottom: "2rem",
          fontSize: "0.85rem", color: "hsl(215 25% 40%)",
        }}>
          <strong>CUST Pakistan</strong> — Capital University of Science &amp; Technology
        </div>

        <button
          className="btn btn-secondary"
          style={{ fontSize: "0.85rem" }}
          onClick={() => signOut().then(() => navigate("/login"))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
