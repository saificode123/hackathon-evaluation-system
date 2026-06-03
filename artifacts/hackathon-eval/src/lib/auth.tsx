import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import type { AppUser, Role } from "./types";

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AppUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);

      // Clean up previous profile listener whenever auth state changes
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (fbUser) {
        // Real-time listener on the user's Firestore doc so that
        // Admin lock/unlock changes propagate instantly to the logged-in session
        profileUnsub = onSnapshot(
          doc(db, "users", fbUser.uid),
          (snap) => {
            if (snap.exists()) {
              setUser({ uid: fbUser.uid, ...snap.data() } as AppUser);
            } else {
              setUser(null);
              firebaseSignOut(auth);
            }
            setLoading(false);
          },
          () => {
            setUser(null);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, [configured]);

  const signIn = async (email: string, password: string): Promise<AppUser> => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (!snap.exists()) {
      await firebaseSignOut(auth);
      throw new Error("User account not found. Please contact your administrator.");
    }
    const data = snap.data() as Omit<AppUser, "uid">;
    if (!["admin", "evaluator", "coordinator"].includes(data.role)) {
      await firebaseSignOut(auth);
      throw new Error("Invalid user role.");
    }
    // Disabled evaluators are intentionally allowed to sign in.
    // They will see a thank-you screen instead of the dashboard.
    const appUser: AppUser = { uid: cred.user.uid, ...data };
    setUser(appUser);
    setFirebaseUser(cred.user);
    return appUser;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, configured, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireRole(role: Role | Role[]) {
  const { user } = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  return user && roles.includes(user.role);
}
