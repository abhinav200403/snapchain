import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { RoleGuard } from "@/components/RoleGuard";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Shipments from "./pages/Shipments";
import Suppliers from "./pages/Suppliers";
import Analytics from "./pages/Analytics";
import Predictions from "./pages/Predictions";
import UserManagement from "./pages/UserManagement";
import SettingsPage from "./pages/SettingsPage";
import AuditLog from "./pages/AuditLog";
import ProfilePage from "./pages/ProfilePage";
import BillingPage from "./pages/BillingPage";
import NotFound from "./pages/NotFound";
import VerifyEmailPage from "./pages/VerifyEmailPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inventory" element={<RoleGuard allowed={['admin', 'operations_manager']} fallback={<Navigate to="/dashboard" />}><Inventory /></RoleGuard>} />
              <Route path="/orders" element={<RoleGuard allowed={['admin', 'operations_manager', 'supplier']} fallback={<Navigate to="/dashboard" />}><Orders /></RoleGuard>} />
              <Route path="/shipments" element={<RoleGuard allowed={['admin', 'operations_manager', 'supplier']} fallback={<Navigate to="/dashboard" />}><Shipments /></RoleGuard>} />
              <Route path="/suppliers" element={<RoleGuard allowed={['admin', 'operations_manager']} fallback={<Navigate to="/dashboard" />}><Suppliers /></RoleGuard>} />
              <Route path="/analytics" element={<RoleGuard allowed={['admin', 'business_analyst']} fallback={<Navigate to="/dashboard" />}><Analytics /></RoleGuard>} />
              <Route path="/predictions" element={<RoleGuard allowed={['admin', 'business_analyst']} fallback={<Navigate to="/dashboard" />}><Predictions /></RoleGuard>} />
              <Route path="/users" element={<RoleGuard allowed={['admin']} fallback={<Navigate to="/dashboard" />}><UserManagement /></RoleGuard>} />
              <Route path="/settings" element={<RoleGuard allowed={['admin']} fallback={<Navigate to="/dashboard" />}><SettingsPage /></RoleGuard>} />
              <Route path="/audit-log" element={<RoleGuard allowed={['admin']} fallback={<Navigate to="/dashboard" />}><AuditLog /></RoleGuard>} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/billing" element={<BillingPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
