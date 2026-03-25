import { Request, Response, NextFunction } from 'express';
import FreightRequest from '../models/FreightRequest';
import Wagon from '../models/Wagon';
import Route from '../models/Route';
import Alert from '../models/Alert';
import { dijkstra } from '../services/routeOptimizationService';
import { predictDemand, getTopDemandStations } from '../services/demandPredictionService';
import { sendSuccess, sendError } from '../utils/apiResponse';

export interface AIRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  estimatedImpact: string;
  data: unknown;
}

export const getAIRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recs: AIRecommendation[] = [];

    // 1. Route delays
    const delayedRoutes = await Route.find({ delayMinutes: { $gt: 20 } }).limit(3);
    for (const r of delayedRoutes) {
      const reopt = dijkstra(r.source, r.destination);
      recs.push({
        id:              `REC-RT-${r._id}`,
        type:            'route_optimization',
        title:           `Optimize: ${r.source} → ${r.destination}`,
        description:     `Route has a real ${r.delayMinutes}-minute delay recorded in the system.`,
        priority:        r.delayMinutes > 60 ? 'critical' : 'high',
        action:          'REROUTE',
        estimatedImpact: `Save ~${Math.round(r.delayMinutes * 0.7)} minutes`,
        data:            { routeId: r._id, currentDelay: r.delayMinutes, suggestedPath: reopt.path },
      });
    }

    // 2. Pending approval backlog
    const pendingCount = await FreightRequest.countDocuments({ status: 'pending' });
    if (pendingCount > 3) {
      recs.push({
        id:              `REC-AP-${Date.now()}`,
        type:            'approval_backlog',
        title:           `${pendingCount} Requests Awaiting Approval`,
        description:     `${pendingCount} freight requests submitted by industry users are waiting for operator approval.`,
        priority:        pendingCount > 10 ? 'critical' : pendingCount > 5 ? 'high' : 'medium',
        action:          'BATCH_APPROVE',
        estimatedImpact: `Unblock ${pendingCount} industry users`,
        data:            { pendingCount },
      });
    }

    // 3. Demand surge from real bookings
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const topStations = await FreightRequest.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$sourceStation', totalQty: { $sum: '$quantity' }, count: { $sum: 1 } } },
      { $sort: { totalQty: -1 } },
      { $limit: 3 },
    ]);
    for (const s of topStations) {
      if (s.count >= 2) {
        const preds    = await predictDemand(s._id, 'Coal', 1);
        const predicted = preds[0]?.predictedDemand || 0;
        recs.push({
          id:              `REC-DM-${s._id}`,
          type:            'demand_surge',
          title:           `High Activity at ${s._id}`,
          description:     `${s.count} bookings (${s.totalQty.toLocaleString()} tonnes) from ${s._id} in last 30 days. Predicted: ${predicted.toLocaleString()}T`,
          priority:        s.count > 5 ? 'high' : 'medium',
          action:          'PRE_POSITION_RAKES',
          estimatedImpact: 'Prevent delays',
          data:            { station: s._id, bookings: s.count, totalQuantity: s.totalQty, predicted },
        });
      }
    }

    // 4. Wagon shortage
    const availableWagons = await Wagon.countDocuments({ status: 'available' });
    const totalWagons     = await Wagon.countDocuments();
    if (totalWagons > 0 && availableWagons < Math.ceil(totalWagons * 0.2)) {
      recs.push({
        id:              `REC-WG-${Date.now()}`,
        type:            'wagon_reallocation',
        title:           `Only ${availableWagons}/${totalWagons} Wagons Available`,
        description:     `Wagon availability is critically low. ${totalWagons - availableWagons} wagons are assigned or under maintenance.`,
        priority:        availableWagons === 0 ? 'critical' : 'high',
        action:          'REALLOCATE_WAGONS',
        estimatedImpact: 'Prevent booking rejections',
        data:            { availableWagons, totalWagons },
      });
    }

    // 5. Maintenance due
    const maintenanceDue = await Wagon.find({
      nextMaintenanceDue: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      status: { $ne: 'maintenance' },
    }).limit(5);
    if (maintenanceDue.length > 0) {
      recs.push({
        id:              `REC-MT-${Date.now()}`,
        type:            'maintenance_alert',
        title:           `${maintenanceDue.length} Wagon(s) Due for Maintenance`,
        description:     `Wagons due within 7 days: ${maintenanceDue.map(w => w.wagonNumber).join(', ')}.`,
        priority:        'medium',
        action:          'SCHEDULE_MAINTENANCE',
        estimatedImpact: 'Prevent mid-route failures',
        data:            { wagons: maintenanceDue.map(w => ({ id: w._id, number: w.wagonNumber, due: w.nextMaintenanceDue })) },
      });
    }

    const ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    recs.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);

    sendSuccess(res, {
      recommendations: recs,
      total:           recs.length,
      generatedAt:     new Date().toISOString(),
      dataSource:      'Live MongoDB',
    });
  } catch (error) {
    next(error);
  }
};

export const executeAIAction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { action, recommendationId, params } = req.body;
    if (!action) { sendError(res, 'Action required', 400); return; }

    let result: unknown;

    if (action === 'BATCH_APPROVE') {
      const updated = await FreightRequest.updateMany(
        { status: 'pending' },
        {
          status: 'approved',
          operatorNotes: 'Auto-approved by AI',
          $push: { trackingEvents: { event: 'Auto-approved by AI', timestamp: new Date() } },
        }
      );
      result = { modifiedCount: updated.modifiedCount };

    } else if (action === 'SCHEDULE_MAINTENANCE') {
      const wagonIds = params?.wagons?.map((w: any) => w.id) || [];
      const updated  = await Wagon.updateMany({ _id: { $in: wagonIds } }, { status: 'maintenance' });
      await Alert.create({
        message:  `AI scheduled maintenance for ${updated.modifiedCount} wagon(s)`,
        severity: 'info',
        category: 'maintenance',
      });
      result = { scheduledCount: updated.modifiedCount };

    } else if (action === 'REROUTE') {
      if (params?.routeId) {
        await Route.findByIdAndUpdate(params.routeId, { delayMinutes: 0, trafficFactor: 1.0 });
      }
      result = { rerouteApplied: true };

    } else if (action === 'REALLOCATE_WAGONS') {
      const updated = await Wagon.updateMany(
        { status: 'maintenance' },
        { status: 'available' }
      );
      result = { reallocatedCount: updated.modifiedCount };

    } else if (action === 'PRE_POSITION_RAKES') {
      // Extract station from description or data
      const station = (params?.description as string)?.match(/at (\w+)/i)?.[1]
        || (params as any)?.station
        || 'network';
      await Alert.create({
        message:  `AI pre-positioning rakes at ${station} due to predicted demand surge`,
        severity: 'info',
        category: 'demand',
      });
      result = { prePositioned: true, station };

    } else if (action === 'CHECK_ALERTS') {
      const available = await Wagon.countDocuments({ status: 'available' });
      const total     = await Wagon.countDocuments();
      if (available < 3) {
        await Alert.create({
          message:  `Critical shortage: only ${available} wagon(s) available out of ${total}.`,
          severity: available === 0 ? 'critical' : 'warning',
          category: 'wagon',
        });
      }
      result = { alertsChecked: true, availableWagons: available };

    } else {
      sendError(res, `Unknown action: ${action}`, 400);
      return;
    }

    sendSuccess(res, {
      executedAction:  action,
      recommendationId,
      result,
      executedAt:      new Date().toISOString(),
      executedBy:      req.user?.id,
    }, `AI action '${action}' executed successfully`);

  } catch (error) {
    next(error);
  }
};