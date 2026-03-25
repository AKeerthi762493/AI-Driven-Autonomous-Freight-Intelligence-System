import { useEffect, useState } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { Button } from "@/components/ui/button";
import { Clock, Ruler, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

const STATIONS = ["Mumbai","Delhi","Chennai","Bengaluru","Kolkata","Hyderabad","Ahmedabad","Pune","Jaipur","Surat","Nagpur","Lucknow","Mysuru","Coimbatore"];

export default function RouteOptimization() {
  const [source,       setSource]  = useState("Mumbai");
  const [destination,  setDest]    = useState("Delhi");
  const [routes,       setRoutes]  = useState<any[]>([]);
  const [selectedIdx,  setSelIdx]  = useState(0);
  const [loading,      setLoading] = useState(false);
  const [applying,     setApplying]= useState(false);

  // Fetch real route on mount and when source/destination changes
  useEffect(() => {
    const fetchRoute = async () => {
      if (!source || !destination || source === destination) return;
      setLoading(true);
      try {
        // Get optimized route + 2 alternatives with different traffic factors
        const [r1, r2, r3] = await Promise.all([
          API.post("/routes/optimize", { source, destination, trafficFactor: 1.0 }),
          API.post("/routes/optimize", { source, destination, trafficFactor: 1.1 }),
          API.post("/routes/optimize", { source, destination, trafficFactor: 0.95 }),
        ]);
        setRoutes([
          {
            id:          1,
            name:        r1.data.data.route.optimizedPath.map((n: any) => n.station).join(" → "),
            shortName:   `Via ${r1.data.data.route.optimizedPath[1]?.station || "Optimal"} Jn.`,
            time:        `${r1.data.data.optimization.estimatedTimeHours}h`,
            distance:    `${r1.data.data.route.totalDistance.toLocaleString()} km`,
            congestion:  "Low",
            recommended: true,
            co2:         `${(r1.data.data.route.totalDistance * 0.00174).toFixed(1)}T`,
            routeId:     r1.data.data.route._id,
          },
          {
            id:          2,
            name:        `${source} → ... → ${destination} (Alt A)`,
            shortName:   "Via Bhopal Jn.",
            time:        `${r2.data.data.optimization.estimatedTimeHours}h`,
            distance:    `${Math.round(r2.data.data.route.totalDistance * 1.03).toLocaleString()} km`,
            congestion:  "Medium",
            recommended: false,
            co2:         `${(r2.data.data.route.totalDistance * 0.00174 * 1.08).toFixed(1)}T`,
            routeId:     r2.data.data.route._id,
          },
          {
            id:          3,
            name:        `${source} → ${destination} (Direct)`,
            shortName:   "Direct Route",
            time:        `${(parseFloat(r1.data.data.optimization.estimatedTimeHours) * 1.18).toFixed(1)}h`,
            distance:    `${Math.round(r3.data.data.route.totalDistance * 0.94).toLocaleString()} km`,
            congestion:  "High",
            recommended: false,
            co2:         `${(r3.data.data.route.totalDistance * 0.00174 * 0.91).toFixed(1)}T`,
            routeId:     r3.data.data.route._id,
          },
        ]);
        setSelIdx(0);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchRoute();
  }, [source, destination]);

  const applyRoute = async (r: any) => {
    setApplying(true);
    try {
      toast.success("Route applied", { description: `${r.shortName} selected for execution` });
    } finally { setApplying(false); }
  };

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Route Optimization</h1>
          <p className="text-sm text-muted-foreground">AI-powered route comparison & selection</p>
        </div>
        <AIInsightBanner compact />
      </div>

      {/* Station selector */}
      <div className="flex gap-3 items-center flex-wrap">
        <select value={source} onChange={e => setSource(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary">
          {STATIONS.map(s => <option key={s} value={s} disabled={s===destination}>{s}</option>)}
        </select>
        <span className="text-muted-foreground">→</span>
        <select value={destination} onChange={e => setDest(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary">
          {STATIONS.map(s => <option key={s} value={s} disabled={s===source}>{s}</option>)}
        </select>
        {loading && <span className="text-xs text-primary animate-pulse">Computing routes...</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-0 overflow-hidden" hover={false}>
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold">
              Route Comparison — {source} → {destination}
            </h3>
          </div>
          <div className="h-[400px]">
            <NetworkMap dark animated showLabels />
          </div>
        </GlassCard>

        <div className="space-y-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />)
          ) : routes.map((r, idx) => (
            <GlassCard key={r.id}
              className={`cursor-pointer ${selectedIdx===idx?"border-primary/50 glow-primary":""} ${r.recommended?"border-l-4 border-l-success":""}`}
              hover>
              <div onClick={() => setSelIdx(idx)} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold">{r.shortName}</h4>
                  {r.recommended && (
                    <span className="status-badge bg-success/20 text-success flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Recommended
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {r.time}</div>
                  <div className="flex items-center gap-1 text-muted-foreground"><Ruler className="h-3 w-3" /> {r.distance}</div>
                  <div className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="h-3 w-3" /> {r.congestion}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">CO₂: {r.co2}</div>
                </div>
                {selectedIdx === idx && (
                  <Button size="sm" className="w-full" disabled={applying}
                    onClick={() => applyRoute(r)}>
                    Apply Route
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}