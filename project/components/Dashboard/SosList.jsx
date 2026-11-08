"use client";

import { useEffect, useState } from "react";
import styles from "./SosList.module.css";

function isCritical(request) {
  return request.medicalUrgent && request.stranded;
}

function milesBetween(a, b) {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return (3958.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))).toFixed(1);
}

export default function SosList({ requests, teams, assignments, ready, connected, onRecommend, onConfirm }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [reviewId, setReviewId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const criticalCount = requests.filter(isCritical).length;
  const unassignedCount = requests.filter((r) => r.status === "pending").length;
  const filtered = requests.filter((r) => {
    const matchesFilter = filter === "all" || (filter === "critical" ? isCritical(r) : r.status === "pending");
    const searchable = `SOS #${r.id} R-${r.id} ${r.description} ${r.lat} ${r.lon}`.toLowerCase();
    return matchesFilter && searchable.includes(query.trim().toLowerCase());
  });
  const visible = showAll ? filtered : filtered.slice(0, 3);
  const selected = visible.find((r) => String(r.id) === selectedId) ?? visible[0];
  const hasPending = requests.some((r) => r.status === "pending" && !assignments.some(
    (a) => a.requestId === r.id && ["recommended", "confirmed", "en_route"].includes(a.status),
  ));

  async function perform(action) {
    setBusy(true);
    try { await action(); } catch { /* Dashboard displays reducer errors. */ }
    finally { setBusy(false); }
  }

  return (
    <section className={styles.panel} aria-label="SOS requests">
      <div className={styles.heading}>
        <h2>SOS requests</h2>
        <span className={styles.total}>{ready ? requests.length : "—"} total</span>
      </div>
      <p className={styles.subtitle}>Incoming requests awaiting a coordinated response</p>
      <input
        className={styles.search}
        type="search"
        aria-label="Search SOS requests by ID, description, or coordinates"
        placeholder="Search request ID or location…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setShowAll(false); }}
      />
      <div className={styles.filters} role="group" aria-label="Filter SOS requests">
        {[["all", "All", requests.length], ["critical", "Critical", criticalCount], ["unassigned", "Unassigned", unassignedCount]].map(([key, label, count]) => (
          <button key={key} type="button" aria-pressed={filter === key}
            className={key === "critical" ? styles.criticalFilter : undefined}
            onClick={() => { setFilter(key); setShowAll(false); }}>
            {label} {ready ? count : "—"}
          </button>
        ))}
      </div>
      <div className={styles.requests}>
        {!ready ? <p className={styles.empty}>Loading requests…</p> : visible.length === 0 ? (
          <p className={styles.empty}>{requests.length ? "No requests match your search or filter." : "No open SOS requests."}</p>
        ) : visible.map((request) => {
          const active = selected?.id === request.id;
          const assignment = assignments.find((a) => a.requestId === request.id && a.status === "recommended");
          const team = assignment && teams.find((t) => t.id === assignment.teamId);
          const wait = now === null ? "—" : `${Math.max(0, Math.floor((now - Number(request.createdAt.microsSinceUnixEpoch / 1000n)) / 60000))} min`;
          const critical = isCritical(request);
          return (
            <article key={String(request.id)} className={`${styles.request} ${active ? styles.selected : ""}`}>
              <button className={styles.select} type="button" aria-expanded={active}
                onClick={() => { setSelectedId(String(request.id)); setReviewId(null); }}>
                <div className={styles.requestTop}>
                  <strong>SOS #{String(request.id)}</strong>
                  <span className={critical ? styles.criticalBadge : styles.badge}>{critical ? "CRITICAL" : request.status === "recommended" ? "RECOMMENDED" : "PENDING"}</span>
                </div>
                <p className={styles.description}>{request.description}</p>
                <p className={styles.meta}>{request.peopleCount} {request.peopleCount === 1 ? "person" : "people"} / Waiting {wait}</p>
              </button>
              {active && (
                <div className={styles.details}>
                  <p className={styles.meta}>{request.lat.toFixed(4)}, {request.lon.toFixed(4)}</p>
                  <div className={styles.recommendation}>
                    {team ? <>
                      <p className={styles.suggested}>Suggested: {team.name}</p>
                      <p className={styles.meta}>
                        {[team.hasBoat && "Boat", team.hasMedical && "Medic"].filter(Boolean).join(" + ") || "Rescue team"} / {milesBetween(request, team)} mi straight-line
                      </p>
                      {reviewId === String(assignment.id) ? <>
                        <p className={styles.meta}>Confirm {team.name} for SOS #{String(request.id)} ({request.peopleCount} people)?</p>
                        <button className={styles.primary} type="button" disabled={!connected || busy || team.status !== "available"}
                          onClick={() => perform(() => onConfirm(assignment.id))}>
                          {busy ? "Dispatching…" : "Confirm dispatch"}
                        </button>
                        <button className={styles.cancel} type="button" onClick={() => setReviewId(null)}>Cancel review</button>
                      </> : (
                        <button className={styles.primary} type="button" disabled={!connected || busy}
                          onClick={() => setReviewId(String(assignment.id))}>Review request & dispatch team</button>
                      )}
                    </> : <p className={styles.meta}>No team recommendation yet for this request.</p>}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className={styles.footer}>
        {filtered.length > 3 && <button type="button" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer requests" : `View all ${filtered.length} requests`}
        </button>}
        <span>Sorted by urgency</span>
      </div>
      <button className={styles.recommendNext} type="button" disabled={!ready || !connected || busy || !hasPending}
        onClick={() => perform(onRecommend)}>
        {busy ? "Working…" : "Recommend next pending SOS"}
      </button>
    </section>
  );
}
