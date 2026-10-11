#!/usr/bin/env node

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    mode: { type: 'string', choices: ['backend', 'frontend'] },
    root: { type: 'string' },
    coverage: { type: 'string' },
    threshold: { type: 'string', default: '60' },
  },
});

if (!values.mode || !values.root) {
  console.error('Usage: untested-files.mjs --mode <backend|frontend> --root <dir> [--coverage <json>] [--threshold 60]');
  process.exit(2);
}

const backendExcluded = /(^|\/)(types\.ts|[^/]*\.d\.ts)$|(^|\/)generated(\/|$)/;
const frontendExcluded =
  /(^|\/)(main\.tsx|types\.ts|[^/]*\.types\.ts|[^/]*\.d\.ts|index\.ts|constants\.(ts|tsx)|[^/]*\.constants\.ts|[^/]*\.test\.(ts|tsx)|[^/]*\.stories\.(ts|tsx)|queryKeys\.ts|queryClient\.ts)$|(^|\/)(test|design-system)(\/|$)/;

function walk(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'generated' || entry === 'node_modules') continue;
      out.push(...walk(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

const sources =
  values.mode === 'backend'
    ? walk(join(values.root, 'src'), (f) => f.endsWith('.ts') && !backendExcluded.test(f))
    : walk(join(values.root, 'src'), (f) => /\.(ts|tsx)$/.test(f) && !frontendExcluded.test(f));

const missing = [];
for (const source of sources) {
  const expected =
    values.mode === 'backend'
      ? join(values.root, 'tests', `${basename(source, extname(source))}.test.ts`)
      : source.replace(/\.tsx?$/, '') + (source.endsWith('.tsx') ? '.test.tsx' : '.test.ts');
  if (!existsSync(expected)) missing.push(relative(values.root, source));
}

const label = values.mode === 'backend' ? 'Backend' : 'Frontend';

console.log(`### ${label} test coverage gaps\n`);
if (missing.length === 0) {
  console.log('Every source file has a corresponding test file. ✅\n');
} else {
  console.log(`${missing.length} source file(s) without a test file:\n`);
  for (const file of missing) console.log(`- ${file}`);
  console.log('');
}

if (values.coverage) {
  const threshold = Number(values.threshold);
  let summary;
  try {
    summary = JSON.parse(readFileSync(values.coverage, 'utf8'));
  } catch (error) {
    console.error(`Cannot read ${values.coverage}: ${error.message}`);
    process.exit(2);
  }
  const rootAbs = resolve(values.root);
  const missingSet = new Set(missing);
  const low = [];
  for (const [file, entry] of Object.entries(summary)) {
    if (file === 'total') continue;
    const pct = entry?.lines?.pct;
    if (typeof pct !== 'number' || pct >= threshold) continue;
    const rel = relative(rootAbs, file);
    if (missingSet.has(rel)) continue;
    low.push([rel, pct]);
  }
  console.log(`### ${label} low-coverage files (<${threshold}% lines)\n`);
  if (low.length === 0) {
    console.log(`No tested file is below ${threshold}% line coverage. ✅\n`);
  } else {
    low.sort((a, b) => a[1] - b[1]);
    for (const [file, pct] of low) console.log(`- ${file} — ${pct}% lines`);
    console.log('');
  }
}
