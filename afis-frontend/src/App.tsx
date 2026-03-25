import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import IndustryDashboard from "@/pages/industry/Dashboard";
import FreightBooking from "@/pages/industry/Booking";
import ShipmentTracking from "@/pages/industry/Tracking";
import OperationsDashboard from "@/pages/operations/Dashboard";
import DemandManagement from "@/pages/operations/DemandManagement";
import WagonTracking from "@/pages/operations/WagonTracking";
import RakeFormation from "@/pages/operations/RakeFormation";
import RouteOptimization from "@/pages/operations/RouteOptimization";
import DigitalTwin from "@/pages/operations/DigitalTwin";
import AIControl from "@/pages/operations/AIControl";
import Analytics from "@/pages/operations/Analytics";
import Alerts from "@/pages/operations/Alerts";
import ApprovalWorkflow from "@/pages/operations/ApprovalWorkflow";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "industry" | "operator";
}) => {
  const token = localStorage.getItem("afis_token");
  const user  = JSON.parse(localStorage.getItem("afis_user") || "null");

  if (!token || !user) return <Navigate to="/" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public — both "/" and "/login" show the login page */}
          <Route path="/"      element={<Login />} />
          <Route path="/login" element={<Login />} />

          {/* Industry Portal — role: industry only */}
          <Route path="/industry" element={
            <ProtectedRoute requiredRole="industry">
              <AppLayout portal="industry"><IndustryDashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/industry/booking" element={
            <ProtectedRoute requiredRole="industry">
              <AppLayout portal="industry"><FreightBooking /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/industry/tracking" element={
            <ProtectedRoute requiredRole="industry">
              <AppLayout portal="industry"><ShipmentTracking /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Operations Portal — role: operator only */}
          <Route path="/operations" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><OperationsDashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/demand" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><DemandManagement /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/wagons" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><WagonTracking /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/rakes" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><RakeFormation /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/routes" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><RouteOptimization /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/simulation" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><DigitalTwin /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/ai" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><AIControl /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/analytics" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><Analytics /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/alerts" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><Alerts /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/operations/approvals" element={
            <ProtectedRoute requiredRole="operator">
              <AppLayout portal="operations"><ApprovalWorkflow /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;