#!/usr/bin/env node
'use strict';
/**
 * Load test/process.js into process.env, then run leo-cli test .
 * Ensures leosdk / Resources exist before API bundles pull in leo-sdk.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

if (!process.env.bus) {
	process.env.bus = 'TestCup';
}

const noLegacy = !/\bopenssl-legacy-provider\b/.test(process.env.NODE_OPTIONS || '');
if (noLegacy) {
	process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--openssl-legacy-provider'].filter(Boolean).join(' ').trim();
}

require('./sync-test-env').apply();

const r = spawnSync('leo-cli', ['test', '.'], {
	stdio: 'inherit',
	cwd: root,
	env: process.env,
	shell: true
});
process.exit(r.status === null ? 1 : r.status);
