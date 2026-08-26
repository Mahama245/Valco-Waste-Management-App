import { useState } from "react";
import { api } from "../api";

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      setSuccess(true);
    } catch (err: any) {
      setError(err.friendlyMessage || err.response?.data?.error || "Couldn't change your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-graphite-800 border border-graphite-700 rounded-sm p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-medium">Change Password</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <p className="text-status-success text-sm mb-4">Password changed successfully.</p>
            <button
              onClick={onClose}
              className="text-sm bg-gold-500 hover:bg-gold-400 text-graphite-950 font-semibold px-4 py-2 rounded-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && <div className="text-status-critical text-xs">{error}</div>}
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Current password</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">New password</span>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
                placeholder="At least 6 characters"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Confirm new password</span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-graphite-900 border border-graphite-600 rounded-sm px-2 py-1.5 text-sm text-white"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full text-sm bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-graphite-950 font-semibold py-2 rounded-sm"
            >
              {submitting ? "Saving..." : "Change Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
