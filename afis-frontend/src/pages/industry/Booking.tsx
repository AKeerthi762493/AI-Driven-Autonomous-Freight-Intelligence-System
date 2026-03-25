import { useState, useEffect } from "react";
import { Brain, ArrowRight, Calendar, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/GlassCard";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { NetworkMap } from "@/components/shared/NetworkMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

const STATIONS = [
  "Mumbai","Delhi","Chennai","Bengaluru","Kolkata","Hyderabad",
  "Ahmedabad","Pune","Jaipur","Surat","Nagpur","Lucknow",
  "Patna","Varanasi","Mysuru","Coimbatore","Bhubaneswar",
  "Vijayawada","Solapur","Nashik","Chandigarh","Agra",
];
const COMMODITIES = [
  { value:"Steel",      label:"Steel Coils" },
  { value:"Coal",       label:"Coal"         },
  { value:"Cement",     label:"Cement"       },
  { value:"Petroleum",  label:"Petroleum"    },
  { value:"Fertilizer", label:"Fertilizer"   },
  { value:"Grains",     label:"Grains"       },
  { value:"Containers", label:"Containers"   },
];

export default function FreightBooking() {
  const [source,     setSource]     = useState("");
  const [destination,setDest]       = useState("");
  const [commodity,  setCommodity]  = useState("");
  const [quantity,   setQuantity]   = useState("");
  const [date,       setDate]       = useState("");
  const [priority,   setPriority]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [route,        setRoute]    = useState<any>(null);
  const [routeLoading, setRouteLoad]= useState(false);
  const [routeErr,     setRouteErr] = useState("");
  const [apiOk,        setApiOk]    = useState<boolean|null>(null);

  // All 6 fields must be filled before submit is enabled
  const isFormComplete =
    !!source && !!destination && !!commodity &&
    !!quantity && Number(quantity) >= 1 && !!date && !!priority;

  // Test API connectivity on mount
  useEffect(() => {
    API.get("/routes")
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  // Auto-fetch route whenever both stations are set
  useEffect(() => {
    if (!source || !destination || source === destination) {
      setRoute(null);
      setRouteErr("");
      return;
    }
    let cancelled = false;
    setRouteLoad(true);
    setRoute(null);
    setRouteErr("");

    API.post("/routes/optimize", { source, destination, trafficFactor: 1.0 })
      .then(({ data }) => { if (!cancelled) setRoute(data.data); })
      .catch((err) => {
        if (!cancelled) {
          setRouteErr(err.response?.data?.message || err.message || "Route fetch failed");
        }
      })
      .finally(() => { if (!cancelled) setRouteLoad(false); });

    return () => { cancelled = true; };
  }, [source, destination]);

  const handleSubmit = async () => {
    // Individual field validation with specific messages
    if (!source) {
      toast.error("Missing field", { description: "Please select a source station." });
      return;
    }
    if (!destination) {
      toast.error("Missing field", { description: "Please select a destination." });
      return;
    }
    if (source === destination) {
      toast.error("Invalid route", { description: "Source and destination cannot be the same." });
      return;
    }
    if (!commodity) {
      toast.error("Missing field", { description: "Please select a commodity type." });
      return;
    }
    if (!quantity || Number(quantity) < 1) {
      toast.error("Missing field", { description: "Please enter a valid quantity (minimum 1 MT)." });
      return;
    }
    if (!date) {
      toast.error("Missing field", { description: "Please select a preferred date." });
      return;
    }
    if (!priority) {
      toast.error("Missing field", { description: "Please select a priority level." });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await API.post("/freight/book", {
        commodityType:      commodity,
        sourceStation:      source,
        destinationStation: destination,
        quantity:           Number(quantity),
        unit:               "tonnes",
      });
      const id = data.data.freight._id.slice(-6).toUpperCase();
      toast.success("Booking request submitted", {
        description: `Request ID: REQ-${id} generated. Pending planner review.`,
      });
      setSource(""); setDest(""); setCommodity("");
      setQuantity(""); setDate(""); setPriority("");
      setRoute(null);
    } catch (err: any) {
      toast.error("Booking failed", {
        description: err.response?.data?.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Route panel content
  const renderRoutePanel = () => {
    if (apiOk === false) {
      return (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Backend not reachable</p>
            <p className="text-muted-foreground mt-0.5">
              Make sure <code>afis-backend</code> is running on port 5000 and
              <code>routeRoutes.ts</code> uses <code>requireAny</code>.
            </p>
          </div>
        </div>
      );
    }

    if (!source || !destination) {
      return (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Best Route</span><span className="font-medium text-xs">Via Nagpur Jn.</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Est. Cost</span><span className="font-mono text-primary font-semibold">₹4,82,000</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Est. Time</span><span className="font-mono">36h 20m</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span className="font-mono text-success font-semibold">92%</span></div>
          <p className="text-xs text-muted-foreground text-center pt-3 border-t border-border/40">
            ↑ Select <strong>Source</strong> &amp; <strong>Destination</strong> above for real AI route
          </p>
        </div>
      );
    }

    if (routeLoading) {
      return (
        <div className="space-y-3">
          <p className="text-xs text-primary animate-pulse flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Computing optimal route: {source} → {destination}…
          </p>
          {[1,2,3,4].map(i => <div key={i} className="h-5 rounded bg-muted/60 animate-pulse" />)}
        </div>
      );
    }

    if (routeErr) {
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Route error</p>
              <p className="text-muted-foreground mt-0.5">{routeErr}</p>
            </div>
          </div>
        </div>
      );
    }

    if (route) {
      const path  = route.route.optimizedPath;
      const cost  = `₹${(route.route.totalDistance * 320).toLocaleString("en-IN")}`;
      const time  = `${route.optimization.estimatedTimeHours}h`;
      const dist  = `${route.route.totalDistance} km`;
      const stops = route.optimization.stops;
      const conf  = route.optimization.pathFound ? "92%" : "65%";

      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-1.5 text-xs text-success mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-semibold">Route computed from live backend</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Best Route</span>
            <span className="font-medium text-xs text-right leading-snug">
              {path.map((n: any) => n.station).join(" → ")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Est. Cost</span>
            <span className="font-mono text-primary font-semibold">{cost}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Est. Time</span>
            <span className="font-mono">{time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Distance</span>
            <span className="font-mono">{dist}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stops</span>
            <span className="font-mono">{stops}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-mono text-success font-semibold">{conf}</span>
          </div>
          <div className="pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground font-medium mb-2">Optimized path:</p>
            <div className="space-y-1.5">
              {path.map((node: any, i: number) => {
                const isEndpoint = i === 0 || i === path.length - 1;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isEndpoint ? "bg-primary" : "bg-muted-foreground"}`} />
                    <span className={isEndpoint ? "text-foreground font-semibold" : "text-muted-foreground"}>
                      {node.station}
                    </span>
                    {node.distanceFromPrevious > 0 && (
                      <span className="ml-auto text-muted-foreground tabular-nums">
                        +{node.distanceFromPrevious} km
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Freight Booking</h1>
          <p className="text-sm text-muted-foreground">Submit new freight transportation requests</p>
        </div>
        <AIInsightBanner compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2" hover={false}>
          <h3 className="text-sm font-semibold mb-6">New Booking Request</h3>

          {apiOk !== null && (
            <div className={`flex items-center gap-1.5 text-xs mb-4 ${apiOk ? "text-success" : "text-destructive"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${apiOk ? "bg-success animate-pulse" : "bg-destructive"}`} />
              {apiOk ? "Backend connected — AI route live" : "Backend not reachable — check afis-backend"}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="kpi-label">Source Station <span className="text-destructive">*</span></label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue placeholder="Select source station" /></SelectTrigger>
                <SelectContent>
                  {STATIONS.map(s => (
                    <SelectItem key={s} value={s} disabled={s === destination}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="kpi-label">Destination <span className="text-destructive">*</span></label>
              <Select value={destination} onValueChange={setDest}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>
                  {STATIONS.map(s => (
                    <SelectItem key={s} value={s} disabled={s === source}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="kpi-label">Commodity <span className="text-destructive">*</span></label>
              <Select value={commodity} onValueChange={setCommodity}>
                <SelectTrigger><SelectValue placeholder="Select commodity" /></SelectTrigger>
                <SelectContent>
                  {COMMODITIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="kpi-label">Quantity (MT) <span className="text-destructive">*</span></label>
              <Input type="number" placeholder="e.g., 2400" min={1}
                value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="kpi-label">Preferred Date <span className="text-destructive">*</span></label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" className="pl-10"
                  value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="kpi-label">Priority <span className="text-destructive">*</span></label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            {/* Progress hint */}
            <p className="text-xs text-muted-foreground">
              {isFormComplete
                ? <span className="text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> All fields complete</span>
                : `${[source,destination,commodity,quantity,date,priority].filter(Boolean).length} / 6 fields filled`}
            </p>
            {/* Submit button — disabled until ALL 6 fields are filled */}
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !isFormComplete}
            >
              {submitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                : <>Submit Booking <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">AI Route Suggestion</h3>
              {routeLoading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
            </div>
            {renderRoutePanel()}
          </GlassCard>

          <GlassCard className="p-0 overflow-hidden" hover={false}>
            <div className="p-3 border-b border-border/50">
              <span className="text-xs font-semibold">Route Preview</span>
            </div>
            <div className="h-[200px]">
              <NetworkMap dark={false} animated={false} showLabels={false} />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}