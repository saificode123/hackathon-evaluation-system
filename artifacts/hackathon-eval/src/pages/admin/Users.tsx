import { useEffect, useState } from "react";
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, serverTimestamp, writeBatch
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, sendPasswordResetEmail
} from "firebase/auth";
import { db, secondaryAuth } from "../../lib/firebase";
import type { AppUser, Role } from "../../lib/types";

interface FormData {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const initialForm: FormData = { name: "", email: "", password: "", role: "evaluator" };

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [locking, setLocking] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("role", "in", ["evaluator", "coordinator"])));
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: form.name,
        email: form.email,
        role: form.role,
        disabled: false,
        createdAt: serverTimestamp(),
      });
      await fetchUsers();
      setSuccess(`User "${form.name}" created successfully.`);
      setForm(initialForm);
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create user";
      if (msg.includes("email-already-in-use")) {
        setError("This email is already registered.");
      } else if (msg.includes("weak-password")) {
        setError("Password must be at least 6 characters.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, "users", deleteTarget.uid));
      setUsers((prev) => prev.filter((u) => u.uid !== deleteTarget.uid));
      setDeleteTarget(null);
      setSuccess(`User "${deleteTarget.name}" removed.`);
    } catch {
      setError("Failed to delete user.");
    }
  };

  const handlePasswordReset = async (user: AppUser) => {
    try {
      await sendPasswordResetEmail(secondaryAuth, user.email);
      setSuccess(`Password reset email sent to ${user.email}.`);
    } catch {
      setError("Failed to send reset email.");
    }
  };

  const handleLockAllEvaluators = async () => {
    setLocking(true);
    try {
      const evaluators = users.filter((u) => u.role === "evaluator");
      const batch = writeBatch(db);
      for (const u of evaluators) {
        batch.update(doc(db, "users", u.uid), { disabled: true });
      }
      await batch.commit();
      setUsers((prev) =>
        prev.map((u) => (u.role === "evaluator" ? { ...u, disabled: true } : u))
      );
      setSuccess(`All ${evaluators.length} evaluator account${evaluators.length !== 1 ? "s" : ""} have been locked. Evaluators can no longer log in.`);
    } catch {
      setError("Failed to lock evaluator accounts.");
    } finally {
      setLocking(false);
      setShowLockConfirm(false);
    }
  };

  const handleUnlockAllEvaluators = async () => {
    try {
      const evaluators = users.filter((u) => u.role === "evaluator" && u.disabled);
      if (evaluators.length === 0) return;
      const batch = writeBatch(db);
      for (const u of evaluators) {
        batch.update(doc(db, "users", u.uid), { disabled: false });
      }
      await batch.commit();
      setUsers((prev) =>
        prev.map((u) => (u.role === "evaluator" ? { ...u, disabled: false } : u))
      );
      setSuccess(`All evaluator accounts have been unlocked.`);
    } catch {
      setError("Failed to unlock evaluator accounts.");
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const lockedEvaluatorsCount = users.filter((u) => u.role === "evaluator" && u.disabled).length;
  const totalEvaluators = users.filter((u) => u.role === "evaluator").length;
  const allLocked = totalEvaluators > 0 && lockedEvaluatorsCount === totalEvaluators;

  return (
    <div className="page-content">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Create and manage evaluator and coordinator accounts.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {totalEvaluators > 0 && (
            allLocked ? (
              <button className="btn btn-secondary" onClick={handleUnlockAllEvaluators} style={{ borderColor: "#10b981", color: "#10b981" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
                Unlock Evaluators
              </button>
            ) : (
              <button className="btn btn-danger" onClick={() => setShowLockConfirm(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Lock All Evaluators
              </button>
            )
          )}
          <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(""); setSuccess(""); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create User
          </button>
        </div>
      </div>

      {allLocked && totalEvaluators > 0 && (
        <div className="alert alert-error" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          All evaluator accounts are currently locked. Evaluators cannot log in.
        </div>
      )}

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-bar">
        <input
          type="search"
          className="form-input search-input"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-select" style={{ width: "auto" }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
          <option value="all">All Roles</option>
          <option value="evaluator">Evaluators</option>
          <option value="coordinator">Coordinators</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3>No users found</h3>
            <p>{search ? "Try a different search term." : "Create your first user using the button above."}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.uid} style={{ opacity: u.disabled ? 0.65 : 1 }}>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ color: "hsl(215 16% 47%)" }}>{u.email}</td>
                      <td>
                        <span className={`badge ${u.role === "evaluator" ? "badge-blue" : "badge-purple"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.role === "evaluator" ? (
                          <span className={`badge ${u.disabled ? "badge-red" : "badge-green"}`}>
                            {u.disabled ? "Locked" : "Active"}
                          </span>
                        ) : (
                          <span className="badge badge-green">Active</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Send password reset email"
                            onClick={() => handlePasswordReset(u)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                              <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
                            </svg>
                            Reset
                          </button>
                          {u.role === "evaluator" && (
                            <button
                              className={`btn btn-sm ${u.disabled ? "btn-secondary" : "btn-secondary"}`}
                              style={u.disabled ? { borderColor: "#10b981", color: "#10b981" } : { borderColor: "#f59e0b", color: "#b45309" }}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, "users", u.uid), { disabled: !u.disabled });
                                  setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, disabled: !u.disabled } : x));
                                  setSuccess(`${u.name} has been ${u.disabled ? "unlocked" : "locked"}.`);
                                } catch {
                                  setError("Failed to update user status.");
                                }
                              }}
                            >
                              {u.disabled ? "Unlock" : "Lock"}
                            </button>
                          )}
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(u)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="mobile-card-list" style={{ marginTop: "0.5rem" }}>
              {filtered.map((u) => (
                <div key={u.uid} className="mobile-card" style={{ opacity: u.disabled ? 0.7 : 1 }}>
                  <div className="mobile-card-row">
                    <span style={{ fontWeight: 700 }}>{u.name}</span>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <span className={`badge ${u.role === "evaluator" ? "badge-blue" : "badge-purple"}`}>{u.role}</span>
                      {u.role === "evaluator" && (
                        <span className={`badge ${u.disabled ? "badge-red" : "badge-green"}`}>{u.disabled ? "Locked" : "Active"}</span>
                      )}
                    </div>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">{u.email}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handlePasswordReset(u)}>Reset Password</button>
                    {u.role === "evaluator" && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={u.disabled ? { borderColor: "#10b981", color: "#10b981" } : { borderColor: "#f59e0b", color: "#b45309" }}
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, "users", u.uid), { disabled: !u.disabled });
                            setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, disabled: !u.disabled } : x));
                          } catch { /* ignore */ }
                        }}
                      >
                        {u.disabled ? "Unlock" : "Lock"}
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(u)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create user modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create New User</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" className="form-input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  <option value="evaluator">Evaluator</option>
                  <option value="coordinator">Coordinator</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">Confirm Delete</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: "0.9rem", marginBottom: "1.25rem" }}>
              Are you sure you want to remove <strong>{deleteTarget.name}</strong>? This will delete their account record.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete User</button>
            </div>
          </div>
        </div>
      )}

      {/* Lock all evaluators confirm modal */}
      {showLockConfirm && (
        <div className="modal-overlay" onClick={() => setShowLockConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#dc2626" }}>Lock All Evaluators?</div>
              <button className="modal-close" onClick={() => setShowLockConfirm(false)}>✕</button>
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                This will <strong>immediately lock all {totalEvaluators} evaluator account{totalEvaluators !== 1 ? "s" : ""}</strong>. Locked evaluators will still be able to log in, but will see a <strong>thank-you message</strong> instead of their dashboard.
              </p>
              <p style={{ fontSize: "0.85rem", color: "hsl(215 16% 47%)" }}>
                You can unlock individual accounts or re-enable all evaluators at any time from this page.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowLockConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleLockAllEvaluators} disabled={locking}>
                {locking ? "Locking..." : "Yes, Lock All Evaluators"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
