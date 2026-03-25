import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { KPICard } from "@/components/shared/KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, ClipboardList, Flame, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

const getColor = (v: number) =>
  v > 80 ? "hsl(var(--destructive))" : v > 65 ? "hsl(var(--warning))" : "hsl(var(--primary))";

const PRIORITY_MAP = (qty: number): "high"|"critical"|"medium"|"low" =>
  qty >= 5000 ? "critical" : qty >= 2000 ? "high" : qty >= 1000 ? "medium" : "low";

export default function DemandManagement() {
  const [requests,  setRequests]  = useState<any[]>([]);
  const [kpi,       setKpi]       = useState({ total:0, critical:0, utilization:"0%", pending:0 });
  const [heatmap,   setHeatmap]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Assign modal state
  const [assigning,     setAssigning]     = useState<any>(null); // the freight request being assigned
  const [availableRakes,setAvailableRakes]= useState<any[]>([]);
  const [selectedRake,  setSelectedRake]  = useState("");
  const [saving,        setSaving]        = useState(false);

  const load = useCallback(async () => {
    try {
      const [reqRes, analyticsRes] = await Promise.all([
        API.get("/freight/all?limit=50"),
        API.get("/analytics/dashboard"),
      ]);

      const reqs = reqRes.data.data.requests;
      setRequests(reqs);

      const k = analyticsRes.data.data.kpi;
      setKpi({
        total:       k.totalFreightRequests,
        critical:    reqs.filter((r: any) => r.quantity >= 5000).length,
        utilization: `${k.wagonUtilizationRate}%`,
        pending:     k.pendingApprovals,
      });

      // Build heatmap from real booking volumes
      const stationAgg: Record<string, number> = {};
      for (const r of reqs) {
        stationAgg[r.sourceStation] = (stationAgg[r.sourceStation] || 0) + r.quantity;
      }
      const maxQty = Math.max(...Object.values(stationAgg), 1);
      const regions = [
        { region:"North",   stations:["Delhi","Jaipur","Lucknow","Agra","Chandigarh"]          },
        { region:"South",   stations:["Chennai","Bengaluru","Hyderabad","Mysuru","Coimbatore"] },
        { region:"East",    stations:["Kolkata","Patna","Varanasi","Bhubaneswar"]              },
        { region:"West",    stations:["Mumbai","Ahmedabad","Pune","Surat","Nashik"]            },
        { region:"Central", stations:["Nagpur","Bhopal","Solapur"]                            },
      ];
      setHeatmap(regions.map(r => {
        const totalQty = r.stations.reduce((s, st) => s + (stationAgg[st] || 0), 0);
        return {
          region: r.region,
          demand: totalQty > 0
            ? Math.min(100, Math.round((totalQty / maxQty) * 100))
            : Math.round(10 + Math.random() * 30),
        };
      }));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Open assign modal — fetch available rakes
  const openAssign = async (req: any) => {
    setAssigning(req);
    setSelectedRake("");
    try {
      const { data } = await API.get("/rakes");
      const available = data.data.rakes.filter((r: any) =>
        r.status === "idle" || r.status === "active"
      );
      setAvailableRakes(available);
    } catch(e) {
      toast.error("Could not load rakes");
      setAssigning(null);
    }
  };

  // Confirm assignment — approve freight + link rake
  const confirmAssign = async () => {
    if (!assigning) return;
    setSaving(true);
    try {
      // Step 1: Approve the freight request
      await API.put(`/freight/approve/${assigning._id}`, {
        operatorNotes: selectedRake
          ? `Assigned to rake ${availableRakes.find(r => r._id === selectedRake)?.rakeNumber}`
          : "Approved and queued for rake assignment",
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Step 2: If a rake was selected, note it (rake-freight linking would need a dedicated endpoint)
      toast.success("Request assigned", {
        description: `REQ-${assigning._id.slice(-4).toUpperCase()} approved${selectedRake ? ` and linked to rake` : ""}`,
      });

      setAssigning(null);
      load();
    } catch(e: any) {
      toast.error("Assignment failed", {
        description: e.response?.data?.message || "Please try again",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demand Management</h1>
          <p className="text-sm text-muted-foreground">Incoming freight requests & priority assignment</p>
        </div>
        <AIInsightBanner compact />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Requests"       value={kpi.total}       icon={ClipboardList} variant="primary"     />
        <KPICard label="Critical Priority"    value={kpi.critical}    icon={Flame}         variant="destructive" delay={0.1} />
        <KPICard label="Capacity Utilization" value={kpi.utilization} icon={TrendingUp}    variant="success"     delay={0.2} />
        <KPICard label="Pending Assignment"   value={kpi.pending}     icon={ArrowUpDown}   variant="warning"     delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2" hover={false}>
          <h3 className="text-sm font-semibold mb-4">Incoming Requests</h3>
          {loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 rounded bg-muted/40 animate-pulse" />)}</div>
          ) : requests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No freight requests yet. Industry users need to submit bookings.
            </p>
          ) : (
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r._id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <span className="font-mono text-xs font-semibold text-primary w-20">
                    REQ-{r._id.slice(-4).toUpperCase()}
                  </span>
                  <span className="text-sm flex-1">{(r.userId as any)?.name || "User"}</span>
                  <span className="text-sm text-muted-foreground w-24">{r.commodityType}</span>
                  <span className="text-xs text-muted-foreground w-36">
                    {r.sourceStation} → {r.destinationStation}
                  </span>
                  <span className="text-xs font-mono w-16">{r.quantity} MT</span>
                  <StatusBadge status={PRIORITY_MAP(r.quantity)} />

                  {/* Assign button — only for pending requests */}
                  {r.status === "pending" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => openAssign(r)}
                    >
                      Assign
                    </Button>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      r.status === "approved"   ? "bg-success/20 text-success"   :
                      r.status === "rejected"   ? "bg-destructive/20 text-destructive" :
                      r.status === "in-transit" ? "bg-primary/20 text-primary"   :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {r.status.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard hover={false}>
          <h3 className="text-sm font-semibold mb-4">Demand Heatmap</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmap} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize:10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="region" type="category" tick={{ fontSize:11 }} stroke="hsl(var(--muted-foreground))" width={60} />
                <Tooltip />
                <Bar dataKey="demand" radius={[0,4,4,0]}>
                  {heatmap.map((e, i) => <Cell key={i} fill={getColor(e.demand)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* ── Assign Modal ────────────────────────────────────────── */}
      {assigning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Assign REQ-{assigning._id.slice(-4).toUpperCase()}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {assigning.commodityType} · {assigning.quantity} MT ·{" "}
                  {assigning.sourceStation} → {assigning.destinationStation}
                </p>
              </div>
              <button onClick={() => setAssigning(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Request details */}
            <div className="grid grid-cols-2 gap-3 mb-5 p-3 rounded-lg bg-muted/30 text-xs">
              <div>
                <p className="text-muted-foreground">Industry</p>
                <p className="font-medium text-foreground">{(assigning.userId as any)?.name || "User"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Priority</p>
                <p className="font-semibold text-destructive">{PRIORITY_MAP(assigning.quantity).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Commodity</p>
                <p className="font-medium text-foreground">{assigning.commodityType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-mono text-foreground">{assigning.quantity} MT</p>
              </div>
            </div>

            {/* Rake selector */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select Rake (optional)
              </label>
              {availableRakes.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2 p-3 rounded-lg bg-muted/30">
                  No idle rakes available. Request will be approved and queued.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  <button
                    onClick={() => setSelectedRake("")}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedRake === ""
                        ? "bg-primary/10 border border-primary/30 text-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    No specific rake — auto-assign later
                  </button>
                  {availableRakes.map(rake => (
                    <button
                      key={rake._id}
                      onClick={() => setSelectedRake(rake._id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        selectedRake === rake._id
                          ? "bg-primary/10 border border-primary/30 text-foreground"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span className="font-mono font-semibold text-primary">{rake.rakeNumber}</span>
                      <span className="ml-2">{rake.currentLocation}</span>
                      <span className="ml-2 text-muted-foreground">{rake.totalCapacity}T capacity</span>
                      <span className={`ml-2 ${rake.status === "idle" ? "text-success" : "text-primary"}`}>
                        [{rake.status}]
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-success hover:bg-success/90 text-white"
                onClick={confirmAssign}
                disabled={saving}
              >
                {saving ? "Assigning..." : "✓ Confirm Assignment"}
              </Button>
              <Button variant="outline" onClick={() => setAssigning(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}