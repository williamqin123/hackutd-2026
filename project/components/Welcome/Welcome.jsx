import Link from "next/link";
import styles from "./Welcome.module.css";
import ThemeToggle from "../ThemeToggle";

export default function Welcome() {
  return (
    <main className={styles.page}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className={styles.brand}>
        <img className={styles.logo} src="/favicon-teal.svg" alt="" width="46" height="46" />

        <span>WaterBoard</span>
        </div>
        <ThemeToggle />
      </header>

      <div className={styles.content}>
        <span className={styles.badge}>Emergency response demo</span>

        <h1>Help starts with a connection.</h1>

        <p className={styles.intro}>
          Request assistance or open the response dashboard to
          coordinate rescue efforts.
        </p>

        <nav className={styles.choices} aria-label="Choose a destination">
          <Link href="/mobile/sos" className={styles.sosCard}>
            <span className={styles.sosIcon} aria-hidden="true">
              SOS
            </span>

            <h2>I need help</h2>

            <p>
              Share your location and tell the response team
              what is happening.
            </p>

            <span className={styles.sosAction}>
              Send an SOS <span aria-hidden="true">↗</span>
            </span>
          </Link>

          <Link href="/dashboard" className={styles.dashboardCard}>
            <span className={styles.dashboardIcon} aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </span>

            <h2>I coordinate response</h2>

            <p>
              Monitor SOS requests, view conditions, and
              coordinate available rescue teams.
            </p>

            <span className={styles.dashboardAction}>
              View dashboard <span aria-hidden="true">↗</span>
            </span>
          </Link>
        </nav>

        <p className={styles.note}>
          Connecting people who need help with teams who can respond.
        </p>
      </div>
    </main>
  );
}
