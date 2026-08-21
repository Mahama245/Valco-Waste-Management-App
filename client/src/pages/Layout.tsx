import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, ROLE_LABELS } from "../AuthContext";
import NotificationBell from "../components/NotificationBell";

interface NavItem {
  to: string;
  label: string;
  code: string; // short code echoing the zone/collection code convention used elsewhere in the platform
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Command Center", code: "CC", roles: ["*"] },
  {
    to: "/collections",
    label: "Collections",
    code: "WM",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "COLLECTOR", "CONTRACTOR"],
  },
  {
    to: "/map",
    label: "Operations Map",
    code: "MAP",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "MANAGEMENT"],
  },
  {
    to: "/bins",
    label: "Smart Bins",
    code: "BIN",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "COLLECTOR"],
  },
  {
    to: "/incidents",
    label: "Incidents",
    code: "INC",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "HSE_OFFICER", "COLLECTOR", "DRIVER"],
  },
  {
    to: "/routes",
    label: "Route Management",
    code: "RT",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR"],
  },
  { to: "/my-day", label: "My Day", code: "DAY", roles: ["COLLECTOR"] },
  { to: "/my-vehicle", label: "My Vehicle", code: "VEH", roles: ["DRIVER"] },
  { to: "/portal", label: "My Reports", code: "RES", roles: ["RESIDENT"] },
  {
    to: "/reports",
    label: "Reports & Analytics",
    code: "RPT",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "MANAGEMENT"],
  },
  {
    to: "/insights",
    label: "Smart Insights",
    code: "AI",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER", "SUPERVISOR", "MANAGEMENT"],
  },
  { to: "/users", label: "User Management", code: "USR", roles: ["SUPER_ADMIN", "ICT_ADMIN"] },
  {
    to: "/audit",
    label: "Audit Log",
    code: "LOG",
    roles: ["SUPER_ADMIN", "ICT_ADMIN", "WASTE_MANAGER"],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = NAV_ITEMS.filter((item) => item.roles.includes("*") || item.roles.includes(user.role));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-graphite-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-graphite-800 border-r border-graphite-700 flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-graphite-700">
          <div className="w-1.5 h-6 bg-gold-500" />
          <span className="font-display text-xl font-bold tracking-wide text-white">VALCO</span>
        </div>

        <nav className="flex-1 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2 ${
                  isActive
                    ? "border-gold-500 bg-graphite-700/60 text-white"
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-graphite-700/30"
                }`
              }
            >
              <span className="font-mono text-[10px] text-gold-500/70 w-6">{item.code}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-graphite-700">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">DEMO DATA</p>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Figures shown are simulated for demonstration purposes.
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-graphite-800/60 border-b border-graphite-700 flex items-center justify-between px-6 shrink-0">
          <div />
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right">
              <p className="text-sm text-white leading-tight">{user.fullName}</p>
              <p className="text-[11px] text-gold-500 leading-tight">{ROLE_LABELS[user.role] || user.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-graphite-600 flex items-center justify-center text-sm font-semibold text-white">
              {user.fullName
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-status-critical border border-graphite-600 hover:border-status-critical/50 rounded-sm px-3 py-1.5 transition-colors"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
