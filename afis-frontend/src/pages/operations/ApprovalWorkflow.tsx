import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AIInsightBanner } from "@/components/shared/AIInsightBanner";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Pencil, Brain } from "lucide-react";
import { toast } from "sonner";
import API from "@/api/axiosConfig";

const PRIORITY_MAP: Record<string, "high"|"critical"|"medium"|"low"> = {
  Critical:"critical", High:"high", Medium:"medium", Low:"low",
};

export default function ApprovalWorkflow() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [acting,  setActing]      = useState<string|null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await API.get("/freight/all?limit=50");
      setApprovals(data.data.requests);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: "approved"|"rejected") => {
    setActing(id);
    try {
      if (action === "approved") {
        await API.put(`/freight/approve/${id}`, {
          operatorNotes: "Approved by operator",
          estimatedDelivery: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
        });
      } else {
        await API.put(`/freight/reject/${id}`, { operatorNotes: "Rejected by operator" });
      }
      toast.success(`Request ${id.slice(-6).toUpperCase()} ${action}`, {
        description: action === "approved" ? "Forwarded for execution" : "Requester notified",
      });
      load();
    } catch(e: any) {
      toast.error("Action failed", { description: e.response?.data?.message || "Please try again" });
    } finally { setActing(null); }
  };

  const timelineSteps = ["Submitted","Under Review","Approved","Scheduled"];

  const mapStatus = (s: string): "pending"|"approved"|"rejected" =>
    s === "approved" || s === "in-transit" || s === "delivered" ? "approved"
    : s === "rejected" ? "rejected" : "pending";

  const getPriority = (r: any): "high"|"critical"|"medium"|"low" => {
    if (r.quantity >= 5000) return "critical";
    if (r.quantity >= 2000) return "high";
    if (r.quantity >= 1000) return "medium";
    return "low";
  };

  const getAiRec = (r: any): { text: string; confidence: number } => {
    const p = getPriority(r);
    if (p === "critical") return { text: "Approve: Critical supply chain requirement", confidence: 87 };
    if (p === "high")     return { text: "Approve: High priority demand, route capacity available", confidence: 94 };
    if (p === "medium")   return { text: "Approve: Standard demand fulfillment", confidence: 91 };
    return { text: "Review: Low priority, schedule for next available slot", confidence: 76 };
  };

  return (
    <div className="space-y-6 text-muted-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Workflow</h1>
          <p className="text-sm text-muted-foreground">Industry → Planner → Operator approval flow</p>
        </div>
        <AIInsightBanner compact />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : approvals.length === 0 ? (
        <GlassCard hover={false}>
          <p className="text-center py-12 text-muted-foreground text-sm">
            No freight requests yet. Industry users need to submit bookings first.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {approvals.map((req, i) => {
            const status   = mapStatus(req.status);
            const priority = getPriority(req);
            const ai       = getAiRec(req);
            const reqId    = `REQ-${req._id.slice(-4).toUpperCase()}`;
            const isPending = req.status === "pending";

            return (
              <motion.div key={req._id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}>
                <GlassCard hover={false}>
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-mono text-xs font-semibold text-primary">{reqId}</span>
                        <StatusBadge status={status} />
                        <StatusBadge status={priority} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Industry</div>
                          <div className="font-medium">{(req.userId as any)?.name || "User"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Commodity</div>
                          <div>{req.commodityType}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Route</div>
                          <div>{req.sourceStation} → {req.destinationStation}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Quantity</div>
                          <div className="font-mono">{req.quantity} MT</div>
                        </div>
                      </div>
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-2">
                        <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs">{ai.text}</p>
                          <span className="text-xs font-mono text-primary font-semibold">Confidence: {ai.confidence}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:w-32 shrink-0">
                      <div className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-2">Status</div>
                      <div className="space-y-0">
                        {timelineSteps.map((step, si) => {
                          const stepDone = status === "approved" ? si <= 2 : status === "rejected" ? si <= 1 : si <= 1;
                          return (
                            <div key={si} className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                <div className={`h-2 w-2 rounded-full ${stepDone?"bg-primary":"bg-border"}`} />
                                {si < timelineSteps.length-1 && <div className={`w-0.5 h-4 ${stepDone?"bg-primary/40":"bg-border"}`} />}
                              </div>
                              <span className={`text-[10px] ${stepDone?"text-foreground":"text-muted-foreground"}`}>{step}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex lg:flex-col gap-2 shrink-0">
                        <Button size="sm" className="h-8 text-xs bg-success hover:bg-success/90"
                          disabled={acting === req._id}
                          onClick={() => handleAction(req._id, "approved")}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8 text-xs"
                          disabled={acting === req._id}
                          onClick={() => handleAction(req._id, "rejected")}>
                          <XCircle className="mr-1 h-3 w-3" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs">
                          <Pencil className="mr-1 h-3 w-3" /> Modify
                        </Button>
                      </div>
                    )}
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