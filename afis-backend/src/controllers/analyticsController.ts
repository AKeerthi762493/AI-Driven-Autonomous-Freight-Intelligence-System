import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import FreightRequest from '../models/FreightRequest';
import Wagon from '../models/Wagon';
import Route from '../models/Route';
import Alert from '../models/Alert';
import { sendSuccess } from '../utils/apiResponse';

// ─── Fetch official IR freight stats from data.gov.in ────────────────────────
async function fetchGovFreightStats(): Promise<{
  records: any[];
  source: string;
} | null> {
  const key = process.env.DATA_GOV_KEY;
  if (!key) return null;

  try {
    const { data } = await axios.get(
      'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
      {
        params: { 'api-key': key, format: 'json', limit: 5 },
        timeout: 5000,
      }
    );
    const records = data?.records || [];
    if (records.length === 0) return null;
    return { records: records.slice(0, 5), source: 'data.gov.in — Indian Railways Official' };
  } catch {
    return null;
  }
}

// ─── Fetch route delay stats from data.gov.in ────────────────────────────────
async function fetchGovDelayStats(): Promise<any[] | null> {
  const key = process.env.DATA_GOV_KEY;
  if (!key) return null;

  try {
    const { data } = await axios.get(
      'https://api.data.gov.in/resource/63b04cae-fc02-4dce-96d2-9d7d4a2b5ba4',
      {
        params: { 'api-key': key, format: 'json', limit: 5 },
        timeout: 5000,
      }
    );
    return data?.records?.slice(0, 5) || null;
  } catch {
    return null;
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────
export const getDashboardAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d7  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

    // Run MongoDB queries + gov API calls in parallel
    const [
      fStats, wStats, rStats, aStats, monthly, weekly,
      govFreight, govDelays,
    ] = await Promise.all([
      FreightRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Wagon.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Route.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, avgDelay: { $avg: '$delayMinutes' } } },
      ]),
      Alert.aggregate([
        { $match: { isResolved: false } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      FreightRequest.aggregate([
        { $match: { createdAt: { $gte: d30 } } },
        {
          $group: {
            _id:      { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            bookings: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            quantity: { $sum: '$quantity' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      FreightRequest.aggregate([
        { $match: { createdAt: { $gte: d7 } } },
        {
          $group: {
            _id:           '$commodityType',
            count:         { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
      ]),
      fetchGovFreightStats(),   // data.gov.in call 1
      fetchGovDelayStats(),     // data.gov.in call 2
    ]);

    // Build summary maps
    const wMap  = Object.fromEntries(wStats.map((w: any) => [w._id, w.count]));
    const fMap  = Object.fromEntries(fStats.map((f: any) => [f._id, f.count]));
    const aMap  = Object.fromEntries(aStats.map((a: any) => [a._id, a.count]));
    const total    = Object.values(wMap).reduce((a: number, b) => a + (b as number), 0) as number;
    const assigned = ((wMap['assigned'] || 0) as number) + ((wMap['in-transit'] || 0) as number);
    const totalF   = Object.values(fMap).reduce((a: number, b) => a + (b as number), 0) as number;

    // Compute on-time rate from real route data
    const delayedRoutes  = (rStats.find((r: any) => r._id === 'delayed')?.count  || 0) as number;
    const activeRoutes   = (rStats.find((r: any) => r._id === 'active')?.count   || 0) as number;
    const totalRoutes    = activeRoutes + delayedRoutes;
    const onTimeRate     = totalRoutes > 0
      ? (((totalRoutes - delayedRoutes) / totalRoutes) * 100).toFixed(1)
      : '100.0';

    sendSuccess(res, {
      kpi: {
        totalFreightRequests: totalF,
        pendingApprovals:     fMap['pending']    || 0,
        activeShipments:      fMap['in-transit'] || 0,
        approvedShipments:    fMap['approved']   || 0,
        deliveredThisMonth:   fMap['delivered']  || 0,
        wagonUtilizationRate: total > 0 ? ((assigned / total) * 100).toFixed(1) : '0.0',
        totalWagons:          total,
        activeAlerts:         Object.values(aMap).reduce((a: number, b) => a + (b as number), 0),
        criticalAlerts:       aMap['critical'] || 0,
        onTimeDeliveryRate:   onTimeRate,
      },
      freightStatusBreakdown: fStats,
      wagonUtilization: {
        ...wMap,
        utilizationRate: total > 0 ? ((assigned / total) * 100).toFixed(1) : '0.0',
      },
      routeStats:            rStats,
      alertSeverityBreakdown: aStats,
      monthlyTrend:          monthly,
      topCommodities:        weekly,

      // Official Indian Railways data from data.gov.in
      govData: {
        freightStats: govFreight
          ? { records: govFreight.records, source: govFreight.source }
          : { records: [], source: 'data.gov.in unavailable' },
        delayStats: govDelays
          ? { records: govDelays, source: 'data.gov.in — IR Delay Statistics' }
          : { records: [], source: 'data.gov.in unavailable' },
      },

      dataSource: [
        'MongoDB (bookings, wagons, routes, alerts)',
        govFreight ? 'data.gov.in (official IR freight stats)' : null,
        govDelays  ? 'data.gov.in (official IR delay stats)'   : null,
      ].filter(Boolean).join(' + '),

      generatedAt: new Date().toISOString(),
    });
  } catch (e) { next(e); }
};