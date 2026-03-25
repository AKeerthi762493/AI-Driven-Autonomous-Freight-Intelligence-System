import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, PackagePlus, MapPin, BarChart3, FileText,
  Train, ClipboardList, Boxes, Combine, Route, Cpu, Brain,
  LineChart, Bell, CheckSquare, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavItem { label: string; icon: any; path: string; }

const industryNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/industry" },
  { label: "Booking", icon: PackagePlus, path: "/industry/booking" },
  { label: "Tracking", icon: MapPin, path: "/industry/tracking" },
];

const operationsNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/operations" },
  { label: "Demand", icon: ClipboardList, path: "/operations/demand" },
  { label: "Wagons", icon: Boxes, path: "/operations/wagons" },
  { label: "Rake Formation", icon: Combine, path: "/operations/rakes" },
  { label: "Routes", icon: Route, path: "/operations/routes" },
  { label: "Simulation", icon: Cpu, path: "/operations/simulation" },
  { label: "AI Control", icon: Brain, path: "/operations/ai" },
  { label: "Analytics", icon: LineChart, path: "/operations/analytics" },
  { label: "Alerts", icon: Bell, path: "/operations/alerts" },
  { label: "Approvals", icon: CheckSquare, path: "/operations/approvals" },
];

interface AppLayoutProps {
  children: ReactNode;
  portal: "industry" | "operations";
}

export default function AppLayout({ children, portal }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const isDark = portal === "operations";
  const nav = portal === "industry" ? industryNav : operationsNav;

  return (
    <div className={`min-h-svh flex ${isDark ? "dark" : ""}`}>
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-56"} shrink-0 border-r border-border bg-card transition-all duration-300 flex flex-col`}>
        <div className={`p-4 border-b border-border flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-muted-foreground">AFIS</div>
              <div className="text-[10px] text-muted-foreground capitalize">{portal} Portal</div>
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                } ${collapsed ? "justify-center px-2" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-border">
          <button
            onClick={() => navigate("/")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 ${collapsed ? "justify-center px-2" : ""}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-background overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
