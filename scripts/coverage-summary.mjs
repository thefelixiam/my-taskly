#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    coverage: { type: 'string' },
    title: { type: 'string', default: 'Coverage' },
  },
});

if (!values.coverage) {
  console.error('Missing --coverage <path to coverage-summary.json>');
  process.exit(2);
}

let summary;
try {
  summary = JSON.parse(readFileSync(values.coverage, 'utf8'));
} catch (error) {
  console.error(`Cannot read ${values.coverage}: ${error.message}`);
  process.exit(2);
}

const metrics = ['statements', 'branches', 'functions', 'lines'];

function pct(entry, metric) {
  const value = entry?.[metric]?.pct;
  return typeof value === 'number' ? value : 0;
}

function cell(value) {
  const mark = value < 80 ? '⛔' : value < 100 ? '⚠️' : '✅';
  return `${value}% ${mark}`;
}

function relName(key) {
  const idx = key.search(/(backend|frontend)[/]/);
  return idx >= 0 ? key.slice(idx) : key;
}

const files = Object.keys(summary)
  .filter((key) => key !== 'total')
  .sort((a, b) => pct(summary[a], 'lines') - pct(summary[b], 'lines'));

const lines = [];
lines.push(`### ${values.title}`);
lines.push('');
lines.push('| File | Stmts | Branch | Funcs | Lines |');
lines.push('| --- | --- | --- | --- | --- |');
const total = summary.total;
if (total) {
  lines.push(
    `| **Total** | ${cell(pct(total, 'statements'))} | ${cell(pct(total, 'branches'))} | ${cell(pct(total, 'functions'))} | ${cell(pct(total, 'lines'))} |`,
  );
}
for (const file of files) {
  const entry = summary[file];
  lines.push(
    `| ${relName(file)} | ${cell(pct(entry, 'statements'))} | ${cell(pct(entry, 'branches'))} | ${cell(pct(entry, 'functions'))} | ${cell(pct(entry, 'lines'))} |`,
  );
}
lines.push('');
console.log(lines.join('\n'));
