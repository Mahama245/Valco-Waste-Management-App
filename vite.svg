import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  // Render's free tier can take 50+ seconds to wake a sleeping service on
  // its first request. A short default timeout would misreport that delay
  // as "can't contact the server" when it's actually just waking up.
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("valco_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("valco_token");
      localStorage.removeItem("valco_user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    // No response at all (network error, CORS block, timeout) — attach a
    // clearer message so screens don't just say a generic "couldn't
    // connect" with no explanation of what's actually likely happening.
    if (!err.response) {
      err.friendlyMessage =
        "Couldn't reach the server. If this is the first request in a while, the server may be waking up — please wait a moment and try again.";
    }
    return Promise.reject(err);
  }
);

export interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
}
