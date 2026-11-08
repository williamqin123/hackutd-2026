"use client";

import { useEffect, useState } from "react";
import styles from "./SummaryCards.module.css";

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

  return (
    <section className={styles.grid} aria-label="Response summary">
      <article className={`${styles.card} ${styles.critical}`}>
        <h2>Active SOS</h2>
        <div className={styles.content}>
          <p className={styles.value}>{requestsReady ? active.length : "—"}</p>
          <p className={styles.description}>Active requests on the map</p>
        </div>
      </article>

      <article className={`${styles.card} ${styles.waiting}`}>
        <h2>Awaiting a team</h2>
        <div className={styles.content}>
          <p className={styles.value}>{requestsReady ? awaiting.length : "—"}</p>
          <p className={styles.description}>
            {!requestsReady || longestWait === null
              ? "Loading wait times…"
              : awaiting.length === 0
                ? "No requests waiting"
                : `Longest wait: ${longestWait} min`}
          </p>
        </div>
      </article>

      <article className={`${styles.card} ${styles.teams}`}>
        <h2>Teams available</h2>
        <div className={styles.content}>
          <p className={styles.value}>
            {teamsReady ? `${available.length} / ${teams.length}` : "—"}
          </p>
          <p className={styles.description}>
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
