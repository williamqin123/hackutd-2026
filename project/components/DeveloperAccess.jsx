'use client';

import { useState } from 'react';
import { TOKEN_KEY } from '../lib/spacetime.js';

export default function DeveloperAccess() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  return <details><summary>Developer access</summary>
    <p>Use a Spacetime identity token authorized by the database publisher. It is kept for this browser tab only.</p>
    <form onSubmit={event => {
      event.preventDefault();
      sessionStorage.setItem(TOKEN_KEY, token.trim());
      setToken(''); setMessage('Token saved. Authorization is checked by Spacetime on each request.');
      window.dispatchEvent(new Event('developer-token-change'));
    }}>
      <label>Identity token<input type="password" autoComplete="off" required value={token} onChange={event => setToken(event.target.value)} /></label>
      <button type="submit">Save token</button>
      <button type="button" onClick={() => {
        sessionStorage.removeItem(TOKEN_KEY); setMessage('Token cleared.');
        window.dispatchEvent(new Event('developer-token-change'));
      }}>Clear token</button>
    </form>
    <p role="status">{message}</p>
  </details>;
}
