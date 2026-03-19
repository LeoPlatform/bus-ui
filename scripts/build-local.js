#!/usr/bin/env node
'use strict';
/**
 * leo-cli publish --build --save with openssl legacy provider.
 */
const path = require('path');
const { spawnSync } = require('child_process');

require('./ensure-legacy-openssl')();

const root = path.resolve(__dirname, '..');
const passthrough = process.argv.slice(2);
const args = ['publish', '.', '--force', 'all', '--build', '--save'].concat(passthrough);

const r = spawnSync('leo-cli', args, {
	stdio: 'inherit',
	cwd: root,
	env: process.env,
	shell: true
});
process.exit(r.status === null ? 1 : r.status);
