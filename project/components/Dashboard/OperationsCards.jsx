import styles from "./OperationsCards.module.css";

export default function OperationsCards({ teams, teamsReady, events, eventsReady }) {
  const availableTeams = teams.filter((team) => team.status === "available");

  return (
    <div className={styles.grid}>
      <section className={styles.card} aria-label="Available teams">
        <h2>Available teams</h2>
        {!teamsReady ? (
          <p className={styles.empty}>Loading teams…</p>
        ) : availableTeams.length === 0 ? (
          <p className={styles.empty}>All teams are currently unavailable.</p>
        ) : (
          <ul className={styles.list}>
            {availableTeams.slice(0, 3).map((team) => (
              <li key={String(team.id)} className={styles.team}>
                <div>
                  <span>{team.name}</span>
                  <span className={styles.capabilities}>
                    {[team.hasBoat && "Boat", team.hasMedical && "Medic"].filter(Boolean).join(" + ") || "Rescue team"}
                  </span>
                </div>
                <span className={styles.free}><span aria-hidden="true">●</span> Free</span>
              </li>
            ))}
          </ul>
        )}
        {availableTeams.length > 3 && (
          <p className={styles.note}>+{availableTeams.length - 3} more available</p>
        )}
      </section>

      <section className={styles.card} aria-label="Recent activity">
        <h2>Recent activity</h2>
        {!eventsReady ? (
          <p className={styles.empty}>Loading activity…</p>
        ) : events.length === 0 ? (
          <p className={styles.empty}>No activity yet.</p>
        ) : (
          <ul className={styles.list}>
            {events.slice(0, 3).map((event) => {
              const date = new Date(Number(event.createdAt.microsSinceUnixEpoch / 1000n));
              return (
                <li key={String(event.id)} className={styles.event}>
                  <time dateTime={date.toISOString()} title={date.toUTCString()}>
                    {date.toISOString().slice(11, 16)}
                  </time>
                  <span>{event.message}</span>
                </li>
              );
            })}
          </ul>
        )}
        {events.length > 0 && <p className={styles.note}>Times in UTC</p>}
      </section>
    </div>
  );
}
