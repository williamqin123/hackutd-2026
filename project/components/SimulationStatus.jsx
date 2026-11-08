'use client';

import { useEffect, useState } from 'react';
import { getSimulation } from '../lib/simulation-service.js';
import FloodTable from './FloodTable.jsx';
import FloodMap from './FloodMap.jsx';

export default function SimulationStatus({ id }) {
  const [simulation, setSimulation] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let timer;
    let stopped = false;
    let controller;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      try {
        const value = await getSimulation(id, { signal: controller.signal });
        if (stopped) return;
        if (!value) throw new Error('Simulation not found.');
        setSimulation(value); setError('');
        if (!['completed', 'failed'].includes(value.status)) timer = setTimeout(refresh, 1500);
      } catch (err) {
        if (!stopped && err.name !== 'AbortError') setError(err.message);
      }
    }
    function restart() { clearTimeout(timer); setSimulation(null); void refresh(); }
    void refresh();
    window.addEventListener('developer-token-change', restart);
    return () => {
      stopped = true; clearTimeout(timer); controller?.abort();
      window.removeEventListener('developer-token-change', restart);
    };
  }, [id]);
  return <section>
    {error && <p role="alert">{error}</p>}
    {!simulation && !error && <p role="status">Loading simulation…</p>}
    {simulation && <>
      <p>Status: <strong>{simulation.status}</strong></p>
      <p>Location: {simulation.latitude}, {simulation.longitude}; rainfall: {simulation.rainfallMm} mm; duration: {simulation.durationHours} hours; radius: {simulation.radiusKm} km.</p>
      {simulation.error && <p role="alert">{simulation.error}</p>}
      {simulation.result && <>
        <h2>Screening results</h2>
        <p>{simulation.result.description}</p>
        <dl>
          <dt>Rainfall intensity</dt><dd>{simulation.result.rainfallIntensityMmPerHour.toFixed(2)} mm/hour</dd>
          <dt>Rainfall volume over the search area</dt><dd>{Math.round(simulation.result.rainfallVolumeM3).toLocaleString()} m³</dd>
          <dt>Historical observations nearby</dt><dd>{simulation.result.matchedRecords}</dd>
        </dl>
        <FloodMap records={simulation.result.points} />
        <FloodTable records={simulation.result.points} />
      </>}
    </>}
  </section>;
}
