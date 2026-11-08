'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSimulation } from '../lib/simulation-service.js';

const fields = [
  ['latitude', 'Latitude', -90, 90, 29.99],
  ['longitude', 'Longitude', -180, 180, -95.24],
  ['rainfallMm', 'Rainfall (mm)', 0, 2000, 100],
  ['durationHours', 'Duration (hours)', 0.01, 168, 6],
  ['radiusKm', 'Search radius (km)', 0.1, 100, 10],
];

export default function SimulationForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <form onSubmit={async event => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      const id = await createSimulation(input);
      router.push(`/developer/simulations/${id}`);
    } catch (err) { setError(err.message); setBusy(false); }
  }}>
    <fieldset disabled={busy}><legend>Simulation inputs</legend>
      {fields.map(([name, label, min, max, value]) => <label key={name}>{label}
        <input name={name} type="number" step="any" min={min} max={max} defaultValue={value} required />
      </label>)}
      <button type="submit">{busy ? 'Submitting…' : 'Run simulation'}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
