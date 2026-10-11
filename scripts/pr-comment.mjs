#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    pr: { type: 'string' },
    file: { type: 'string' },
    header: { type: 'string', default: 'Report' },
    marker: { type: 'string' },
    repo: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const missing = ['pr', 'file', 'marker'].filter((key) => !values[key]);
if (missing.length > 0) {
  console.error(`Missing required args: ${missing.map((m) => `--${m}`).join(', ')}`);
  process.exit(2);
}

const pr = Number(values.pr);
if (!Number.isInteger(pr) || pr <= 0) {
  console.error(`--pr must be a positive integer, got: ${values.pr}`);
  process.exit(2);
}

let body;
try {
  body = readFileSync(values.file, 'utf8').trim();
} catch (error) {
  console.error(`Cannot read ${values.file}: ${error.message}`);
  process.exit(2);
}

const markerComment = `<!-- pr-comment:${values.marker} -->`;
const newBody = `${markerComment}\n## ${values.header}\n\n${body}\n`;

if (values['dry-run']) {
  console.log(newBody);
  process.exit(0);
}

const token = process.env.GITHUB_TOKEN;
const repo = values.repo || process.env.GITHUB_REPOSITORY;
if (!token || !repo) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY (or --repo) are required');
  process.exit(2);
}

const api = `https://api.github.com/repos/${repo}/issues/${pr}/comments`;

async function call(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'pr-comment-script',
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text.slice(0, 400)}`);
  }
  return response.json();
}

try {
  let existing = null;
  for (let page = 1; !existing; page++) {
    const comments = await call(`${api}?per_page=100&page=${page}`, { method: 'GET' });
    existing = comments.find((c) => c.body?.includes(markerComment));
    if (comments.length < 100) break;
  }

  if (existing) {
    await call(`${api}/${existing.id}`, { method: 'PATCH', body: JSON.stringify({ body: newBody }) });
    console.log(`Updated comment ${existing.id} on ${repo}#${pr} (${values.marker})`);
  } else {
    const created = await call(api, { method: 'POST', body: JSON.stringify({ body: newBody }) });
    console.log(`Created comment ${created.id} on ${repo}#${pr} (${values.marker})`);
  }
} catch (error) {
  console.error(`Failed to publish PR comment: ${error.message}`);
  process.exit(1);
}
