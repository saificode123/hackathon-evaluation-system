import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import {
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import EvaluatorLockedScreen from "./EvaluatorLockedScreen";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, signOut } = useAuth();
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Change password modal
  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Delete all evaluations modal
  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState("");
  const [deleteAllSuccess, setDeleteAllSuccess] = useState(false);

  if (!user) return <>{children}</>;

  if (user.role === "evaluator" && user.disabled === true) {
    return <EvaluatorLockedScreen />;
  }

  const openPwModal = () => {
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwError(""); setPwSuccess(false);
    setPwModal(true);
    setSidebarOpen(false);
  };

  const openDeleteAllModal = () => {
    setDeleteConfirmText("");
    setDeleteAllError("");
    setDeleteAllSuccess(false);
    setDeleteAllModal(true);
    setSidebarOpen(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPw.length < 6) { setPwError("New password must be at least 6 characters."); return; }
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (!firebaseUser?.email) { setPwError("Unable to verify user."); return; }
    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPw);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPw);
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setPwError("Current password is incorrect.");
      } else if (msg.includes("weak-password")) {
        setPwError("Password is too weak. Use at least 6 characters.");
      } else {
        setPwError("Failed to update password. Please try again.");
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAllEvaluations = async () => {
    setDeleteAllError("");
    if (deleteConfirmText.trim().toLowerCase() !== "yes i want") {
      setDeleteAllError('Please type exactly "yes i want" to confirm.');
      return;
    }
    setDeleteAllLoading(true);
    try {
      const snap = await getDocs(collection(db, "evaluations"));
      if (snap.empty) {
        setDeleteAllError("There are no evaluations to delete.");
        setDeleteAllLoading(false);
        return;
      }
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(doc(db, "evaluations", d.id)));
      await batch.commit();
      setDeleteAllSuccess(true);
    } catch {
      setDeleteAllError("Failed to delete evaluations. Please try again.");
    } finally {
      setDeleteAllLoading(false);
    }
  };

  const getNavItems = (): NavItem[] => {
    if (user.role === "admin") return [
      { label: "Dashboard", path: "/admin", icon: icons.dashboard },
      { label: "Manage Users", path: "/admin/users", icon: icons.users },
    ];
    if (user.role === "evaluator") return [
      { label: "Dashboard", path: "/evaluator", icon: icons.dashboard },
      { label: "New Evaluation", path: "/evaluator/evaluate", icon: icons.clipboard },
    ];
    if (user.role === "coordinator") return [
      { label: "Dashboard", path: "/coordinator", icon: icons.dashboard },
      { label: "All Evaluations", path: "/coordinator/evaluations", icon: icons.clipboard },
      { label: "Rankings", path: "/coordinator/rankings", icon: icons.bar },
      { label: "Grace Marks", path: "/coordinator/grace-marks", icon: icons.plus },
      { label: "Winners", path: "/coordinator/winners", icon: icons.trophy },
      { label: "Reports", path: "/coordinator/reports", icon: icons.report },
    ];
    return [];
  };

  const navItems = getNavItems();

  const roleBadgeClass =
    user.role === "admin" ? "badge-admin" :
    user.role === "evaluator" ? "badge-evaluator" : "badge-coordinator";

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
          <img
            src="/university-logo.png"
            alt="University Logo"
            style={{ width: 38, height: 38, borderRadius: 6, objectFit: "contain", background: "#fff", padding: 2, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Hackathon 2026</div>
            <div style={{ fontSize: "0.62rem", opacity: 0.55, lineHeight: 1.3 }}>AI for a Sustainable Future</div>
          </div>
        </div>
        <span className={`sidebar-role-badge ${roleBadgeClass}`}>{user.role}</span>
      </div>

      <div className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${location === item.path ? "active" : ""}`}
            onClick={() => { navigate(item.path); setSidebarOpen(false); }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

        {/* Account section — all roles */}
        <div className="nav-section-label" style={{ marginTop: "0.75rem" }}>Account</div>
        <button className="nav-item" onClick={openPwModal}>
          {icons.lock}
          Change Password
        </button>

        {/* Coordinator-only danger zone */}
        {user.role === "coordinator" && (
          <>
            <div className="nav-section-label" style={{ marginTop: "0.75rem" }}>Danger Zone</div>
            <button
              className="nav-item"
              style={{ color: "#f87171", opacity: 1 }}
              onClick={openDeleteAllModal}
            >
              {icons.trash}
              Delete All Evaluations
            </button>
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="name">{user.name}</div>
          <div className="email">{user.email}</div>
        </div>
        <button className="logout-btn" onClick={signOut}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </>
  );

  const currentTitle = navItems.find((i) => i.path === location)?.label ?? "Hackathon Eval";

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h2>{currentTitle}</h2>
        <div style={{ width: 32 }} />
      </div>

      {/* Sidebar overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {sidebarContent}
      </nav>

      {/* Main content */}
      <div className="main-content">
        {children}
      </div>

      {/* ── Change Password Modal ── */}
      {pwModal && (
        <div className="modal-overlay" onClick={() => !pwLoading && setPwModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {icons.lock}
                Change Password
              </div>
              <button className="modal-close" onClick={() => !pwLoading && setPwModal(false)}>✕</button>
            </div>

            {pwSuccess ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.4rem" }}>Password Updated!</div>
                <p style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)", marginBottom: "1.25rem" }}>
                  Your password has been changed successfully.
                </p>
                <button className="btn btn-primary" onClick={() => setPwModal(false)}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword}>
                {pwError && (
                  <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {pwError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input type="password" className="form-input" placeholder="Enter your current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required disabled={pwLoading} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-input" placeholder="At least 6 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} required disabled={pwLoading} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-input" placeholder="Repeat new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required disabled={pwLoading} />
                </div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setPwModal(false)} disabled={pwLoading}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={pwLoading}>
                    {pwLoading ? (
                      <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Updating...</>
                    ) : (
                      <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Update Password</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Delete All Evaluations Modal (Coordinator) ── */}
      {deleteAllModal && (
        <div className="modal-overlay" onClick={() => !deleteAllLoading && setDeleteAllModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "hsl(0 84% 45%)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Delete All Evaluations
              </div>
              <button className="modal-close" onClick={() => !deleteAllLoading && setDeleteAllModal(false)}>✕</button>
            </div>

            {deleteAllSuccess ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🗑️</div>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.4rem" }}>All Evaluations Deleted</div>
                <p style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)", marginBottom: "1.25rem" }}>
                  Every evaluation record has been permanently removed.
                </p>
                <button className="btn btn-secondary" onClick={() => { setDeleteAllModal(false); navigate("/coordinator/evaluations"); }}>
                  Go to Evaluations
                </button>
              </div>
            ) : (
              <>
                <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 8, padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
                  <p style={{ fontSize: "0.875rem", color: "#991b1b", lineHeight: 1.6, margin: 0 }}>
                    <strong>⚠️ This is irreversible.</strong> All evaluations from every team and every evaluator will be permanently deleted. This cannot be undone.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    To confirm, type <strong style={{ color: "#dc2626", letterSpacing: "0.02em" }}>yes i want</strong> below:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder='Type "yes i want"'
                    value={deleteConfirmText}
                    onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteAllError(""); }}
                    disabled={deleteAllLoading}
                    autoComplete="off"
                    style={{ borderColor: deleteConfirmText && deleteConfirmText.trim().toLowerCase() !== "yes i want" ? "#ef4444" : undefined }}
                  />
                  {deleteAllError && (
                    <div className="form-error" style={{ marginTop: "0.4rem" }}>{deleteAllError}</div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary" onClick={() => setDeleteAllModal(false)} disabled={deleteAllLoading}>Cancel</button>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteAllEvaluations}
                    disabled={deleteAllLoading || deleteConfirmText.trim().toLowerCase() !== "yes i want"}
                  >
                    {deleteAllLoading ? (
                      <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Deleting...</>
                    ) : (
                      <>{icons.trash} Delete Everything</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
