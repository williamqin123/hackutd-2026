'use client';

import { useCallback, useEffect, useState } from 'react';
import FloodTable from '../../../components/FloodTable.jsx';
import FloodMap from '../../../components/FloodMap.jsx';
import { getFloods } from '../../../lib/flood-service.js';

export default function DispatcherFloods() {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let stopped = false;
    async function load() {
      try {
        const rows = await getFloods({ signal: controller.signal });
        if (!stopped) { setRecords(rows); setError(''); }
      } catch (err) {
        if (!stopped && err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!stopped) { setBusy(false); timer = setTimeout(load, 5000); }
      }
    }
    setBusy(true); void load();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [revision]);
  return <main>
    <h1>Dispatcher: flood observations</h1>
    <p>Historical flood records. Refreshes every five seconds.</p>
    <button disabled={busy} onClick={refresh}>{busy ? 'Loading…' : 'Refresh'}</button>
    {error && <p role="alert">{error}</p>}
    {!busy && !error && !records.length && <p>No records imported yet. A developer can import the sample data.</p>}
    <FloodMap records={records} />
    <FloodTable records={records} />
  </main>;
}
