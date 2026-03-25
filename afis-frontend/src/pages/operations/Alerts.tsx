import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { Bell, AlertTriangle, Activity, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

type AlertFilter = "all"|"delay"|"congestion"|"maintenance";

const iconMap: Record<string, any> = { delay:AlertTriangle, congestion:Activity, maintenance:Wrench };

const mapCategory = (cat: string): AlertFilter => {
  if (cat === "route")       return "delay";
  if (cat === "wagon")       return "congestion";
  if (cat === "maintenance") return "maintenance";
  return "delay";
};

export default function Alerts() {
  const [alerts,   setAlerts]  = useState<any[]>([]);
  const [filter,   setFilter]  = useState<AlertFilter>("all");
  const [loading,  setLoading] = useState(true);
  const [resolving,setResolving] = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/alerts?resolved=false&limit=50");
      // Deduplicate by message prefix
      const seen = new Set<string>();
      const unique = data.data.alerts.filter((a: any) => {
        const k = a.message.slice(0, 50);
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      setAlerts(unique.map((a: any) => ({
        id:       a._id,
        message:  a.message,
        severity: a.severity === "critical" ? "critical" : a.severity === "warning" ? "high" : "medium",
        type:     mapCategory(a.category),
        time:     new Date(a.timestamp).toLocaleTimeString(),
      })));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledge = async (id: string) => {
    setResolving(id);
    try {
      await API.put(`/alerts/${id}/resolve`);
      toast.success("Alert acknowledged");
      load();
    } catch(e: any) {
      toast.error("Failed", { description: e.response?.data?.message });
    } finally { setResolving(null); }
  };

  const filtered = filter === "all" ? alerts : alerts.filter(a => a.type === filter);

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts & Notifications</h1>
          <p className="text-sm text-muted-foreground">Real-time operational alerts</p>
        </div>
        <AIInsightBanner compact />
      </div>

      <div className="flex gap-2">
        {(["all","delay","congestion","maintenance"] as AlertFilter[]).map(f => (
          <Button key={f} size="sm" variant={filter===f?"default":"ghost"} className="capitalize text-xs h-8" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="text-xs h-8 ml-auto" onClick={load}>🔄 Refresh</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <GlassCard hover={false}>
          <div className="text-center py-12">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} alerts at this time.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert, i) => {
            const Icon = iconMap[alert.type] || AlertTriangle;
            return (
              <motion.div key={alert.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}>
                <GlassCard className={alert.severity==="critical"?"border-destructive/30 glow-destructive":""} hover>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${alert.severity==="critical"?"bg-destructive/10":alert.severity==="high"?"bg-warning/10":"bg-primary/10"}`}>
                      <Icon className={`h-5 w-5 ${alert.severity==="critical"?"text-destructive":alert.severity==="high"?"text-warning":"text-primary"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <StatusBadge status={alert.severity} />
                        <span className="text-xs text-muted-foreground">{alert.time}</span>
                        <span className="status-badge bg-muted text-muted-foreground capitalize">{alert.type}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs"
                      disabled={resolving === alert.id}
                      onClick={() => acknowledge(alert.id)}>
                      {resolving === alert.id ? "..." : "Acknowledge"}
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}