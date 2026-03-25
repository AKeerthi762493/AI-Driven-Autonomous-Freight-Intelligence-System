import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "@/components/shared/GlassCard";
import { KPICard } from "@/components/shared/KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { Boxes, MapPin, CheckCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import API from "@/api/axiosConfig";

type WagonFilter = "all"|"available"|"loaded"|"in-transit";

export default function WagonTracking() {
  const [wagons,  setWagons]  = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total:0, available:0, assigned:0, inTransit:0 });
  const [filter,  setFilter]  = useState<WagonFilter>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: WagonFilter = "all") => {
    setLoading(true);
    try {
      const param = f === "all" ? "" : f === "loaded" ? "?status=assigned" : `?status=${f}`;
      const { data } = await API.get(`/wagons${param}`);
      setWagons(data.data.wagons);
      setSummary(data.data.summary);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mapStatus = (s: string) =>
    s === "available" ? "available" : s === "in-transit" ? "in-transit" : "loaded";

  const mapType = (t: string) =>
    ({ flatcar:"BFKN", boxcar:"BOXN", tanker:"BTPN", hopper:"BOBR", gondola:"BCNA" }[t] || "BOXN");

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wagon Tracking</h1>
          <p className="text-sm text-muted-foreground">Fleet position & availability</p>
        </div>
        <AIInsightBanner compact />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Wagons" value={summary.total}     icon={Boxes}       variant="primary"  />
        <KPICard label="Available"    value={summary.available} icon={CheckCircle} variant="success"  delay={0.1} />
        <KPICard label="Loaded"       value={summary.assigned}  icon={Truck}       variant="warning"  delay={0.2} />
        <KPICard label="In Transit"   value={summary.inTransit} icon={MapPin}      variant="primary"  delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Wagon Fleet</h3>
            <div className="flex gap-1">
              {(["all","available","loaded","in-transit"] as WagonFilter[]).map(f => (
                <Button key={f} size="sm" variant={filter===f?"default":"ghost"} className="h-7 text-xs capitalize"
                  onClick={() => { setFilter(f); load(f); }}>
                  {f}
                </Button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}</div>
          ) : wagons.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No wagons found.</p>
          ) : (
            <div className="space-y-2">
              {wagons.map(w => (
                <div key={w._id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <span className="font-mono text-xs font-semibold text-primary w-20">{w.wagonNumber}</span>
                  <span className="text-xs text-muted-foreground w-12">{mapType(w.wagonType)}</span>
                  <StatusBadge status={mapStatus(w.status)} />
                  <span className="text-sm flex-1">{w.currentLocation}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.status === "available" ? "Empty" : `${w.wagonType} - ${w.capacity}T`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden" hover={false}>
          <div className="p-4 border-b border-border/50">
            <h3 className="text-sm font-semibold">Wagon Positions</h3>
          </div>
          <div className="h-[350px]">
            <NetworkMap dark animated showLabels />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}