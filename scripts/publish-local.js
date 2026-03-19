#!/usr/bin/env node
'use strict';
/**
 * leo-cli publish with NODE_OPTIONS openssl legacy provider (same as npm start).
 */
const path = require('path');
const { spawnSync } = require('child_process');

require('./ensure-legacy-openssl')();

const root = path.resolve(__dirname, '..');
const passthrough = process.argv.slice(2);
const args = ['publish', '.', '--force', 'all'].concat(passthrough);

const r = spawnSync('leo-cli', args, {
	stdio: 'inherit',
	cwd: root,
	env: process.env,
	shell: true
});
process.exit(r.status === null ? 1 : r.status);
