LEOCognito = {};
(function () {
	var pendingRequests = [];
	var isFetchingToken = false;

	LEOCognito.start = function (poolId, getToken, opts, callback) {
		AWS.config.region = poolId.split(/:/)[0];
		AWS.config.credentials = new AWS.CognitoIdentityCredentials({
			IdentityPoolId: poolId
		});

		var loadCallbacks = [];

		function loadTokens(callback) {
			if (callback) loadCallbacks.push(callback);
			if (!isFetchingToken) {
				isFetchingToken = true;
				if (getToken) {
					getToken(function (credentials) {
						AWS.config.credentials.params.IdentityId = credentials.IdentityId;
						AWS.config.credentials.params.Logins = {};
						for (var key in credentials.Logins) {
							AWS.config.credentials.params.Logins[key] = credentials.Logins[key];
						}
						AWS.config.credentials.expired = true;
						AWS.config.credentials.get(function () {
							isFetchingToken = false;
							for (var i = 0; i < loadCallbacks.length; i++) {
								loadCallbacks[i]();
							}
							loadCallbacks = [];
						});
					});
				} else {
					AWS.config.credentials.get(function () {
						isFetchingToken = false;
						for (var i = 0; i < loadCallbacks.length; i++) {
							loadCallbacks[i]();
						}
						loadCallbacks = [];
					});
				}
			}
		};
		loadTokens();

		function addPendingRequest(request) {
			pendingRequests.push(request);
			loadTokens(function () {
				var requests = pendingRequests.slice(0);
				pendingRequests = [];
				for (var i = 0; i < requests.length; i++) {
					$.ajax(requests[i]);
				}
			});
		}

		$.ajaxPrefilter(function (options, originalOptions, jqXHR) {
			if (options.url.indexOf(opts.apiUri) === 0) {
				originalOptions.leo_attempt = (originalOptions.leo_attempt || 0) + 1;
				var oldOnError = function () {};
				if (options.error) {
					oldOnError = options.error;
				}

				var needsRefreshed = AWS.config.credentials.needsRefresh();
				if (needsRefreshed && originalOptions.leo_attempt < 3) {
					jqXHR.abort();
					addPendingRequest(originalOptions);
				} else {
					var datetime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:\-]|\.\d{3}/g, '');
					var parser = document.createElement('a');
					parser.href = options.url;

					options.headers = {
						Accept: "application/json",
						'x-amz-date': datetime,
						Host: parser.hostname,
						'Content-Type': "application/json"
					};
					jqXHR.setRequestHeader("Authorization", signRequest(opts.region, AWS.config.credentials, options, parser, jqXHR));
					jqXHR.setRequestHeader("x-amz-date", datetime);
					jqXHR.setRequestHeader("x-amz-security-token", AWS.config.credentials.sessionToken);
					delete options.headers['Host'];
				}
			}
		});
		if (callback) callback();
	};

	var AWS_SHA_256 = 'AWS4-HMAC-SHA256';
	var AWS4_REQUEST = 'aws4_request';
	var AWS4 = 'AWS4';
	var X_AMZ_DATE = 'x-amz-date';
	var X_AMZ_SECURITY_TOKEN = 'x-amz-security-token';
	var HOST = 'host';
	var AUTHORIZATION = 'Authorization';

	function hash(value) {
		return CryptoJS.SHA256(value);
	}

	function hexEncode(value) {
		return value.toString(CryptoJS.enc.Hex);
	}

	function hmac(secret, value) {
		return CryptoJS.HmacSHA256(value, secret, {
			asBytes: true
		});
	}

	function buildCanonicalRequest(method, path, queryParams, headers, payload) {
		return method + '\n' +
			buildCanonicalUri(path) + '\n' +
			buildCanonicalQueryString(queryParams) + '\n' +
			buildCanonicalHeaders(headers) + '\n' +
			buildCanonicalSignedHeaders(headers) + '\n' +
			hexEncode(hash(payload));
	}

	function hashCanonicalRequest(request) {
		return hexEncode(hash(request));
	}

	function buildCanonicalUri(uri) {
		return encodeURI(uri).replace(/[!'()*]/g, function (c) {
			return '%' + c.charCodeAt(0).toString(16);
		}).replace(/\+/g, '%20');;
	}

	function buildCanonicalQueryString(queryParams) {
		if (queryParams.length <= 0) {
			return '';
		}
		queryParams.sort();
		return queryParams.map((param) => {
			var parts = param.split(/\=/);

			var key = parts[0];
			var value = parts.slice(1).join('=');

			return key.replace(/[!'()*]/g, function (c) {
				return '%' + c.charCodeAt(0).toString(16);
			}).replace(/\+/g, '%20') + '=' + value.replace(/[!'()*]/g, function (c) {
				return '%' + c.charCodeAt(0).toString(16);
			}).replace(/\+/g, '%20');
		}).join('&');
	}

	function buildCanonicalHeaders(headers) {
		var canonicalHeaders = '';
		var sortedKeys = [];
		for (var property in headers) {
			if (headers.hasOwnProperty(property)) {
				sortedKeys.push(property);
			}
		}
		sortedKeys.sort();

		for (var i = 0; i < sortedKeys.length; i++) {
			canonicalHeaders += sortedKeys[i].toLowerCase() + ':' + headers[sortedKeys[i]] + '\n';
		}
		return canonicalHeaders;
	}

	function buildCanonicalSignedHeaders(headers) {
		var sortedKeys = [];
		for (var property in headers) {
			if (headers.hasOwnProperty(property)) {
				sortedKeys.push(property.toLowerCase());
			}
		}
		sortedKeys.sort();

		return sortedKeys.join(';');
	}

	function buildStringToSign(datetime, credentialScope, hashedCanonicalRequest) {
		return AWS_SHA_256 + '\n' +
			datetime + '\n' +
			credentialScope + '\n' +
			hashedCanonicalRequest;
	}

	function buildCredentialScope(datetime, region, service) {
		return datetime.substr(0, 8) + '/' + region + '/' + service + '/' + AWS4_REQUEST
	}

	function calculateSigningKey(secretKey, datetime, region, service) {
		return hmac(hmac(hmac(hmac(AWS4 + secretKey, datetime.substr(0, 8)), region), service), AWS4_REQUEST);
	}

	function calculateSignature(key, stringToSign) {
		return hexEncode(hmac(key, stringToSign));
	}

	function buildAuthorizationHeader(accessKey, credentialScope, headers, signature) {
		return AWS_SHA_256 + ' Credential=' + accessKey + '/' + credentialScope + ', SignedHeaders=' + buildCanonicalSignedHeaders(headers) + ', Signature=' + signature;
	}

	function signRequest(region, credentials, options, parsedURL, jqXHR) {
		var body;
		var verb = options.type.toUpperCase();

		if (options.data === undefined || verb === 'GET') { // override request body and set to empty when signing GET requests
			body = '';
		} else {
			body = options.data;
		}
		if (body === '' || body === undefined || body === null) {
			delete options.headers['Content-Type'];
		}

		var queryStringParams = [];
		if (parsedURL.href.match(/\?/)) {
			parsedURL.href.split(/\?/, 2)[1].split(/\&/).forEach(function (e) {
				queryStringParams.push(e);
			});
		}
		if (verb === 'GET' && options.data !== undefined) {
			options.data.split(/\&/).forEach(function (e) {
				queryStringParams.push(e);
			});
		}

		var path = parsedURL.pathname;
		if (path.charAt(0) != '/') {
			path = '/' + path;
		}
		var canonicalRequest = buildCanonicalRequest(verb, path, queryStringParams, options.headers, body);
		var hashedCanonicalRequest = hashCanonicalRequest(canonicalRequest);
		var credentialScope = buildCredentialScope(options.headers['x-amz-date'], region, 'execute-api');
		var stringToSign = buildStringToSign(options.headers['x-amz-date'], credentialScope, hashedCanonicalRequest);
		var signingKey = calculateSigningKey(credentials.secretAccessKey, options.headers['x-amz-date'], region, 'execute-api');
		var signature = calculateSignature(signingKey, stringToSign);

		return buildAuthorizationHeader(credentials.accessKeyId, credentialScope, options.headers, signature);;
	}
}());

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS = CryptoJS || function (h, s) {
	var f = {},
		g = f.lib = {},
		q = function () {},
		m = g.Base = {
			extend: function (a) {
				q.prototype = this;
				var c = new q;
				a && c.mixIn(a);
				c.hasOwnProperty("init") || (c.init = function () {
					c.$super.init.apply(this, arguments)
				});
				c.init.prototype = c;
				c.$super = this;
				return c
			},
			create: function () {
				var a = this.extend();
				a.init.apply(a, arguments);
				return a
			},
			init: function () {},
			mixIn: function (a) {
				for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
				a.hasOwnProperty("toString") && (this.toString = a.toString)
			},
			clone: function () {
				return this.init.prototype.extend(this)
			}
		},
		r = g.WordArray = m.extend({
			init: function (a, c) {
				a = this.words = a || [];
				this.sigBytes = c != s ? c : 4 * a.length
			},
			toString: function (a) {
				return (a || k).stringify(this)
			},
			concat: function (a) {
				var c = this.words,
					d = a.words,
					b = this.sigBytes;
				a = a.sigBytes;
				this.clamp();
				if (b % 4)
					for (var e = 0; e < a; e++) c[b + e >>> 2] |= (d[e >>> 2] >>> 24 - 8 * (e % 4) & 255) << 24 - 8 * ((b + e) % 4);
				else if (65535 < d.length)
					for (e = 0; e < a; e += 4) c[b + e >>> 2] = d[e >>> 2];
				else c.push.apply(c, d);
				this.sigBytes += a;
				return this
			},
			clamp: function () {
				var a = this.words,
					c = this.sigBytes;
				a[c >>> 2] &= 4294967295 <<
					32 - 8 * (c % 4);
				a.length = h.ceil(c / 4)
			},
			clone: function () {
				var a = m.clone.call(this);
				a.words = this.words.slice(0);
				return a
			},
			random: function (a) {
				for (var c = [], d = 0; d < a; d += 4) c.push(4294967296 * h.random() | 0);
				return new r.init(c, a)
			}
		}),
		l = f.enc = {},
		k = l.Hex = {
			stringify: function (a) {
				var c = a.words;
				a = a.sigBytes;
				for (var d = [], b = 0; b < a; b++) {
					var e = c[b >>> 2] >>> 24 - 8 * (b % 4) & 255;
					d.push((e >>> 4).toString(16));
					d.push((e & 15).toString(16))
				}
				return d.join("")
			},
			parse: function (a) {
				for (var c = a.length, d = [], b = 0; b < c; b += 2) d[b >>> 3] |= parseInt(a.substr(b,
					2), 16) << 24 - 4 * (b % 8);
				return new r.init(d, c / 2)
			}
		},
		n = l.Latin1 = {
			stringify: function (a) {
				var c = a.words;
				a = a.sigBytes;
				for (var d = [], b = 0; b < a; b++) d.push(String.fromCharCode(c[b >>> 2] >>> 24 - 8 * (b % 4) & 255));
				return d.join("")
			},
			parse: function (a) {
				for (var c = a.length, d = [], b = 0; b < c; b++) d[b >>> 2] |= (a.charCodeAt(b) & 255) << 24 - 8 * (b % 4);
				return new r.init(d, c)
			}
		},
		j = l.Utf8 = {
			stringify: function (a) {
				try {
					return decodeURIComponent(escape(n.stringify(a)))
				} catch (c) {
					throw Error("Malformed UTF-8 data");
				}
			},
			parse: function (a) {
				return n.parse(unescape(encodeURIComponent(a)))
			}
		},
		u = g.BufferedBlockAlgorithm = m.extend({
			reset: function () {
				this._data = new r.init;
				this._nDataBytes = 0
			},
			_append: function (a) {
				"string" == typeof a && (a = j.parse(a));
				this._data.concat(a);
				this._nDataBytes += a.sigBytes
			},
			_process: function (a) {
				var c = this._data,
					d = c.words,
					b = c.sigBytes,
					e = this.blockSize,
					f = b / (4 * e),
					f = a ? h.ceil(f) : h.max((f | 0) - this._minBufferSize, 0);
				a = f * e;
				b = h.min(4 * a, b);
				if (a) {
					for (var g = 0; g < a; g += e) this._doProcessBlock(d, g);
					g = d.splice(0, a);
					c.sigBytes -= b
				}
				return new r.init(g, b)
			},
			clone: function () {
				var a = m.clone.call(this);
				a._data = this._data.clone();
				return a
			},
			_minBufferSize: 0
		});
	g.Hasher = u.extend({
		cfg: m.extend(),
		init: function (a) {
			this.cfg = this.cfg.extend(a);
			this.reset()
		},
		reset: function () {
			u.reset.call(this);
			this._doReset()
		},
		update: function (a) {
			this._append(a);
			this._process();
			return this
		},
		finalize: function (a) {
			a && this._append(a);
			return this._doFinalize()
		},
		blockSize: 16,
		_createHelper: function (a) {
			return function (c, d) {
				return (new a.init(d)).finalize(c)
			}
		},
		_createHmacHelper: function (a) {
			return function (c, d) {
				return (new t.HMAC.init(a,
					d)).finalize(c)
			}
		}
	});
	var t = f.algo = {};
	return f
}(Math);
(function (h) {
	for (var s = CryptoJS, f = s.lib, g = f.WordArray, q = f.Hasher, f = s.algo, m = [], r = [], l = function (a) {
			return 4294967296 * (a - (a | 0)) | 0
		}, k = 2, n = 0; 64 > n;) {
		var j;
		a: {
			j = k;
			for (var u = h.sqrt(j), t = 2; t <= u; t++)
				if (!(j % t)) {
					j = !1;
					break a
				}
			j = !0
		}
		j && (8 > n && (m[n] = l(h.pow(k, 0.5))), r[n] = l(h.pow(k, 1 / 3)), n++);
		k++
	}
	var a = [],
		f = f.SHA256 = q.extend({
			_doReset: function () {
				this._hash = new g.init(m.slice(0))
			},
			_doProcessBlock: function (c, d) {
				for (var b = this._hash.words, e = b[0], f = b[1], g = b[2], j = b[3], h = b[4], m = b[5], n = b[6], q = b[7], p = 0; 64 > p; p++) {
					if (16 > p) a[p] =
						c[d + p] | 0;
					else {
						var k = a[p - 15],
							l = a[p - 2];
						a[p] = ((k << 25 | k >>> 7) ^ (k << 14 | k >>> 18) ^ k >>> 3) + a[p - 7] + ((l << 15 | l >>> 17) ^ (l << 13 | l >>> 19) ^ l >>> 10) + a[p - 16]
					}
					k = q + ((h << 26 | h >>> 6) ^ (h << 21 | h >>> 11) ^ (h << 7 | h >>> 25)) + (h & m ^ ~h & n) + r[p] + a[p];
					l = ((e << 30 | e >>> 2) ^ (e << 19 | e >>> 13) ^ (e << 10 | e >>> 22)) + (e & f ^ e & g ^ f & g);
					q = n;
					n = m;
					m = h;
					h = j + k | 0;
					j = g;
					g = f;
					f = e;
					e = k + l | 0
				}
				b[0] = b[0] + e | 0;
				b[1] = b[1] + f | 0;
				b[2] = b[2] + g | 0;
				b[3] = b[3] + j | 0;
				b[4] = b[4] + h | 0;
				b[5] = b[5] + m | 0;
				b[6] = b[6] + n | 0;
				b[7] = b[7] + q | 0
			},
			_doFinalize: function () {
				var a = this._data,
					d = a.words,
					b = 8 * this._nDataBytes,
					e = 8 * a.sigBytes;
				d[e >>> 5] |= 128 << 24 - e % 32;
				d[(e + 64 >>> 9 << 4) + 14] = h.floor(b / 4294967296);
				d[(e + 64 >>> 9 << 4) + 15] = b;
				a.sigBytes = 4 * d.length;
				this._process();
				return this._hash
			},
			clone: function () {
				var a = q.clone.call(this);
				a._hash = this._hash.clone();
				return a
			}
		});
	s.SHA256 = q._createHelper(f);
	s.HmacSHA256 = q._createHmacHelper(f)
})(Math);
(function () {
	var h = CryptoJS,
		s = h.enc.Utf8;
	h.algo.HMAC = h.lib.Base.extend({
		init: function (f, g) {
			f = this._hasher = new f.init;
			"string" == typeof g && (g = s.parse(g));
			var h = f.blockSize,
				m = 4 * h;
			g.sigBytes > m && (g = f.finalize(g));
			g.clamp();
			for (var r = this._oKey = g.clone(), l = this._iKey = g.clone(), k = r.words, n = l.words, j = 0; j < h; j++) k[j] ^= 1549556828, n[j] ^= 909522486;
			r.sigBytes = l.sigBytes = m;
			this.reset()
		},
		reset: function () {
			var f = this._hasher;
			f.reset();
			f.update(this._iKey)
		},
		update: function (f) {
			this._hasher.update(f);
			return this
		},
		finalize: function (f) {
			var g =
				this._hasher;
			f = g.finalize(f);
			g.reset();
			return g.finalize(this._oKey.clone().concat(f))
		}
	})
})();

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
var CryptoJS = CryptoJS || function (h, s) {
	var f = {},
		t = f.lib = {},
		g = function () {},
		j = t.Base = {
			extend: function (a) {
				g.prototype = this;
				var c = new g;
				a && c.mixIn(a);
				c.hasOwnProperty("init") || (c.init = function () {
					c.$super.init.apply(this, arguments)
				});
				c.init.prototype = c;
				c.$super = this;
				return c
			},
			create: function () {
				var a = this.extend();
				a.init.apply(a, arguments);
				return a
			},
			init: function () {},
			mixIn: function (a) {
				for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
				a.hasOwnProperty("toString") && (this.toString = a.toString)
			},
			clone: function () {
				return this.init.prototype.extend(this)
			}
		},
		q = t.WordArray = j.extend({
			init: function (a, c) {
				a = this.words = a || [];
				this.sigBytes = c != s ? c : 4 * a.length
			},
			toString: function (a) {
				return (a || u).stringify(this)
			},
			concat: function (a) {
				var c = this.words,
					d = a.words,
					b = this.sigBytes;
				a = a.sigBytes;
				this.clamp();
				if (b % 4)
					for (var e = 0; e < a; e++) c[b + e >>> 2] |= (d[e >>> 2] >>> 24 - 8 * (e % 4) & 255) << 24 - 8 * ((b + e) % 4);
				else if (65535 < d.length)
					for (e = 0; e < a; e += 4) c[b + e >>> 2] = d[e >>> 2];
				else c.push.apply(c, d);
				this.sigBytes += a;
				return this
			},
			clamp: function () {
				var a = this.words,
					c = this.sigBytes;
				a[c >>> 2] &= 4294967295 <<
					32 - 8 * (c % 4);
				a.length = h.ceil(c / 4)
			},
			clone: function () {
				var a = j.clone.call(this);
				a.words = this.words.slice(0);
				return a
			},
			random: function (a) {
				for (var c = [], d = 0; d < a; d += 4) c.push(4294967296 * h.random() | 0);
				return new q.init(c, a)
			}
		}),
		v = f.enc = {},
		u = v.Hex = {
			stringify: function (a) {
				var c = a.words;
				a = a.sigBytes;
				for (var d = [], b = 0; b < a; b++) {
					var e = c[b >>> 2] >>> 24 - 8 * (b % 4) & 255;
					d.push((e >>> 4).toString(16));
					d.push((e & 15).toString(16))
				}
				return d.join("")
			},
			parse: function (a) {
				for (var c = a.length, d = [], b = 0; b < c; b += 2) d[b >>> 3] |= parseInt(a.substr(b,
					2), 16) << 24 - 4 * (b % 8);
				return new q.init(d, c / 2)
			}
		},
		k = v.Latin1 = {
			stringify: function (a) {
				var c = a.words;
				a = a.sigBytes;
				for (var d = [], b = 0; b < a; b++) d.push(String.fromCharCode(c[b >>> 2] >>> 24 - 8 * (b % 4) & 255));
				return d.join("")
			},
			parse: function (a) {
				for (var c = a.length, d = [], b = 0; b < c; b++) d[b >>> 2] |= (a.charCodeAt(b) & 255) << 24 - 8 * (b % 4);
				return new q.init(d, c)
			}
		},
		l = v.Utf8 = {
			stringify: function (a) {
				try {
					return decodeURIComponent(escape(k.stringify(a)))
				} catch (c) {
					throw Error("Malformed UTF-8 data");
				}
			},
			parse: function (a) {
				return k.parse(unescape(encodeURIComponent(a)))
			}
		},
		x = t.BufferedBlockAlgorithm = j.extend({
			reset: function () {
				this._data = new q.init;
				this._nDataBytes = 0
			},
			_append: function (a) {
				"string" == typeof a && (a = l.parse(a));
				this._data.concat(a);
				this._nDataBytes += a.sigBytes
			},
			_process: function (a) {
				var c = this._data,
					d = c.words,
					b = c.sigBytes,
					e = this.blockSize,
					f = b / (4 * e),
					f = a ? h.ceil(f) : h.max((f | 0) - this._minBufferSize, 0);
				a = f * e;
				b = h.min(4 * a, b);
				if (a) {
					for (var m = 0; m < a; m += e) this._doProcessBlock(d, m);
					m = d.splice(0, a);
					c.sigBytes -= b
				}
				return new q.init(m, b)
			},
			clone: function () {
				var a = j.clone.call(this);
				a._data = this._data.clone();
				return a
			},
			_minBufferSize: 0
		});
	t.Hasher = x.extend({
		cfg: j.extend(),
		init: function (a) {
			this.cfg = this.cfg.extend(a);
			this.reset()
		},
		reset: function () {
			x.reset.call(this);
			this._doReset()
		},
		update: function (a) {
			this._append(a);
			this._process();
			return this
		},
		finalize: function (a) {
			a && this._append(a);
			return this._doFinalize()
		},
		blockSize: 16,
		_createHelper: function (a) {
			return function (c, d) {
				return (new a.init(d)).finalize(c)
			}
		},
		_createHmacHelper: function (a) {
			return function (c, d) {
				return (new w.HMAC.init(a,
					d)).finalize(c)
			}
		}
	});
	var w = f.algo = {};
	return f
}(Math);
(function (h) {
	for (var s = CryptoJS, f = s.lib, t = f.WordArray, g = f.Hasher, f = s.algo, j = [], q = [], v = function (a) {
			return 4294967296 * (a - (a | 0)) | 0
		}, u = 2, k = 0; 64 > k;) {
		var l;
		a: {
			l = u;
			for (var x = h.sqrt(l), w = 2; w <= x; w++)
				if (!(l % w)) {
					l = !1;
					break a
				}
			l = !0
		}
		l && (8 > k && (j[k] = v(h.pow(u, 0.5))), q[k] = v(h.pow(u, 1 / 3)), k++);
		u++
	}
	var a = [],
		f = f.SHA256 = g.extend({
			_doReset: function () {
				this._hash = new t.init(j.slice(0))
			},
			_doProcessBlock: function (c, d) {
				for (var b = this._hash.words, e = b[0], f = b[1], m = b[2], h = b[3], p = b[4], j = b[5], k = b[6], l = b[7], n = 0; 64 > n; n++) {
					if (16 > n) a[n] =
						c[d + n] | 0;
					else {
						var r = a[n - 15],
							g = a[n - 2];
						a[n] = ((r << 25 | r >>> 7) ^ (r << 14 | r >>> 18) ^ r >>> 3) + a[n - 7] + ((g << 15 | g >>> 17) ^ (g << 13 | g >>> 19) ^ g >>> 10) + a[n - 16]
					}
					r = l + ((p << 26 | p >>> 6) ^ (p << 21 | p >>> 11) ^ (p << 7 | p >>> 25)) + (p & j ^ ~p & k) + q[n] + a[n];
					g = ((e << 30 | e >>> 2) ^ (e << 19 | e >>> 13) ^ (e << 10 | e >>> 22)) + (e & f ^ e & m ^ f & m);
					l = k;
					k = j;
					j = p;
					p = h + r | 0;
					h = m;
					m = f;
					f = e;
					e = r + g | 0
				}
				b[0] = b[0] + e | 0;
				b[1] = b[1] + f | 0;
				b[2] = b[2] + m | 0;
				b[3] = b[3] + h | 0;
				b[4] = b[4] + p | 0;
				b[5] = b[5] + j | 0;
				b[6] = b[6] + k | 0;
				b[7] = b[7] + l | 0
			},
			_doFinalize: function () {
				var a = this._data,
					d = a.words,
					b = 8 * this._nDataBytes,
					e = 8 * a.sigBytes;
				d[e >>> 5] |= 128 << 24 - e % 32;
				d[(e + 64 >>> 9 << 4) + 14] = h.floor(b / 4294967296);
				d[(e + 64 >>> 9 << 4) + 15] = b;
				a.sigBytes = 4 * d.length;
				this._process();
				return this._hash
			},
			clone: function () {
				var a = g.clone.call(this);
				a._hash = this._hash.clone();
				return a
			}
		});
	s.SHA256 = g._createHelper(f);
	s.HmacSHA256 = g._createHmacHelper(f)
})(Math);

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
(function () {
	// Shortcuts
	var C = CryptoJS;
	var C_lib = C.lib;
	var Base = C_lib.Base;
	var C_enc = C.enc;
	var Utf8 = C_enc.Utf8;
	var C_algo = C.algo;

	/**
	 * HMAC algorithm.
	 */
	var HMAC = C_algo.HMAC = Base.extend({
		/**
		 * Initializes a newly created HMAC.
		 *
		 * @param {Hasher} hasher The hash algorithm to use.
		 * @param {WordArray|string} key The secret key.
		 *
		 * @example
		 *
		 *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
		 */
		init: function (hasher, key) {
			// Init hasher
			hasher = this._hasher = new hasher.init();

			// Convert string to WordArray, else assume WordArray already
			if (typeof key == 'string') {
				key = Utf8.parse(key);
			}

			// Shortcuts
			var hasherBlockSize = hasher.blockSize;
			var hasherBlockSizeBytes = hasherBlockSize * 4;

			// Allow arbitrary length keys
			if (key.sigBytes > hasherBlockSizeBytes) {
				key = hasher.finalize(key);
			}

			// Clamp excess bits
			key.clamp();

			// Clone key for inner and outer pads
			var oKey = this._oKey = key.clone();
			var iKey = this._iKey = key.clone();

			// Shortcuts
			var oKeyWords = oKey.words;
			var iKeyWords = iKey.words;

			// XOR keys with pad constants
			for (var i = 0; i < hasherBlockSize; i++) {
				oKeyWords[i] ^= 0x5c5c5c5c;
				iKeyWords[i] ^= 0x36363636;
			}
			oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

			// Set initial values
			this.reset();
		},

		/**
		 * Resets this HMAC to its initial state.
		 *
		 * @example
		 *
		 *     hmacHasher.reset();
		 */
		reset: function () {
			// Shortcut
			var hasher = this._hasher;

			// Reset
			hasher.reset();
			hasher.update(this._iKey);
		},

		/**
		 * Updates this HMAC with a message.
		 *
		 * @param {WordArray|string} messageUpdate The message to append.
		 *
		 * @return {HMAC} This HMAC instance.
		 *
		 * @example
		 *
		 *     hmacHasher.update('message');
		 *     hmacHasher.update(wordArray);
		 */
		update: function (messageUpdate) {
			this._hasher.update(messageUpdate);

			// Chainable
			return this;
		},

		/**
		 * Finalizes the HMAC computation.
		 * Note that the finalize operation is effectively a destructive, read-once operation.
		 *
		 * @param {WordArray|string} messageUpdate (Optional) A final message update.
		 *
		 * @return {WordArray} The HMAC.
		 *
		 * @example
		 *
		 *     var hmac = hmacHasher.finalize();
		 *     var hmac = hmacHasher.finalize('message');
		 *     var hmac = hmacHasher.finalize(wordArray);
		 */
		finalize: function (messageUpdate) {
			// Shortcut
			var hasher = this._hasher;

			// Compute HMAC
			var innerHash = hasher.finalize(messageUpdate);
			hasher.reset();
			var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

			return hmac;
		}
	});
}());

