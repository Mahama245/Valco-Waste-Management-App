import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

interface Zone {
  id: number;
  name: string;
}

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Zones are public-ish reference data needed for signup, but the zones
    // endpoint requires auth — fall back gracefully if it's not reachable
    // pre-login (zone selection just becomes optional in that case).
    api.get("/zones").then((res) => setZones(res.data.zones)).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/register", {
        full_name: fullName.trim(),
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        zone_id: zoneId || undefined,
      });
      await login(username.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-graphite-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-2 h-8 bg-gold-500" />
            <span className="font-display text-3xl font-bold tracking-wide text-white">VALCO</span>
          </div>
          <p className="font-display text-sm tracking-[0.25em] text-gold-500 uppercase">Resident Sign Up</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-graphite-800 border border-graphite-700 rounded-sm p-8 shadow-2xl">
          <h1 className="font-display text-xl font-semibold text-white mb-1">Create your account</h1>
          <p className="text-sm text-gray-400 mb-6">
            For residents to report collection issues and track waste pickup in your area.
          </p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-status-criticalBg border border-status-critical/40 text-status-critical text-sm rounded-sm">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white placeholder-gray-500 focus:border-gold-500 outline-none"
              placeholder="Kofi Adjei"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Username</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white placeholder-gray-500 focus:border-gold-500 outline-none"
              placeholder="kofi.adjei"
            />
          </label>

          <label className="block mb-4">
            <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white placeholder-gray-500 focus:border-gold-500 outline-none"
              placeholder="kofi@example.com"
            />
          </label>

          {zones.length > 0 && (
            <label className="block mb-4">
              <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Your area</span>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white focus:border-gold-500 outline-none"
              >
                <option value="">Select your zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="block mb-6">
            <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white placeholder-gray-500 focus:border-gold-500 outline-none"
              placeholder="At least 6 characters"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold py-2.5 rounded-sm"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="mt-6 text-xs text-gray-500 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-gold-500 hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
