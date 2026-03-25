import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Train, Boxes, Activity, Gauge, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { GlassCard } from "@/components/shared/GlassCard";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { AIRecommendationsPanel } from "@/components/shared/AIRecommendationsPanel";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { StatusBadge } from "@/components/shared/StatusBadge";
import API from "@/api/axiosConfig";

export default function OperationsDashboard() {
  const [kpi, setKpi]     = useState({ trains: 0, utilization: "0%", congestion: "0", alerts: 0 });
  const [aiRecs, setRecs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, recRes, alertRes] = await Promise.all([
          API.get("/analytics/dashboard"),
          API.get("/ai/recommendations"),
          API.get("/alerts?resolved=false&limit=5"),
        ]);
        const k = aRes.data.data.kpi;
        setKpi({
          trains:      k.activeShipments,
          utilization: `${k.wagonUtilizationRate}%`,
          congestion:  k.criticalAlerts.toString(),
          alerts:      k.activeAlerts,
        });
        // Map to shape AIRecommendationsPanel expects
        setRecs(recRes.data.data.recommendations.slice(0, 3).map((r: any) => ({
          id:          r.id,
          title:       r.title,
          description: r.description,
          impact:      r.estimatedImpact,
          confidence:  r.priority === "critical" ? 94 : r.priority === "high" ? 88 : 79,
          type:        r.type,
        })));
        setAlerts(alertRes.data.data.alerts.map((a: any) => ({
          id:       a._id,
          message:  a.message,
          severity: a.severity === "critical" ? "critical" : a.severity === "warning" ? "high" : "medium",
          time:     new Date(a.timestamp).toLocaleTimeString(),
        })));
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-muted-foreground">Operations Command</h1>
          <p className="text-sm text-muted-foreground">Autonomous Network Orchestration</p>
        </div>
        <AIInsightBanner />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Active Trains"      value={loading ? 0 : kpi.trains}      icon={Train}         variant="primary"     trend={{ value: "+12 today", positive: true }} />
        <KPICard label="Wagon Utilization"  value={loading ? "0%" : kpi.utilization} icon={Boxes}      variant="success"     trend={{ value: "+2.1%", positive: true }}    delay={0.1} />
        <KPICard label="Congestion Index"   value={loading ? "0" : kpi.congestion} icon={Gauge}        variant="warning"     trend={{ value: "-0.4", positive: true }}     delay={0.2} />
        <KPICard label="Active Alerts"      value={loading ? 0 : kpi.alerts}      icon={AlertTriangle} variant="destructive"                                              delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <GlassCard className="lg:col-span-3 p-0 overflow-hidden" hover={false}>
          <div className="p-4 border-b border-border/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Network Overview</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </div>
            </div>
            <span className="text-xs font-mono text-muted-foreground">Current Velocity: 42.8 km/h (+2.1% vs. Baseline)</span>
          </div>
          <div className="h-[400px]">
            <NetworkMap dark animated showLabels />
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard hover={false}>
            <AIRecommendationsPanel recommendations={loading ? [] : aiRecs} />
          </GlassCard>
        </div>
      </div>

      <GlassCard hover={false}>
        <h3 className="text-sm font-semibold mb-4">Critical Alerts</h3>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}</div>
        ) : alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">✅ No active alerts</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <motion.div key={alert.id} initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <div className={`h-2 w-2 rounded-full shrink-0 ${alert.severity==="critical"?"bg-destructive animate-pulse":alert.severity==="high"?"bg-warning":"bg-primary"}`} />
                <span className="text-sm flex-1">{alert.message}</span>
                <StatusBadge status={alert.severity} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.time}</span>
              </motion.div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}