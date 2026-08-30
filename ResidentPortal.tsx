import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth, ROLE_LABELS } from "../AuthContext";

interface UserRow {
  id: number;
  full_name: string;
  username: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
  last_login: string | null;
  zone_id: number | null;
  zone_name: string | null;
}

const ROLES = Object.keys(ROLE_LABELS);

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

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
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't deactivate this account.");
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(id: number) {
    setBusyId(id);
    try {
      await api.patch(`/users/${id}/reactivate`);
      load();
    } catch {
      setError("Couldn't reactivate this account.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("Permanently delete this account? This can't be undone.")) return;
    setBusyId(id);
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || "Couldn't delete this account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-500 mb-1">Administration</p>
          <h1 className="font-display text-2xl font-semibold text-white">User Management</h1>
        </div>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-3 py-1.5 rounded-sm"
        >
          {showAddForm ? "Cancel" : "+ Create Account"}
        </button>
      </div>

      {error && <div className="text-status-critical text-sm">{error}</div>}

      {showAddForm && <UserForm onSaved={() => { setShowAddForm(false); load(); }} />}
      {editingUser && (
        <UserForm existing={editingUser} onSaved={() => { setEditingUser(null); load(); }} onCancel={() => setEditingUser(null)} />
      )}

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
                      {u.is_active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => setEditingUser(u)} className="text-xs text-gold-500 hover:underline">
                        Edit
                      </button>
                      {u.is_active ? (
                        u.id !== me?.id && (
                          <button
                            onClick={() => deactivate(u.id)}
                            disabled={busyId === u.id}
                            className="text-xs text-status-warning hover:underline disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => reactivate(u.id)}
                          disabled={busyId === u.id}
                          className="text-xs text-status-success hover:underline disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                      {u.id !== me?.id && (
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={busyId === u.id}
                          className="text-xs text-status-critical hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
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

function UserForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: UserRow;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [fullName, setFullName] = useState(existing?.full_name || "");
  const [username, setUsername] = useState(existing?.username || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(existing?.role || "COLLECTOR");
  const [department, setDepartment] = useState(existing?.department || "");
  const [zoneId, setZoneId] = useState<string>(existing?.zone_id ? String(existing.zone_id) : "");
  const [zones, setZones] = useState<{ id: number; name: string; bin_count: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zones are only relevant for collectors (their fixed assignment) and
  // residents — no need to fetch/show this for admin-type roles.
  useEffect(() => {
    api.get("/zones").then((res) => setZones(res.data.zones)).catch(() => {});
  }, []);

  const needsZone = role === "COLLECTOR" || role === "RESIDENT";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const zone_id = needsZone && zoneId ? Number(zoneId) : null;
      if (existing) {
        await api.patch(`/users/${existing.id}`, { full_name: fullName, role, department, zone_id });
        if (password) {
          await api.patch(`/users/${existing.id}/reset-password`, { new_password: password });
        }
      } else {
        if (!username || !password) {
          setError("Username and password are required for a new account.");
          setSubmitting(false);
          return;
        }
        await api.post("/users", { full_name: fullName, username, password, role, department, zone_id });
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't save this account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-graphite-800 border border-graphite-700 rounded-sm p-4 space-y-3">
      <p className="text-sm text-white font-medium">{existing ? `Edit ${existing.full_name}` : "Create a new account"}</p>
      {error && <div className="text-status-critical text-xs">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
            Username {existing && <span className="normal-case text-gray-600">(can't be changed)</span>}
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!!existing}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white disabled:opacity-50"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Department</span>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          />
        </label>
      </div>
      {needsZone && (
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
            {role === "COLLECTOR" ? "Assigned zone (fixed until reshuffled)" : "Zone"}
          </span>
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          >
            <option value="">— Select a zone —</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} {z.bin_count > 0 ? `(${z.bin_count} bins)` : "— no bins yet, add some first"}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">
          {existing ? "Reset password (leave blank to keep current)" : "Password"}
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
          placeholder={existing ? "••••••••" : "At least 6 characters"}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="text-sm bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
        >
          {submitting ? "Saving..." : existing ? "Save changes" : "Create account"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-white px-4 py-2">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
