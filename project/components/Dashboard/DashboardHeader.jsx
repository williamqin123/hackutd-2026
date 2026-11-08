import styles from "./DashboardHeader.module.css";

export default function DashboardHeader({ isConnected, isReady }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          ≈
        </span>

        <div>
          <p className={styles.name}>ResQAI</p>
          <p className={styles.subtitle}>Houston response center</p>
        </div>
      </div>

      <div className={styles.status}>
        <span className={styles.badge}>Demo data</span>

        <span role="status">
          {!isConnected
            ? "Disconnected"
            : isReady
              ? "Connected"
              : "Loading data…"}
        </span>
      </div>
    </header>
  );
}