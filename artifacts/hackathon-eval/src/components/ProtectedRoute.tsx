import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";

interface Props {
  children: React.ReactNode;
  role: Role | Role[];
}

export default function ProtectedRoute({ children, role }: Props) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const allowed = !loading && !!user && (Array.isArray(role) ? role.includes(user.role) : user.role === role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
    } else if (!allowed) {
      navigate(`/${user.role}`);
    }
  }, [loading, user, allowed, navigate]);

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user || !allowed) return null;

  return <>{children}</>;
}
