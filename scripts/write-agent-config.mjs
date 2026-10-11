#!/usr/bin/env node

import { writeFileSync } from 'node:fs';

const DEFAULT_MODEL = 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free';

const providers = {
  opencode: { env: 'OPENCODE_API_KEY', config: (apiKey) => ({ options: { apiKey } }) },
  anthropic: { env: 'ANTHROPIC_API_KEY', config: (apiKey) => ({ options: { apiKey } }) },
  openai: { env: 'OPENAI_API_KEY', config: (apiKey) => ({ options: { apiKey } }) },
  openrouter: { env: 'OPENROUTER_API_KEY', config: (apiKey) => ({ options: { apiKey } }) },
};

const model = process.env.OPENCODE_MODEL || DEFAULT_MODEL;
const provider = model.includes('/') ? model.split('/')[0] : '';
const spec = providers[provider];
const apiKey = spec ? process.env[spec.env] : '';

if (!provider || !spec || !apiKey) {
  const detail = !model.includes('/')
    ? `OPENCODE_MODEL must be in "provider/model" format, got "${model}".`
    : !spec
      ? `unsupported provider "${provider}" (supported: ${Object.keys(providers).join(', ')}).`
      : `missing API key — add the ${spec.env} repository secret in Settings > Secrets and variables > Actions.`;
  console.error(`::error::Cannot configure OpenCode for model "${model}" (default: ${DEFAULT_MODEL}): ${detail}`);
  process.exit(1);
}

const config = {
  share: 'disabled',
  autoupdate: false,
  provider: {
    [provider]: spec.config(apiKey),
  },
};

writeFileSync(process.env.AGENT_CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
console.log(`OpenCode config written outside the worktree: provider "${provider}", model "${model}" (API key not logged).`);
