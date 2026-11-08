"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SosList.module.css";

const OPEN_STATUSES = new Set(["recommended", "confirmed", "en_route"]);

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

function statusBadge(request) {
  if (isCritical(request) && request.status === "pending") return "CRITICAL";
  if (request.status === "recommended") return "RECOMMENDED";
  if (request.status === "assigned") return "ASSIGNED";
  return "PENDING";
}

function teamOptionLabel(team, request) {
  const caps = [
    team.hasBoat && "Boat",
    team.hasMedical && "Medic",
    `${milesBetween(request, team)} mi`,
  ].filter(Boolean);
  return `${team.name} · ${caps.join(" · ")}`;
}

export default function SosList({
  requests,
  teams,
  assignments,
  ready,
  connected,
  selectedId = null,
  onSelectRequest,
  onRecommend,
  onRecommendFor,
  onAssign,
  onConfirm,
  onCancel,
  onComplete,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const [reviewId, setReviewId] = useState(null);
  const [manualTeamByRequest, setManualTeamByRequest] = useState({});
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(null);
  const selectedCardRef = useRef(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Map selection should open the matching card even if it was collapsed/filtered.
  useEffect(() => {
    if (!selectedId) return;
    const exists = requests.some((r) => String(r.id) === String(selectedId));
    if (!exists) return;
    setFilter("all");
    setQuery("");
    setShowAll(true);
    setReviewId(null);
  }, [selectedId, requests]);

  useEffect(() => {
    if (!selectedId || !selectedCardRef.current) return;
    selectedCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId, showAll, filter, query]);

  const openAssignmentByRequest = useMemo(() => {
    const map = new Map();
    for (const assignment of assignments) {
      if (!OPEN_STATUSES.has(assignment.status)) continue;
      map.set(String(assignment.requestId), assignment);
    }
    return map;
  }, [assignments]);

  const criticalCount = requests.filter(isCritical).length;
  const unassignedCount = requests.filter((r) => r.status === "pending").length;
  const filtered = requests.filter((r) => {
    const matchesFilter = filter === "all" || (filter === "critical" ? isCritical(r) : r.status === "pending");
    const searchable = `SOS #${r.id} R-${r.id} ${r.description} ${r.lat} ${r.lon}`.toLowerCase();
    return matchesFilter && searchable.includes(query.trim().toLowerCase());
  });
  const visible = showAll ? filtered : filtered.slice(0, 3);
  const selected = filtered.find((r) => String(r.id) === String(selectedId))
    ?? visible.find((r) => String(r.id) === String(selectedId))
    ?? null;
  const hasPending = requests.some((r) => r.status === "pending" && !openAssignmentByRequest.has(String(r.id)));

  function selectRequest(id) {
    onSelectRequest?.(id == null ? null : String(id));
    setReviewId(null);
  }

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
      <p className={styles.subtitle}>Manual assign or auto-recommend, then confirm and complete</p>
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
          const active = selected && String(selected.id) === String(request.id);
          const assignment = openAssignmentByRequest.get(String(request.id));
          const team = assignment && teams.find((t) => t.id === assignment.teamId);
          const wait = now === null ? "—" : `${Math.max(0, Math.floor((now - Number(request.createdAt.microsSinceUnixEpoch / 1000n)) / 60000))} min`;
          const critical = isCritical(request);
          const availableTeams = teams
            .filter((t) => t.status === "available")
            .slice()
            .sort((a, b) => Number(milesBetween(request, a)) - Number(milesBetween(request, b)));
          const selectedTeamId = manualTeamByRequest[String(request.id)] ?? (availableTeams[0] ? String(availableTeams[0].id) : "");
          const canManualAssign = request.status === "pending" && !assignment && availableTeams.length > 0;
          const canRecommendFor = request.status === "pending" && !assignment;
          const canConfirm = assignment?.status === "recommended" && team;
          const canCancel = assignment?.status === "recommended";
          const canComplete = assignment && (assignment.status === "confirmed" || assignment.status === "en_route");
          const noTeamReason = request.status === "pending" && !assignment && availableTeams.length === 0
            ? "All rescue teams are currently busy."
            : null;

          return (
            <article
              key={String(request.id)}
              ref={active ? selectedCardRef : null}
              className={`${styles.request} ${active ? styles.selected : ""}`}
            >
              <button className={styles.select} type="button" aria-expanded={active}
                onClick={() => selectRequest(request.id)}>
                <div className={styles.requestTop}>
                  <strong>SOS #{String(request.id)}</strong>
                  <span className={critical && request.status === "pending" ? styles.criticalBadge : styles.badge}>
                    {statusBadge(request)}
                  </span>
                </div>
                <p className={styles.description}>{request.description}</p>
                <p className={styles.meta}>{request.peopleCount} {request.peopleCount === 1 ? "person" : "people"} / Waiting {wait}</p>
              </button>
              {active && (
                <div className={styles.details}>
                  <p className={styles.meta}>{request.lat.toFixed(4)}, {request.lon.toFixed(4)}</p>
                  <div className={styles.recommendation}>
                    {canManualAssign && (
                      <div className={styles.assignBlock}>
                        <label className={styles.assignLabel} htmlFor={`team-${String(request.id)}`}>
                          Assign team
                        </label>
                        <select
                          id={`team-${String(request.id)}`}
                          className={styles.teamSelect}
                          value={selectedTeamId}
                          onChange={(e) => setManualTeamByRequest((prev) => ({
                            ...prev,
                            [String(request.id)]: e.target.value,
                          }))}
                        >
                          {availableTeams.map((t) => (
                            <option key={String(t.id)} value={String(t.id)}>
                              {teamOptionLabel(t, request)}
                            </option>
                          ))}
                        </select>
                        <button
                          className={styles.primary}
                          type="button"
                          disabled={!connected || busy || !selectedTeamId}
                          onClick={() => perform(() => onAssign(request.id, BigInt(selectedTeamId)))}
                        >
                          {busy ? "Assigning…" : "Assign selected team"}
                        </button>
                        <button
                          className={styles.secondary}
                          type="button"
                          disabled={!connected || busy || !canRecommendFor}
                          onClick={() => perform(() => onRecommendFor(request.id))}
                        >
                          Auto-recommend for this SOS
                        </button>
                      </div>
                    )}

                    {noTeamReason && (
                      <p className={styles.meta}>{noTeamReason}</p>
                    )}

                    {team && assignment?.status === "recommended" ? <>
                      <p className={styles.suggested}>Suggested: {team.name}</p>
                      <p className={styles.meta}>
                        {[team.hasBoat && "Boat", team.hasMedical && "Medic"].filter(Boolean).join(" + ") || "Rescue team"} / {milesBetween(request, team)} mi straight-line
                      </p>
                      {reviewId === String(assignment.id) ? <>
                        <p className={styles.meta}>Confirm {team.name} for SOS #{String(request.id)} ({request.peopleCount} people)?</p>
                        <button className={styles.primary} type="button" disabled={!connected || busy || team.status !== "available" || !canConfirm}
                          onClick={() => perform(() => onConfirm(assignment.id))}>
                          {busy ? "Dispatching…" : "Confirm dispatch"}
                        </button>
                        <button className={styles.cancel} type="button" onClick={() => setReviewId(null)}>Cancel review</button>
                      </> : (
                        <button className={styles.primary} type="button" disabled={!connected || busy}
                          onClick={() => setReviewId(String(assignment.id))}>Review request & dispatch team</button>
                      )}
                      {canCancel && (
                        <button
                          className={styles.cancel}
                          type="button"
                          disabled={!connected || busy}
                          onClick={() => perform(() => onCancel(assignment.id))}
                        >
                          Cancel recommendation
                        </button>
                      )}
                    </> : null}

                    {team && canComplete ? <>
                      <p className={styles.suggested}>Dispatched: {team.name}</p>
                      <p className={styles.meta}>
                        Team is busy on this SOS. Complete when the rescue is done.
                      </p>
                      <button
                        className={styles.primary}
                        type="button"
                        disabled={!connected || busy}
                        onClick={() => perform(() => onComplete(assignment.id))}
                      >
                        {busy ? "Completing…" : "Complete rescue"}
                      </button>
                    </> : null}

                    {!team && request.status !== "pending" && (
                      <p className={styles.meta}>No open assignment found for this request.</p>
                    )}
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