/*
CryptoJS v3.1.2
code.google.com/p/crypto-js
(c) 2009-2013 by Jeff Mott. All rights reserved.
code.google.com/p/crypto-js/wiki/License
*/
(function () {
	// Shortcuts
	var C = CryptoJS;
	var C_lib = C.lib;
	var WordArray = C_lib.WordArray;
	var C_enc = C.enc;

	/**
	 * Base64 encoding strategy.
	 */
	var Base64 = C_enc.Base64 = {
		/**
		 * Converts a word array to a Base64 string.
		 *
		 * @param {WordArray} wordArray The word array.
		 *
		 * @return {string} The Base64 string.
		 *
		 * @static
		 *
		 * @example
		 *
		 *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
		 */
		stringify: function (wordArray) {
			// Shortcuts
			var words = wordArray.words;
			var sigBytes = wordArray.sigBytes;
			var map = this._map;

			// Clamp excess bits
			wordArray.clamp();

			// Convert
			var base64Chars = [];
			for (var i = 0; i < sigBytes; i += 3) {
				var byte1 = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
				var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
				var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

				var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

				for (var j = 0;
					(j < 4) && (i + j * 0.75 < sigBytes); j++) {
					base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
				}
			}

			// Add padding
			var paddingChar = map.charAt(64);
			if (paddingChar) {
				while (base64Chars.length % 4) {
					base64Chars.push(paddingChar);
				}
			}

			return base64Chars.join('');
		},

		/**
		 * Converts a Base64 string to a word array.
		 *
		 * @param {string} base64Str The Base64 string.
		 *
		 * @return {WordArray} The word array.
		 *
		 * @static
		 *
		 * @example
		 *
		 *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
		 */
		parse: function (base64Str) {
			// Shortcuts
			var base64StrLength = base64Str.length;
			var map = this._map;

			// Ignore padding
			var paddingChar = map.charAt(64);
			if (paddingChar) {
				var paddingIndex = base64Str.indexOf(paddingChar);
				if (paddingIndex != -1) {
					base64StrLength = paddingIndex;
				}
			}

			// Convert
			var words = [];
			var nBytes = 0;
			for (var i = 0; i < base64StrLength; i++) {
				if (i % 4) {
					var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
					var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
					words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
					nBytes++;
				}
			}

			return WordArray.create(words, nBytes);
		},

		_map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
	};
}());
