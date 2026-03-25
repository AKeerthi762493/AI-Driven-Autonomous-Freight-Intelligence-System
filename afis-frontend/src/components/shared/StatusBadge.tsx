interface StatusBadgeProps {
  status: "pending" | "approved" | "rejected" | "in-transit" | "on-time" | "delayed" | "available" | "loaded" | "critical" | "high" | "medium" | "low";
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  approved: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
  "in-transit": "bg-primary/20 text-primary",
  "on-time": "bg-success/20 text-success",
  delayed: "bg-destructive/20 text-destructive",
  available: "bg-success/20 text-success",
  loaded: "bg-primary/20 text-primary",
  critical: "bg-destructive/20 text-destructive",
  high: "bg-warning/20 text-warning",
  medium: "bg-primary/20 text-primary",
  low: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${statusStyles[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}
