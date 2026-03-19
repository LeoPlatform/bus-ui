#!/usr/bin/env node
'use strict';
/**
 * Webpack 4 / babel-loader on Node 17+ need OpenSSL legacy provider (MD4, etc.).
 */
module.exports = function ensureLegacyOpenssl() {
	if (!/\bopenssl-legacy-provider\b/.test(process.env.NODE_OPTIONS || '')) {
		process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--openssl-legacy-provider']
			.filter(Boolean)
			.join(' ')
			.trim();
	}
};
