/**
 * Route Optimization Service
 * Uses OpenRouteService API for REAL distances + Dijkstra fallback
 */
import axios from 'axios';
import { REAL_STATION_DISTANCES, SEASONAL_FACTORS } from './realRailwayData';

export interface RouteNode {
  station: string;
  distanceFromPrevious: number;
  estimatedTimeMinutes: number;
}

export interface RouteResult {
  path:          RouteNode[];
  totalDistance: number;
  totalTime:     number;
  found:         boolean;
}

const AVG_SPEED_KMPH = 25;

// Real Indian station coordinates for ORS API
const STATION_COORDS: Record<string, [number, number]> = {
  Mumbai:      [72.8777, 19.0760],
  Delhi:       [77.2090, 28.6139],
  Chennai:     [80.2707, 13.0827],
  Kolkata:     [88.3639, 22.5726],
  Bengaluru:   [77.5946, 12.9716],
  Hyderabad:   [78.4867, 17.3850],
  Ahmedabad:   [72.5714, 23.0225],
  Pune:        [73.8567, 18.5204],
  Jaipur:      [75.7873, 26.9124],
  Surat:       [72.8311, 21.1702],
  Nagpur:      [79.0882, 21.1458],
  Lucknow:     [80.9462, 26.8467],
  Patna:       [85.1376, 25.5941],
  Varanasi:    [82.9739, 25.3176],
  Howrah:      [88.3426, 22.5958],
  Raipur:      [81.6296, 21.2514],
  Bhopal:      [77.4026, 23.2599],
  Vizag:       [83.2185, 17.6868],
  Vijayawada:  [80.6480, 16.5062],
  Mysuru:      [76.6394, 12.2958],
  Coimbatore:  [76.9558, 11.0168],
  Bhubaneswar: [85.8245, 20.2961],
  Chandigarh:  [76.7794, 30.7333],
  Agra:        [78.0081, 27.1767],
};

// Get real distance using OpenRouteService API
export async function getRealDistance(
  source: string,
  destination: string
): Promise<{ distance: number; duration: number } | null> {
  const srcCoords  = STATION_COORDS[source];
  const destCoords = STATION_COORDS[destination];

  if (!srcCoords || !destCoords || !process.env.ORS_API_KEY) return null;

  try {
    const response = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car',
      {
        coordinates: [srcCoords, destCoords],
      },
      {
        headers: {
          'Authorization': process.env.ORS_API_KEY,
          'Content-Type':  'application/json',
        },
        timeout: 8000,
      }
    );
    const summary = response.data.routes[0].summary;
    return {
      distance: Math.round(summary.distance / 1000), // meters to km
      duration: Math.round(summary.duration / 60),   // seconds to minutes
    };
  } catch (err) {
    return null;
  }
}

// Dijkstra on real IR distances (fallback)
function buildGraph(): Record<string, Record<string, number>> {
  const graph: Record<string, Record<string, number>> = {};
  for (const [from, destinations] of Object.entries(REAL_STATION_DISTANCES)) {
    if (!graph[from]) graph[from] = {};
    for (const [to, dist] of Object.entries(destinations)) {
      graph[from][to] = dist;
      if (!graph[to]) graph[to] = {};
      if (!graph[to][from]) graph[to][from] = dist;
    }
  }
  return graph;
}

export function dijkstra(source: string, destination: string): RouteResult {
  const graph = buildGraph();
  if (!graph[source] || !graph[destination]) {
    return { path:[], totalDistance:0, totalTime:0, found:false };
  }

  const distances: Record<string, number> = {};
  const previous:  Record<string, string|null> = {};
  const visited  = new Set<string>();
  const nodes    = new Set<string>(Object.keys(graph));

  for (const node of nodes) { distances[node] = Infinity; previous[node] = null; }
  distances[source] = 0;

  while (nodes.size > 0) {
    let current: string|null = null;
    let smallest = Infinity;
    for (const node of nodes) {
      if (distances[node] < smallest) { smallest = distances[node]; current = node; }
    }
    if (!current || current === destination) break;
    nodes.delete(current);
    visited.add(current);
    for (const [neighbor, dist] of Object.entries(graph[current] || {})) {
      if (visited.has(neighbor)) continue;
      const alt = distances[current] + dist;
      if (alt < distances[neighbor]) { distances[neighbor] = alt; previous[neighbor] = current; }
    }
  }

  const path: string[] = [];
  let curr: string|null = destination;
  while (curr) { path.unshift(curr); curr = previous[curr]; }
  if (path[0] !== source) return { path:[], totalDistance:0, totalTime:0, found:false };

  const routeNodes: RouteNode[] = path.map((station, i) => {
    const prev = i > 0 ? path[i-1] : null;
    const dist = prev
      ? (REAL_STATION_DISTANCES[prev]?.[station] || REAL_STATION_DISTANCES[station]?.[prev] || 0)
      : 0;
    return {
      station,
      distanceFromPrevious: dist,
      estimatedTimeMinutes: Math.round((dist / AVG_SPEED_KMPH) * 60),
    };
  });

  return {
    path:          routeNodes,
    totalDistance: distances[destination],
    totalTime:     Math.round((distances[destination] / AVG_SPEED_KMPH) * 60),
    found:         true,
  };
}