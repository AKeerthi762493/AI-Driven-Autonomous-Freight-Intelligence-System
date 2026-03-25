import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { NetworkMap } from "@/components/shared/NetworkMap";
import API from "@/api/axiosConfig";

// Map backend status → StatusBadge status string
const mapStatus = (s: string) => {
  if (s === "in-transit")  return "in-transit";
  if (s === "approved")    return "on-time";
  if (s === "rejected")    return "delayed";
  if (s === "delivered")   return "delivered";
  return "pending";
};

// Compute progress % from tracking events + status
const computeProgress = (req: any): number => {
  if (req.status === "delivered")  return 100;
  if (req.status === "in-transit") return 68;
  if (req.status === "approved")   return 30;
  if (req.status === "pending")    return 10;
  return 0;
};

export default function ShipmentTracking() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [selected, setSelected]   = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    API.get("/freight/my-requests?limit=20")
      .then(({ data }) => {
        const reqs: any[] = data.data.requests;
        const mapped = reqs.map(r => ({
          id:          r._id.slice(-6).toUpperCase(),
          _id:         r._id,
          commodity:   r.commodityType,
          origin:      r.sourceStation,
          destination: r.destinationStation,
          eta:         r.estimatedDelivery
            ? "Mar " + new Date(r.estimatedDelivery).getDate() + " " +
              new Date(r.estimatedDelivery).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "TBD TBD",
          status:          mapStatus(r.status),
          progress:        computeProgress(r),
          trackingEvents:  r.trackingEvents || [],
          rawStatus:       r.status,
        }));
        setShipments(mapped);
        if (mapped.length > 0) setSelected(mapped[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build timeline from real tracking events
  const buildTimeline = (s: any) => {
    if (!s) return [];

    const events = s.trackingEvents;
    const departed = events.find((e: any) =>
      e.event.toLowerCase().includes("created") || e.event.toLowerCase().includes("departed")
    );
    const inTransit = events.find((e: any) =>
      e.event.toLowerCase().includes("transit") || e.event.toLowerCase().includes("approved")
    );
    const arrived = events.find((e: any) =>
      e.event.toLowerCase().includes("delivered") || e.event.toLowerCase().includes("arrived")
    );

    return [
      {
        label: "Departed",
        time:  departed
          ? new Date(departed.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
          : "Pending",
        done:   !!departed,
        active: false,
      },
      {
        label:  "In Transit",
        time:   inTransit ? "Current" : "Pending",
        done:   ["in-transit", "on-time", "delivered"].includes(s.status),
        active: s.status === "in-transit" || s.status === "on-time",
      },
      {
        label: "Arrival",
        time:  s.eta !== "TBD TBD"
          ? `ETA: ${s.eta.split(" ")[1] || s.eta}`
          : arrived
            ? new Date(arrived.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "TBD",
        done:   s.status === "delivered",
        active: false,
      },
    ];
  };

  const timelineSteps = buildTimeline(selected);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Shipment Tracking</h1>
            <p className="text-sm text-muted-foreground">Real-time freight monitoring</p>
          </div>
          <AIInsightBanner compact />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />
          <div className="lg:col-span-2 h-64 rounded-xl bg-muted/50 animate-pulse" />
          <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />
        </div>
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Shipment Tracking</h1>
            <p className="text-sm text-muted-foreground">Real-time freight monitoring</p>
          </div>
          <AIInsightBanner compact />
        </div>
        <GlassCard hover={false}>
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No shipments to track yet.</p>
            <a href="/industry/booking" className="text-primary text-xs underline mt-2 block">
              Book your first shipment →
            </a>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shipment Tracking</h1>
          <p className="text-sm text-muted-foreground">Real-time freight monitoring</p>
        </div>
        <AIInsightBanner compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Shipment list */}
        <GlassCard className="lg:col-span-1 p-3" hover={false}>
          <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground px-2 mb-3">
            Shipments
          </h3>
          <div className="space-y-1">
            {shipments.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className={`w-full text-left p-3 rounded-lg transition-all text-sm ${
                  selected?.id === s.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-semibold">{s.id}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">{s.commodity}</div>
                <div className="text-xs text-muted-foreground">{s.origin} → {s.destination}</div>
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Map */}
        <GlassCard className="lg:col-span-2 p-0 overflow-hidden" hover={false}>
          <div className="p-4 border-b border-border/50 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold">
                {selected?.id} — {selected?.commodity}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selected?.origin} → {selected?.destination}
              </p>
            </div>
            {selected && <StatusBadge status={selected.status} />}
          </div>
          <div className="h-[400px] bg-background/50">
            <NetworkMap dark={false} animated showLabels />
          </div>
        </GlassCard>

        {/* Timeline & Details */}
        <GlassCard className="lg:col-span-1" hover={false}>
          <h3 className="text-sm font-semibold mb-4">Journey Timeline</h3>
          <div className="space-y-0">
            {timelineSteps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full border-2 ${
                    step.done
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  } ${step.active ? "animate-pulse-glow" : ""}`} />
                  {i < timelineSteps.length - 1 && (
                    <div className={`w-0.5 h-12 ${step.done ? "bg-primary/50" : "bg-border"}`} />
                  )}
                </div>
                <div className="pb-6">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Progress
            </h4>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${selected?.progress ?? 0}%` }}
                className="h-full bg-primary rounded-full"
                transition={{ duration: 1, ease: [0.2, 0, 0, 1] }}
              />
            </div>
            <div className="text-right font-mono text-xs text-primary font-semibold">
              {selected?.progress ?? 0}%
            </div>

            {selected?.status === "delayed" && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
                <div className="flex items-center gap-1 text-destructive font-semibold mb-1">
                  <AlertTriangle className="h-3 w-3" /> Delay Detected
                </div>
                <p className="text-muted-foreground">
                  This shipment was rejected or delayed. Check operator notes.
                </p>
              </div>
            )}

            {/* Real tracking events */}
            {selected?.trackingEvents?.length > 0 && (
              <div className="pt-3 border-t border-border/40">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Events
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selected.trackingEvents.slice().reverse().map((ev: any, i: number) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <p className="text-foreground">{ev.event}</p>
                        <p className="text-muted-foreground">
                          {new Date(ev.timestamp).toLocaleString("en-IN", {
                            day: "2-digit", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}