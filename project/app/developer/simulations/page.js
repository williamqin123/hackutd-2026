'use client';

import { useState } from 'react';
import SimulationForm from '../../../components/SimulationForm.jsx';
import { importSampleFloods } from '../../../lib/flood-service.js';

export default function DeveloperSimulations() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  return <>
    <h1>Developer: simulations</h1>
    <p>Run a historical proximity screening scenario. Rainfall and duration calculate intensity and volume; they do not predict inundation.</p>
    <section><h2>Source data</h2>
      <p>Import the included Harvey 2017 observations. Existing source IDs are skipped.</p>
      <button disabled={busy} onClick={async () => {
        setBusy(true); setError(''); setMessage('Loading CSV…');
        try {
          const count = await importSampleFloods((done, total) => setMessage(`Processed ${done} of ${total} records.`));
          setMessage(`Import complete: ${count} records processed. Existing records were retained.`);
        } catch (err) { setError(err.message); setMessage(''); }
        finally { setBusy(false); }
      }}>{busy ? 'Importing…' : 'Import sample flood records'}</button>
      <p role="status">{message}</p>{error && <p role="alert">{error}</p>}
    </section>
    <SimulationForm />
  </>;
}
