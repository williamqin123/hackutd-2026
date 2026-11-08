"use client";

import { useEffect, useState } from "react";

export default function SummaryCards({ requests, teams, requestsReady, teamsReady }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const active = requests.filter((request) =>
    ["pending", "recommended", "assigned"].includes(request.status),
  );
  const awaiting = active.filter((request) =>
    request.status === "pending" || request.status === "recommended",
  );
  const available = teams.filter((team) => team.status === "available");
  const boatAndMedic = available.some((team) => team.hasBoat && team.hasMedical);
  const longestWait = now === null ? null : awaiting.reduce((longest, request) => {
    const created = Number(request.createdAt.microsSinceUnixEpoch / 1000n);
    return Math.max(longest, Math.floor((now - created) / 60000));
  }, 0);

  const card = "min-w-0 rounded-2xl border border-wb-border p-6 shadow-sm";

  return (
    <section className="my-0 mb-6 grid grid-cols-1 gap-5 min-[1101px]:grid-cols-3" aria-label="Response summary">
      <article className={`${card} bg-wb-danger-soft text-wb-danger`}>
        <h2 className="m-0 mb-3 text-sm font-semibold">Active SOS</h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="m-0 font-mono text-[clamp(30px,3vw,40px)] leading-tight font-semibold tracking-tight tabular-nums">{requestsReady ? active.length : "—"}</p>
          <p className="m-0 text-xs leading-relaxed">Active requests on the map</p>
        </div>
      </article>

      <article className={`${card} bg-wb-warning-soft text-wb-warning`}>
        <h2 className="m-0 mb-3 text-sm font-semibold">Awaiting a team</h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="m-0 font-mono text-[clamp(30px,3vw,40px)] leading-tight font-semibold tracking-tight tabular-nums">{requestsReady ? awaiting.length : "—"}</p>
          <p className="m-0 text-xs leading-relaxed">
            {!requestsReady || longestWait === null
              ? "Loading wait times…"
              : awaiting.length === 0
                ? "No requests waiting"
                : `Longest wait: ${longestWait} min`}
          </p>
        </div>
      </article>

      <article className={`${card} bg-wb-success-soft text-wb-success`}>
        <h2 className="m-0 mb-3 text-sm font-semibold">Teams available</h2>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="m-0 font-mono text-[clamp(30px,3vw,40px)] leading-tight font-semibold tracking-tight tabular-nums">
            {teamsReady ? `${available.length} / ${teams.length}` : "—"}
          </p>
          <p className="m-0 text-xs leading-relaxed">
            {!teamsReady
              ? "Loading teams…"
              : boatAndMedic
                ? "Boat + medic available"
                : "No boat + medic team available"}
          </p>
        </div>
      </article>
    </section>
  );
}
