import { useEffect, useState } from "react";
import { api } from "../api";
import { ROLE_LABELS } from "../AuthContext";

interface UserRow {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
  last_login: string | null;
  zone_name: string | null;
}

export default function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get("/users")
      .then((res) => setUsers(res.data.users))
      .catch(() => setError("Couldn't load users."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function deactivate(id: number) {
    setBusyId(id);
    try {
      await api.patch(`/users/${id}/deactivate`);
      load();
    } catch {
      setError("Couldn't deactivate this account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Administration</p>
        <h1 className="font-display text-2xl font-semibold text-white">User Management</h1>
      </div>

      {error && <div className="text-status-critical text-sm">{error}</div>}

      <div className="bg-graphite-800 border border-graphite-700 rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-graphite-700 text-left text-[11px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  Loading users...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-graphite-700/60 last:border-0 hover:bg-graphite-700/20">
                  <td className="px-4 py-2.5 text-gray-100">{u.full_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{u.username}</td>
                  <td className="px-4 py-2.5 text-gold-500 text-xs">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="px-4 py-2.5 text-gray-300">{u.department || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-300">{u.zone_name || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-sm border ${
                        u.is_active
                          ? "bg-status-successBg text-status-success border-status-success/30"
                          : "bg-graphite-700 text-gray-500 border-graphite-600"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_active && (
                      <button
                        onClick={() => deactivate(u.id)}
                        disabled={busyId === u.id}
                        className="text-xs text-status-critical hover:underline disabled:opacity-50"
                      >
                        {busyId === u.id ? "Working..." : "Deactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
