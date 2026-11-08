"use client";

import { useState } from "react";
import styles from "./DeveloperPanel.module.css";

export default function DeveloperPanel({ isPlaying, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <aside className={styles.panel} aria-label="Developer override">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls="developer-override-controls"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.title}>
          <span className={styles.icon} aria-hidden="true">&gt;_</span>
          Developer override
        </span>
        <span className={styles.indicator}>
          {isPlaying ? "RUNNING" : "PAUSED"}
        </span>
        <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
      </button>

      <div
        id="developer-override-controls"
        className={styles.body}
        hidden={!isOpen}
      >
        <p className={styles.label}>GLOBAL DEMO STATE</p>
        {children}
      </div>
    </aside>
  );
}
