// Mock data for the AFIS platform

export const mockShipments = [
  { id: "AF-204", commodity: "Steel Coils", origin: "Mumbai", destination: "Delhi", eta: "2026-03-18 14:30", status: "in-transit" as const, progress: 68 },
  { id: "AF-207", commodity: "Coal", origin: "Kolkata", destination: "Chennai", eta: "2026-03-19 08:00", status: "in-transit" as const, progress: 42 },
  { id: "AF-211", commodity: "Cement", origin: "Jaipur", destination: "Ahmedabad", eta: "2026-03-17 22:15", status: "delayed" as const, progress: 31 },
  { id: "AF-215", commodity: "Petroleum", origin: "Vizag", destination: "Hyderabad", eta: "2026-03-18 06:00", status: "on-time" as const, progress: 85 },
  { id: "AF-219", commodity: "Fertilizer", origin: "Nagpur", destination: "Pune", eta: "2026-03-20 10:00", status: "pending" as const, progress: 0 },
  { id: "AF-223", commodity: "Iron Ore", origin: "Raipur", destination: "Mumbai", eta: "2026-03-18 18:45", status: "in-transit" as const, progress: 55 },
];

export const mockWagons = [
  { id: "WGN-1042", type: "BOXN", status: "loaded" as const, location: "Delhi Junction", destination: "Mumbai Central", load: "Steel - 58T" },
  { id: "WGN-1043", type: "BCNA", status: "available" as const, location: "Howrah", destination: "-", load: "Empty" },
  { id: "WGN-1044", type: "BTPN", status: "in-transit" as const, location: "En route Nagpur", destination: "Chennai", load: "Petroleum - 64T" },
  { id: "WGN-1045", type: "BOXN", status: "loaded" as const, location: "Vizag Port", destination: "Hyderabad", load: "Coal - 60T" },
  { id: "WGN-1046", type: "BCNA", status: "available" as const, location: "Pune Junction", destination: "-", load: "Empty" },
  { id: "WGN-1047", type: "BTPN", status: "in-transit" as const, location: "En route Jaipur", destination: "Delhi", load: "Cement - 55T" },
];

export const mockApprovals = [
  { id: "REQ-4012", industry: "Tata Steel Ltd.", commodity: "Steel Coils", route: "Mumbai → Delhi", quantity: "2400 MT", priority: "high" as const, status: "pending" as const, submitted: "2026-03-16 09:30", confidence: 94, aiRecommendation: "Approve: High priority demand, route capacity available" },
  { id: "REQ-4013", industry: "Coal India", commodity: "Coal", route: "Kolkata → Chennai", quantity: "5000 MT", priority: "critical" as const, status: "pending" as const, submitted: "2026-03-16 11:00", confidence: 87, aiRecommendation: "Approve: Critical supply chain requirement" },
  { id: "REQ-4014", industry: "UltraTech Cement", commodity: "Cement", route: "Jaipur → Ahmedabad", quantity: "1800 MT", priority: "medium" as const, status: "approved" as const, submitted: "2026-03-15 14:20", confidence: 91, aiRecommendation: "Approved: Standard demand fulfillment" },
  { id: "REQ-4015", industry: "IOCL", commodity: "Petroleum", route: "Vizag → Hyderabad", quantity: "3200 MT", priority: "high" as const, status: "approved" as const, submitted: "2026-03-15 08:45", confidence: 96, aiRecommendation: "Approved: Priority fuel supply" },
  { id: "REQ-4016", industry: "IFFCO", commodity: "Fertilizer", route: "Nagpur → Pune", quantity: "1500 MT", priority: "low" as const, status: "rejected" as const, submitted: "2026-03-14 16:00", confidence: 42, aiRecommendation: "Rejected: Delay risk detected, alternate route suggested" },
];

export const mockAlerts = [
  { id: 1, type: "delay" as const, message: "Train #AF-211 delayed by 3h at Ajmer Junction due to signal failure", time: "12 min ago", severity: "high" as const },
  { id: 2, type: "congestion" as const, message: "High congestion detected at Nagpur Junction - 14 trains queued", time: "28 min ago", severity: "critical" as const },
  { id: 3, type: "maintenance" as const, message: "Track maintenance scheduled: Delhi-Jaipur corridor, 03:00-06:00", time: "1h ago", severity: "medium" as const },
  { id: 4, type: "delay" as const, message: "Weather alert: Heavy rainfall expected in Mumbai region", time: "2h ago", severity: "high" as const },
  { id: 5, type: "congestion" as const, message: "Port congestion at Vizag - unloading delayed by 2h", time: "3h ago", severity: "medium" as const },
];

export const mockAIRecommendations = [
  { id: 1, title: "Reroute Shipment AF-211", description: "Reroute via Nagpur Junction to avoid congestion at Ajmer. Saves 4h transit time.", confidence: 94, impact: "4h saved", type: "route" as const },
  { id: 2, title: "Optimize Rake R-442", description: "Combine 3 partial loads to Delhi into single rake. Improves utilization by 23%.", confidence: 88, impact: "23% efficiency gain", type: "optimization" as const },
  { id: 3, title: "Preemptive Wagon Dispatch", description: "Dispatch 12 empty wagons to Vizag Port. Demand surge predicted in 48h.", confidence: 79, impact: "Prevent 2-day delay", type: "prediction" as const },
];

export const demandData = [
  { month: "Jan", coal: 4200, steel: 2800, cement: 1900, petroleum: 3100 },
  { month: "Feb", coal: 4500, steel: 3100, cement: 2100, petroleum: 2900 },
  { month: "Mar", coal: 3800, steel: 3400, cement: 2400, petroleum: 3300 },
  { month: "Apr", coal: 4100, steel: 2900, cement: 2200, petroleum: 3500 },
  { month: "May", coal: 4800, steel: 3200, cement: 2600, petroleum: 3000 },
  { month: "Jun", coal: 5200, steel: 3000, cement: 2800, petroleum: 2800 },
];

export const networkStations = [
  { name: "Delhi", x: 55, y: 20 },
  { name: "Mumbai", x: 30, y: 55 },
  { name: "Kolkata", x: 78, y: 40 },
  { name: "Chennai", x: 62, y: 78 },
  { name: "Jaipur", x: 40, y: 28 },
  { name: "Nagpur", x: 52, y: 45 },
  { name: "Hyderabad", x: 52, y: 62 },
  { name: "Ahmedabad", x: 28, y: 38 },
  { name: "Pune", x: 35, y: 58 },
  { name: "Vizag", x: 70, y: 55 },
  { name: "Raipur", x: 62, y: 42 },
  { name: "Howrah", x: 80, y: 42 },
];

export const networkRoutes = [
  { from: 0, to: 4 }, { from: 0, to: 5 }, { from: 1, to: 5 },
  { from: 1, to: 8 }, { from: 1, to: 7 }, { from: 2, to: 5 },
  { from: 2, to: 11 }, { from: 3, to: 6 }, { from: 3, to: 9 },
  { from: 4, to: 7 }, { from: 5, to: 6 }, { from: 5, to: 10 },
  { from: 6, to: 3 }, { from: 6, to: 9 }, { from: 8, to: 5 },
  { from: 9, to: 2 }, { from: 10, to: 2 },
];
