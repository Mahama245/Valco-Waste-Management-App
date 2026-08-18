import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-graphite-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* subtle industrial backdrop grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#C9A24B 1px, transparent 1px), linear-gradient(90deg, #C9A24B 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-2 h-8 bg-gold-500" />
            <span className="font-display text-3xl font-bold tracking-wide text-white">VALCO</span>
          </div>
          <p className="font-display text-sm tracking-[0.25em] text-gold-500 uppercase">
            Waste Management &amp; Environmental Operations
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-graphite-800 border border-graphite-700 rounded-sm p-8 shadow-2xl"
        >
          <h1 className="font-display text-xl font-semibold text-white mb-1">Sign in</h1>
          <p className="text-sm text-gray-400 mb-6">Enter your credentials to access the operations platform.</p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-status-criticalBg border border-status-critical/40 text-status-critical text-sm rounded-sm">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white placeholder-gray-500 focus:border-gold-500 outline-none transition-colors"
              placeholder="e.g. supervisor"
            />
          </label>

          <label className="block mb-6">
            <span className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-3 py-2.5 text-white placeholder-gray-500 focus:border-gold-500 outline-none transition-colors"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold py-2.5 rounded-sm transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-6 text-xs text-gray-500 leading-relaxed border-t border-graphite-700 pt-4">
            Demo accounts (password: <span className="font-mono text-gray-400">Demo@2026</span>): superadmin,
            wastemanager, supervisor, hseofficer, collector1, resident1
          </p>
        </form>
      </div>
    </div>
  );
}
