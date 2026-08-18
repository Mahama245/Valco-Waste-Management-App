import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import ProtectedRoute from "./pages/ProtectedRoute";
import Layout from "./pages/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Collections from "./pages/Collections";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";
import OperationsMap from "./pages/OperationsMap";
import Bins from "./pages/Bins";
import Incidents from "./pages/Incidents";
import ResidentPortal from "./pages/ResidentPortal";
import RoutesPage from "./pages/Routes";
import RouteDetail from "./pages/RouteDetail";
import MyDay from "./pages/MyDay";
import Reports from "./pages/Reports";
import Insights from "./pages/Insights";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="collections" element={<Collections />} />
            <Route path="map" element={<OperationsMap />} />
            <Route path="bins" element={<Bins />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="portal" element={<ResidentPortal />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="routes/:id" element={<RouteDetail />} />
            <Route path="my-day" element={<MyDay />} />
            <Route path="reports" element={<Reports />} />
            <Route path="insights" element={<Insights />} />
            <Route path="users" element={<Users />} />
            <Route path="audit" element={<AuditLog />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
