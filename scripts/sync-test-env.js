'use strict';
/**
 * Apply test/process.js env to process.env before leo-cli runs.
 * Browserify evaluates require("leo-sdk") while bundling APIs; at that moment
 * functionWrap's async process.js loader has not run yet, so leosdk is missing
 * and leo-sdk throws "Invalid Settings: Missing kinesis, s3, firehose".
 */
const path = require('path');
const root = path.resolve(__dirname, '..');

function apply() {
	const proc = require(path.join(root, 'test/process.js'));
	const env = proc.env || {};
	for (const [k, v] of Object.entries(env)) {
		process.env[k] = typeof v === 'string' ? v : JSON.stringify(v);
	}
}

module.exports = { apply };

if (require.main === module) {
	apply();
}
