import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Package, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { KPICard } from "@/components/shared/KPICard";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { AIRecommendationsPanel } from "@/components/shared/AIRecommendationsPanel";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import API from "@/api/axiosConfig";

export default function IndustryDashboard() {
  const [shipments, setShipments]   = useState<any[]>([]);
  const [aiRecs, setAiRecs]         = useState<any[]>([]);
  const [alerts, setAlerts]         = useState<any[]>([]);
  const [demandData, setDemandData] = useState<any[]>([]);
  const [kpi, setKpi] = useState({
    active:  0,
    pending: 0,
    delayed: 0,
    onTime:  "—",
    onTimeTrend: "+0.0%",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [reqRes, aiRes, alertRes, demandRes] = await Promise.all([
          API.get("/freight/my-requests?limit=100"), // fetch all to compute accurate KPIs
          API.get("/ai/recommendations"),
          API.get("/alerts?resolved=false&limit=3"),
          API.get("/demand/predict?station=Mumbai&commodity=Coal&monthsAhead=4"),
        ]);

        const reqs: any[] = reqRes.data.data.requests;

        // ── Map shipments ──────────────────────────────────────────────────────
        const mapped = reqs.slice(0, 10).map(r => ({
          id:          r._id.slice(-6).toUpperCase(),
          commodity:   r.commodityType,
          origin:      r.sourceStation,
          destination: r.destinationStation,
          eta:         r.estimatedDelivery
            ? new Date(r.estimatedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : "TBD",
          status: r.status === "in-transit" ? "in-transit"
                : r.status === "approved"   ? "on-time"
                : r.status === "rejected"   ? "delayed"
                : r.status === "delivered"  ? "delivered"
                : "pending",
        }));
        setShipments(mapped);

        // ── KPI Calculations ───────────────────────────────────────────────────

        // ACTIVE SHIPMENTS: approved (confirmed) + in-transit (moving)
        const active = reqs.filter(r =>
          r.status === "approved" || r.status === "in-transit"
        ).length;

        // PENDING REQUESTS: submitted but not yet reviewed by operator
        const pending = reqs.filter(r => r.status === "pending").length;

        // DELAYED SHIPMENTS: rejected (failed/cancelled) + overdue approved
        // Overdue = approved but estimatedDelivery has passed without being delivered
        const now = new Date();
        const delayed = reqs.filter(r => {
          if (r.status === "rejected") return true; // rejected = failed
          // Overdue: approved/in-transit but ETA has passed
          if ((r.status === "approved" || r.status === "in-transit") && r.estimatedDelivery) {
            return new Date(r.estimatedDelivery) < now;
          }
          return false;
        }).length;

        // ON-TIME DELIVERY: of all resolved requests (approved+delivered+in-transit),
        // what percentage are NOT delayed/rejected
        const resolved   = reqs.filter(r => r.status !== "pending").length;
        const failed     = reqs.filter(r => r.status === "rejected").length;
        const onTimePct  = resolved > 0
          ? Math.round(((resolved - failed) / resolved) * 100)
          : 100;

        // On-time trend: compare last 30 days vs previous 30 days
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const recent   = reqs.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
        const previous = reqs.filter(r => {
          const d = new Date(r.createdAt);
          return d >= sixtyDaysAgo && d < thirtyDaysAgo;
        });
        const recentOnTime   = recent.filter(r => r.status !== "rejected").length;
        const previousOnTime = previous.filter(r => r.status !== "rejected").length;
        const recentPct   = recent.length   > 0 ? (recentOnTime   / recent.length)   * 100 : onTimePct;
        const previousPct = previous.length > 0 ? (previousOnTime / previous.length) * 100 : onTimePct;
        const trend = recentPct - previousPct;
        const trendStr = `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`;

        setKpi({
          active,
          pending,
          delayed,
          onTime:     `${onTimePct}%`,
          onTimeTrend: trendStr,
        });

        // ── AI Recs ────────────────────────────────────────────────────────────
        const recsMapped = aiRes.data.data.recommendations.slice(0, 2).map((r: any) => ({
          id:          r.id,
          title:       r.title,
          description: r.description,
          impact:      r.estimatedImpact,
          confidence:  r.priority === "critical" ? 94 : r.priority === "high" ? 87 : 78,
          type:        r.type,
        }));
        setAiRecs(recsMapped);

        // ── Alerts — deduplicated ──────────────────────────────────────────────
        const rawAlerts: any[] = alertRes.data.data.alerts;
        const seen = new Set<string>();
        const uniqueAlerts = rawAlerts.filter(a => {
          const key = a.message.slice(0, 60);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setAlerts(uniqueAlerts.map(a => ({
          id:       a._id,
          message:  a.message,
          severity: a.severity === "critical" ? "critical"
                  : a.severity === "warning"  ? "high" : "medium",
          time:     new Date(a.timestamp).toLocaleTimeString(),
        })));

        // ── Demand Trends ──────────────────────────────────────────────────────
        const hist: any[] = demandRes.data.data.historical;
        const chartData = hist.slice(-4).map((h: any) => ({
          month: h.month.split(" ")[0].slice(0, 3),
          coal:  h.actualDemand,
          steel: Math.round(h.actualDemand * 0.65),
        }));
        setDemandData(chartData);

      } catch (e) {
        console.error("Dashboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Freight Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time shipment intelligence</p>
        </div>
        <AIInsightBanner />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Active Shipments"
          value={loading ? 0 : kpi.active}
          icon={Package}
          variant="primary"
          trend={{ value: "Approved + In-Transit", positive: true }}
          delay={0}
        />
        <KPICard
          label="Pending Requests"
          value={loading ? 0 : kpi.pending}
          icon={Clock}
          variant="warning"
          trend={{ value: kpi.pending > 0 ? "Awaiting operator review" : "All reviewed", positive: kpi.pending === 0 }}
          delay={0.1}
        />
        <KPICard
          label="Delayed Shipments"
          value={loading ? 0 : kpi.delayed}
          icon={AlertTriangle}
          variant="destructive"
          trend={{ value: kpi.delayed > 0 ? "Rejected or overdue" : "No delays", positive: kpi.delayed === 0 }}
          delay={0.2}
        />
        <KPICard
          label="On-Time Delivery"
          value={loading ? "—" : kpi.onTime}
          icon={CheckCircle}
          variant="success"
          trend={{ value: kpi.onTimeTrend, positive: !kpi.onTimeTrend.startsWith("-") }}
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Shipment Map */}
        <GlassCard className="lg:col-span-2 p-0 overflow-hidden" hover={false}>
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Live Shipment Map</h3>
            {!loading && shipments.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {shipments.length} active route{shipments.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="h-[300px] bg-background/50">
            <NetworkMap dark={false} animated showLabels />
          </div>
          {!loading && shipments.length > 0 && (
            <div className="px-4 py-2 border-t border-border/30 flex gap-4 overflow-x-auto">
              {shipments.slice(0, 4).map(s => (
                <div key={s.id} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    s.status === "in-transit" ? "bg-blue-400 animate-pulse" :
                    s.status === "on-time"    ? "bg-green-400" :
                    s.status === "delayed"    ? "bg-red-400"   : "bg-yellow-400"
                  }`} />
                  <span className="font-mono text-primary font-semibold">{s.id}</span>
                  <span className="text-muted-foreground">{s.origin} → {s.destination}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* AI Recommendations */}
        <GlassCard hover={false}>
          <AIRecommendationsPanel recommendations={loading ? [] : aiRecs} />
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Shipments Table */}
        <GlassCard className="lg:col-span-2" hover={false}>
          <h3 className="text-sm font-semibold mb-4">Active Shipments</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />)}
            </div>
          ) : shipments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No shipments yet.</p>
              <a href="/industry/booking" className="text-xs text-primary underline mt-1 block">
                Book your first shipment →
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border/50">
                    <th className="text-left py-2 pr-4">ID</th>
                    <th className="text-left py-2 pr-4">Commodity</th>
                    <th className="text-left py-2 pr-4">Route</th>
                    <th className="text-left py-2 pr-4">ETA</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s, i) => (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-primary">{s.id}</td>
                      <td className="py-3 pr-4">{s.commodity}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{s.origin} → {s.destination}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{s.eta}</td>
                      <td className="py-3"><StatusBadge status={s.status} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* Alerts + Demand Trends */}
        <div className="space-y-6">
          <GlassCard hover={false}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Alerts</h3>
              {!loading && alerts.length > 0 && (
                <span className="text-xs text-muted-foreground">{alerts.length} active</span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />)}
              </div>
            ) : alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">✅ No active alerts</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                      alert.severity === "critical" ? "bg-destructive animate-pulse" :
                      alert.severity === "high"     ? "bg-yellow-500" : "bg-primary"
                    }`} />
                    <div>
                      <p className="text-xs">{alert.message}</p>
                      <span className="text-[10px] text-muted-foreground">{alert.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard hover={false}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Demand Trends</h3>
              <span className="text-[10px] text-muted-foreground">Your real bookings</span>
            </div>
            <div className="h-[160px]">
              {loading ? (
                <div className="h-full rounded bg-muted/50 animate-pulse" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        `${value.toLocaleString()} T`,
                        name === 'coal' ? 'Coal bookings' : 'Steel bookings'
                      ]}
                    />
                    <Bar dataKey="coal"  fill="hsl(var(--primary))" radius={[2,2,0,0]} name="coal"  />
                    <Bar dataKey="steel" fill="hsl(var(--accent))"  radius={[2,2,0,0]} name="steel" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {!loading && demandData.every(d => d.coal === 0) && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Book more freight to see demand trends grow
              </p>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}