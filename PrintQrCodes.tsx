// Offline-first sync queue for the collector mobile app.
// Completed stops are written here immediately (works with or without a
// network connection). A background sync attempt runs whenever the browser
// comes back online, or on a timer as a fallback. Nothing here pretends to
// sync when it hasn't — pending items stay visibly "Pending Sync" until the
// server confirms them.

import { api } from "./api";

const QUEUE_KEY_PREFIX = "valco_pending_stops_";

// Keyed per logged-in user, not globally, so if two collectors share a
// tablet or handset at the depot, one collector's offline check-ins never
// bleed into another's queue or get synced under the wrong account.
function queueKey(): string {
  try {
    const raw = localStorage.getItem("valco_user");
    const user = raw ? JSON.parse(raw) : null;
    return `${QUEUE_KEY_PREFIX}${user?.id ?? "anonymous"}`;
  } catch {
    return `${QUEUE_KEY_PREFIX}anonymous`;
  }
}

export interface PendingStop {
  stop_id: number;
  status: "COMPLETED";
  arrived_at_client: string; // ISO timestamp, stamped locally at time of check-in
  route_id: number;
  scanned_code?: string;
}

export function getQueue(): PendingStop[] {
  try {
    const raw = localStorage.getItem(queueKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingStop[]) {
  localStorage.setItem(queueKey(), JSON.stringify(queue));
}

export function queueStopCompletion(stop: PendingStop) {
  const queue = getQueue();
  // avoid duplicate queue entries for the same stop
  const filtered = queue.filter((q) => q.stop_id !== stop.stop_id);
  filtered.push(stop);
  saveQueue(filtered);
}

export function isStopPending(stopId: number): boolean {
  return getQueue().some((q) => q.stop_id === stopId);
}

export async function trySync(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  try {
    const res = await api.post("/routes/sync", { pending: queue });
    const results: { stop_id: number; ok: boolean }[] = res.data.results;
    const succeededIds = new Set(results.filter((r) => r.ok).map((r) => r.stop_id));
    const remaining = queue.filter((q) => !succeededIds.has(q.stop_id));
    saveQueue(remaining);
    return { synced: succeededIds.size, failed: remaining.length };
  } catch {
    // network still unavailable, or server error — leave queue intact, try again later
    return { synced: 0, failed: queue.length };
  }
}
