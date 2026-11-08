import styles from "./MapControls.module.css";

export default function MapControls({ onCenter, onShowRequests, hasRequests, layers, onToggle }) {
  return (
    <div className={styles.controls} role="group" aria-label="Map controls">
      <div className={styles.group}>
        <button type="button" onClick={onCenter}>Center Houston</button>
        <button type="button" onClick={onShowRequests} disabled={!hasRequests}>
          View all SOS
        </button>
      </div>
      <div className={styles.group}>
        <span className={styles.label}>Layers</span>
        {[["teams", "Teams"], ["sensors", "Flood sensors"], ["storm", "Storm track"]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={layers[key]}
            onClick={() => onToggle(key)}
          >
            <span className={styles.dot} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
