"use client";

import { useMemo } from "react";

function flagChips(req) {
  const chips = [];
  if (req.medicalUrgent) chips.push("medical");
  if (req.stranded) chips.push("stranded");
  if (req.needsTransport) chips.push("transport");
  chips.push(`${req.peopleCount} people`);
  return chips;
}

export default function DispatchBoard({
  requests = [],
  teams = [],
  assignments = [],
  selectedRequestId = null,
  onSelectRequest,
  isActive = false,
  busy = false,
  run,
}) {
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id.toString(), t])),
    [teams],
  );

  const assignmentByRequest = useMemo(() => {
    const map = new Map();
    const open = ["recommended", "confirmed", "en_route"];
    for (const a of assignments) {
      if (!open.includes(a.status) && a.status !== "completed") continue;
      const key = a.requestId.toString();
      const prev = map.get(key);
      if (!prev || open.includes(a.status)) map.set(key, a);
    }
    return map;
  }, [assignments]);

  const queue = useMemo(
    () =>
      [...requests]
        .filter((r) =>
          ["pending", "recommended", "assigned"].includes(r.status),
        )
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [requests],
  );

  const selectedAssignment = useMemo(() => {
    if (selectedRequestId == null) return null;
    return assignmentByRequest.get(String(selectedRequestId)) ?? null;
  }, [assignmentByRequest, selectedRequestId]);

  const confirmTarget =
    (selectedAssignment?.status === "recommended" && selectedAssignment) ||
    assignments.find((a) => a.status === "recommended") ||
    null;

  const completeTarget =
    (selectedAssignment &&
      (selectedAssignment.status === "confirmed" ||
        selectedAssignment.status === "en_route") &&
      selectedAssignment) ||
    assignments.find(
      (a) => a.status === "confirmed" || a.status === "en_route",
    ) ||
    null;

  return (
    <section className="dispatch-board" aria-label="Dispatch board">
      <h2>Dispatch board</h2>
      <p className="muted">
        Limited teams · highest priority gets the next capable nearby unit.
        Confirm locks a team as busy; Complete frees them. No live travel —
        matches only.
      </p>

      <div className="button-row">
        <button
          disabled={!isActive}
          onClick={() =>
            void run("create SOS", (c) =>
              c.reducers.createRescueRequest({
                lat: 29.75,
                lon: -95.37,
                peopleCount: 3,
                medicalUrgent: true,
                stranded: true,
                needsTransport: true,
                description: "Family stranded on roof, medical need",
              }),
            )
          }
        >
          Create urgent SOS
        </button>
        <button
          disabled={!isActive || busy}
          onClick={() =>
            void run("recommend", (c) => c.reducers.recommendDispatch())
          }
        >
          Recommend dispatch
        </button>
        <button
          disabled={!isActive || busy || !confirmTarget}
          onClick={() => {
            if (!confirmTarget) return;
            void run("confirm", (c) =>
              c.reducers.confirmDispatch({ assignmentId: confirmTarget.id }),
            );
          }}
        >
          Confirm
          {confirmTarget ? ` #${String(confirmTarget.requestId)}` : ""}
        </button>
        <button
          disabled={!isActive || busy || !completeTarget}
          onClick={() => {
            if (!completeTarget) return;
            void run("complete", (c) =>
              c.reducers.completeDispatch({ assignmentId: completeTarget.id }),
            );
          }}
        >
          Complete
          {completeTarget ? ` #${String(completeTarget.requestId)}` : ""}
        </button>
      </div>

      <h3>Priority queue</h3>
      <ul className="dispatch-queue">
        {queue.map((req, index) => {
          const assignment = assignmentByRequest.get(req.id.toString());
          const team = assignment
            ? teamById.get(assignment.teamId.toString())
            : null;
          const selected =
            selectedRequestId != null &&
            String(selectedRequestId) === String(req.id);
          return (
            <li key={String(req.id)}>
              <button
                type="button"
                className={`dispatch-queue-item${selected ? " selected" : ""}`}
                onClick={() =>
                  onSelectRequest?.(
                    selected ? null : req.id,
                  )
                }
              >
                <span className="dispatch-rank">#{index + 1}</span>
                <span className="dispatch-main">
                  <strong>SOS #{String(req.id)}</strong> · score{" "}
                  {req.priorityScore} · {req.status}
                  <br />
                  <span className="muted">
                    {flagChips(req).join(" · ")}
                    {team
                      ? ` · ${team.name} (${assignment.status})`
                      : " · unmatched"}
                  </span>
                  <br />
                  <span className="dispatch-desc">{req.description}</span>
                </span>
              </button>
            </li>
          );
        })}
        {queue.length === 0 && <li className="muted">No open requests</li>}
      </ul>

      <h3>Teams</h3>
      <ul>
        {teams.map((team) => (
          <li key={String(team.id)}>
            {team.name} · <strong>{team.status}</strong>
            {team.hasMedical ? " · medical" : ""}
            {team.hasBoat ? " · boat" : ""} · cap {team.capacity}
          </li>
        ))}
      </ul>
    </section>
  );
}
