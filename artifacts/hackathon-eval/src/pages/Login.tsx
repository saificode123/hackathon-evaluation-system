import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { signIn, user, configured } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(`/${user.role}`);
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    setError("");
    setLoading(true);
    try {
      const loggedInUser = await signIn(email, password);
      navigate(`/${loggedInUser.role}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Animated background orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      {/* Floating particles */}
      {[...Array(18)].map((_, i) => (
        <div key={i} className="login-particle" style={{
          left: `${(i * 37 + 7) % 100}%`,
          top: `${(i * 53 + 13) % 100}%`,
          animationDelay: `${(i * 0.4) % 4}s`,
          animationDuration: `${3 + (i % 3)}s`,
          width: i % 3 === 0 ? 4 : i % 3 === 1 ? 3 : 2,
          height: i % 3 === 0 ? 4 : i % 3 === 1 ? 3 : 2,
        }} />
      ))}

      <div className="login-split">
        {/* Centered form panel */}
        <div className="login-form-panel" style={{ width: "100%" }}>
          <div className="login-form-card">
            <div className="login-form-header">
              <div className="login-form-logo-wrap">
                <img src="/university-logo.png" alt="CUST Logo" className="login-form-logo" />
                <div className="login-form-logo-ring" />
              </div>
              <h1>Welcome to CUST<br />Hackathon 2026</h1>
              <p>Sign in to access the evaluation system</p>
            </div>

            {!configured && (
              <div className="alert alert-error" style={{ marginBottom: "1.5rem", fontSize: "0.8rem" }}>
                Firebase is not configured. Add your environment variables to activate.
              </div>
            )}

            {error && (
              <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
              <div>
                <label className="login-field-label">Email Address</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    type="email"
                    className="login-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!configured}
                  />
                </div>
              </div>

              <div>
                <label className="login-field-label">Password</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={!configured}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading || !configured}
              >
                {loading ? (
                  <>
                    <div className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="login-form-footer">
              <div className="login-form-footer-dot" />
              Hackathon Evaluation System · CUST 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
