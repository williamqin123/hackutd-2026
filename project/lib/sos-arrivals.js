export const SOS_ARRIVAL_DURATION_MS = 6000;

// Initial subscriptions and reconnect snapshots establish a baseline. Only an
// unseen ID received after that baseline represents a live arrival to animate.
export class SosArrivalTracker {
  connected = false;
  seen = new Set();
  started = new Map();

  update(requests, connected, now) {
    if (!connected) {
      this.connected = false;
      this.started.clear();
      return;
    }
    for (const request of requests) {
      const id = String(request.id);
      if (this.connected && !this.seen.has(id)) this.started.set(id, now);
      this.seen.add(id);
    }
    this.connected = true;
    for (const [id, startedAt] of this.started) {
      if (now - startedAt >= SOS_ARRIVAL_DURATION_MS) this.started.delete(id);
    }
  }

  elapsed(id, now) {
    const startedAt = this.started.get(String(id));
    if (!this.connected || startedAt === undefined) return null;
    const elapsed = now - startedAt;
    return elapsed < SOS_ARRIVAL_DURATION_MS ? elapsed : null;
  }
}
