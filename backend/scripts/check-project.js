import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = [path.join(backendRoot, 'src'), path.join(backendRoot, 'scripts')];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && full.endsWith('.js')) files.push(full);
  }
}
for (const root of sourceRoots) if (fs.existsSync(root)) walk(root);

function resolveRelativeImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.js'), path.join(base, 'index.mjs')];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

let failed = false;
let importsChecked = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`SYNTAX ERROR: ${path.relative(backendRoot, file)}\n${result.stderr}`);
  }
  const source = fs.readFileSync(file, 'utf8');
  const importPattern = /(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    importsChecked += 1;
    if (!resolveRelativeImport(file, match[1])) {
      failed = true;
      process.stderr.write(`UNRESOLVED IMPORT: ${path.relative(backendRoot, file)} -> ${match[1]}\n`);
    }
  }
}
if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} backend JavaScript files.`);
console.log(`Resolved ${importsChecked} relative import references.`);
