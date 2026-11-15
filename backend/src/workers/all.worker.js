import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const children = [
  spawn(process.execPath, [path.join(directory, 'document-index.worker.js')], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [path.join(directory, 'ocr.worker.js')], { stdio: 'inherit', env: process.env }),
];
let stopping = false;
let exitCode = 0;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

for (const child of children) {
  child.on('error', error => {
    process.stderr.write(`[worker-supervisor] ${error.message}\n`);
    exitCode = 1;
    stop('SIGTERM');
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      exitCode = code && code !== 0 ? code : 1;
      stop('SIGTERM');
    }
    if (children.every(item => item.exitCode !== null || item.signalCode !== null)) process.exit(exitCode);
  });
}
