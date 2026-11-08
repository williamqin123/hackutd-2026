import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { projectRoot, portIsOpen, startBackend, publishLocal } from './local-spacetime.js';

const require = createRequire(import.meta.url);
let backend;
let frontend;
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  frontend?.kill('SIGTERM');
  backend?.kill('SIGTERM');
  process.exitCode = code;
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

try {
  if (await portIsOpen(3000)) {
    throw new Error('Port 3000 is already in use. If this app is already running, open http://localhost:3000. To restart it, press Ctrl+C in its terminal, then run npm run dev again.');
  }
  backend = await startBackend();
  await publishLocal();
  if (!stopping) {
    frontend = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--port', '3000'], {
      cwd: projectRoot, stdio: 'inherit',
    });
    frontend.once('error', error => { console.error(error.message); stop(1); });
    frontend.once('exit', code => stop(code || 0));
    backend?.once('exit', code => {
      if (!stopping) { console.error('Spacetime stopped; shutting down the frontend.'); stop(code || 1); }
    });
  } else backend?.kill('SIGTERM');
} catch (error) {
  console.error(error.message);
  stop(1);
}
