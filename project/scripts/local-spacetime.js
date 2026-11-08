import { spawn } from 'node:child_process';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const localRoot = path.join(projectRoot, '.spacetime');
const binDir = path.join(localRoot, 'bin');
const dataDir = path.join(localRoot, 'data');
const cliRoot = path.join(localRoot, 'cli');
const cli = path.join(binDir, 'spacetimedb-cli');
const server = path.join(binDir, 'spacetimedb-standalone');
const privateKey = path.join(dataDir, 'identity.pem');
const publicKey = path.join(dataDir, 'identity.pub');
const version = '2.14.0';

async function exists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited with code ${code}.`)));
  });
}

async function ensureTools() {
  if (await exists(cli) && await exists(server)) return;
  const platform = { darwin: 'apple-darwin', linux: 'unknown-linux-gnu' }[process.platform];
  const arch = { arm64: 'aarch64', x64: 'x86_64' }[process.arch];
  if (!platform || !arch) throw new Error('Local setup currently supports macOS and Linux on arm64 or x64.');
  await mkdir(binDir, { recursive: true, mode: 0o700 });
  const archive = path.join(localRoot, 'spacetime.tar.gz');
  console.log(`Downloading Spacetime ${version} from its official GitHub release (first run only)…`);
  const response = await fetch(`https://github.com/clockworklabs/SpacetimeDB/releases/download/v${version}/spacetime-${arch}-${platform}.tar.gz`);
  if (!response.ok) throw new Error(`Spacetime download failed: HTTP ${response.status}.`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
  await run('tar', ['-xzf', archive, '-C', binDir]);
  await chmod(cli, 0o755);
  await chmod(server, 0o755);
  await unlink(archive);
}

async function ensureKeys() {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  if (!await exists(privateKey)) {
    const pair = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    await writeFile(privateKey, pair.privateKey, { mode: 0o600 });
    await writeFile(publicKey, pair.publicKey, { mode: 0o600 });
  } else if (!await exists(publicKey)) {
    await writeFile(publicKey, createPublicKey(await readFile(privateKey)).export({ type: 'spki', format: 'pem' }), { mode: 0o600 });
  }
}

export function portIsOpen(port = 3001) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

export async function startBackend() {
  await ensureTools();
  if (await portIsOpen()) {
    console.log('Using the existing backend on 127.0.0.1:3001.');
    return null;
  }
  await ensureKeys();
  console.log('Starting Spacetime on internal port 3001. Data stays in .spacetime/data.');
  const child = spawn(server, ['start', '--listen-addr', '127.0.0.1:3001',
    '--data-dir', dataDir, '--jwt-priv-key-path', privateKey, '--jwt-pub-key-path', publicKey,
    '--non-interactive'], { cwd: projectRoot, stdio: 'inherit' });
  let error;
  child.once('error', value => { error = value; });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (error || child.exitCode !== null) {
      child.kill();
      throw error || new Error('Spacetime could not start. See the server output above.');
    }
    if (await portIsOpen()) return child;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error('Timed out waiting for Spacetime on port 3001.');
}

export async function publishLocal() {
  await ensureTools();
  await run(process.execPath, ['scripts/build-module.js']);
  await run(cli, ['--root-dir', cliRoot, 'publish', '--no-config',
    '--server', 'http://127.0.0.1:3001', '--js-path', 'spacetimedb/dist/module.js',
    '--delete-data=never', '--yes=skip-login', 'flood-db']);
}

async function main() {
  const mode = process.argv[2] || 'start';
  if (mode === 'publish') {
    if (!await portIsOpen()) throw new Error('Start the backend first with npm run spacetime:start.');
    await publishLocal();
  } else if (mode === 'token') {
    await ensureTools();
    // Explicit user command only: never called automatically by startup.
    await run(cli, ['--root-dir', cliRoot, 'login', 'show', '--token']);
  } else if (mode === 'start') {
    const child = await startBackend();
    if (child) {
      process.once('SIGINT', () => child.kill('SIGINT'));
      process.once('SIGTERM', () => child.kill('SIGTERM'));
      child.once('exit', code => { process.exitCode = code || 0; });
    }
  } else throw new Error(`Unknown local Spacetime command: ${mode}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
