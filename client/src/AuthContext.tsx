import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "./api";
import type { CurrentUser } from "./api";

interface AuthContextValue {
  user: CurrentUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem("valco_user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(username: string, password: string) {
    const res = await api.post("/auth/login", { username, password });
    localStorage.setItem("valco_token", res.data.token);
    localStorage.setItem("valco_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem("valco_token");
    localStorage.removeItem("valco_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ICT_ADMIN: "ICT Admin",
  WASTE_MANAGER: "Waste Manager",
  SUPERVISOR: "Supervisor",
  COLLECTOR: "Collector",
  DRIVER: "Driver",
  HSE_OFFICER: "Environmental / HSE Officer",
  CONTRACTOR: "Contractor",
  RESIDENT: "Resident / Staff",
  MANAGEMENT: "Management",
};
