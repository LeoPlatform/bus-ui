!function(t) {
    if ("object" == typeof exports && "undefined" != typeof module)
        module.exports = t();
    else if ("function" == typeof define && define.amd)
        define([], t);
    else {
        ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).buffer = t()
    }
}(function() {
    return function() {
        return function t(r, e, n) {
            function i(f, u) {
                if (!e[f]) {
                    if (!r[f]) {
                        var s = "function" == typeof require && require;
                        if (!u && s)
                            return s(f, !0);
                        if (o)
                            return o(f, !0);
                        var h = new Error("Cannot find module '" + f + "'");
                        throw h.code = "MODULE_NOT_FOUND",
                        h
                    }
                    var a = e[f] = {
                        exports: {}
                    };
                    r[f][0].call(a.exports, function(t) {
                        return i(r[f][1][t] || t)
                    }, a, a.exports, t, r, e, n)
                }
                return e[f].exports
            }
            for (var o = "function" == typeof require && require, f = 0; f < n.length; f++)
                i(n[f]);
            return i
        }
    }()({
        1: [function(t, r, e) {
            "use strict";
            e.byteLength = function(t) {
                var r = h(t)
                  , e = r[0]
                  , n = r[1];
                return 3 * (e + n) / 4 - n
            }
            ,
            e.toByteArray = function(t) {
                var r, e, n = h(t), f = n[0], u = n[1], s = new o(function(t, r, e) {
                    return 3 * (r + e) / 4 - e
                }(0, f, u)), a = 0, p = u > 0 ? f - 4 : f;
                for (e = 0; e < p; e += 4)
                    r = i[t.charCodeAt(e)] << 18 | i[t.charCodeAt(e + 1)] << 12 | i[t.charCodeAt(e + 2)] << 6 | i[t.charCodeAt(e + 3)],
                    s[a++] = r >> 16 & 255,
                    s[a++] = r >> 8 & 255,
                    s[a++] = 255 & r;
                2 === u && (r = i[t.charCodeAt(e)] << 2 | i[t.charCodeAt(e + 1)] >> 4,
                s[a++] = 255 & r);
                1 === u && (r = i[t.charCodeAt(e)] << 10 | i[t.charCodeAt(e + 1)] << 4 | i[t.charCodeAt(e + 2)] >> 2,
                s[a++] = r >> 8 & 255,
                s[a++] = 255 & r);
                return s
            }
            ,
            e.fromByteArray = function(t) {
                for (var r, e = t.length, i = e % 3, o = [], f = 0, u = e - i; f < u; f += 16383)
                    o.push(a(t, f, f + 16383 > u ? u : f + 16383));
                1 === i ? (r = t[e - 1],
                o.push(n[r >> 2] + n[r << 4 & 63] + "==")) : 2 === i && (r = (t[e - 2] << 8) + t[e - 1],
                o.push(n[r >> 10] + n[r >> 4 & 63] + n[r << 2 & 63] + "="));
                return o.join("")
            }
            ;
            for (var n = [], i = [], o = "undefined" != typeof Uint8Array ? Uint8Array : Array, f = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", u = 0, s = f.length; u < s; ++u)
                n[u] = f[u],
                i[f.charCodeAt(u)] = u;
            function h(t) {
                var r = t.length;
                if (r % 4 > 0)
                    throw new Error("Invalid string. Length must be a multiple of 4");
                var e = t.indexOf("=");
                return -1 === e && (e = r),
                [e, e === r ? 0 : 4 - e % 4]
            }
            function a(t, r, e) {
                for (var i, o, f = [], u = r; u < e; u += 3)
                    i = (t[u] << 16 & 16711680) + (t[u + 1] << 8 & 65280) + (255 & t[u + 2]),
                    f.push(n[(o = i) >> 18 & 63] + n[o >> 12 & 63] + n[o >> 6 & 63] + n[63 & o]);
                return f.join("")
            }
            i["-".charCodeAt(0)] = 62,
            i["_".charCodeAt(0)] = 63
        }
        , {}],
        2: [function(t, r, e) {
            (function(r) {
                "use strict";
                var n = t("base64-js")
                  , i = t("ieee754");
                e.Buffer = r,
                e.SlowBuffer = function(t) {
                    +t != t && (t = 0);
                    return r.alloc(+t)
                }
                ,
                e.INSPECT_MAX_BYTES = 50;
                var o = 2147483647;
                function f(t) {
                    if (t > o)
                        throw new RangeError('The value "' + t + '" is invalid for option "size"');
                    var e = new Uint8Array(t);
                    return e.__proto__ = r.prototype,
                    e
                }
                function r(t, r, e) {
                    if ("number" == typeof t) {
                        if ("string" == typeof r)
                            throw new TypeError('The "string" argument must be of type string. Received type number');
                        return h(t)
                    }
                    return u(t, r, e)
                }
                function u(t, e, n) {
                    if ("string" == typeof t)
                        return function(t, e) {
                            "string" == typeof e && "" !== e || (e = "utf8");
                            if (!r.isEncoding(e))
                                throw new TypeError("Unknown encoding: " + e);
                            var n = 0 | c(t, e)
                              , i = f(n)
                              , o = i.write(t, e);
                            o !== n && (i = i.slice(0, o));
                            return i
                        }(t, e);
                    if (ArrayBuffer.isView(t))
                        return a(t);
                    if (null == t)
                        throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t);
                    if (z(t, ArrayBuffer) || t && z(t.buffer, ArrayBuffer))
                        return function(t, e, n) {
                            if (e < 0 || t.byteLength < e)
                                throw new RangeError('"offset" is outside of buffer bounds');
                            if (t.byteLength < e + (n || 0))
                                throw new RangeError('"length" is outside of buffer bounds');
                            var i;
                            i = void 0 === e && void 0 === n ? new Uint8Array(t) : void 0 === n ? new Uint8Array(t,e) : new Uint8Array(t,e,n);
                            return i.__proto__ = r.prototype,
                            i
                        }(t, e, n);
                    if ("number" == typeof t)
                        throw new TypeError('The "value" argument must not be of type number. Received type number');
                    var i = t.valueOf && t.valueOf();
                    if (null != i && i !== t)
                        return r.from(i, e, n);
                    var o = function(t) {
                        if (r.isBuffer(t)) {
                            var e = 0 | p(t.length)
                              , n = f(e);
                            return 0 === n.length ? n : (t.copy(n, 0, 0, e),
                            n)
                        }
                        if (void 0 !== t.length)
                            return "number" != typeof t.length || D(t.length) ? f(0) : a(t);
                        if ("Buffer" === t.type && Array.isArray(t.data))
                            return a(t.data)
                    }(t);
                    if (o)
                        return o;
                    if ("undefined" != typeof Symbol && null != Symbol.toPrimitive && "function" == typeof t[Symbol.toPrimitive])
                        return r.from(t[Symbol.toPrimitive]("string"), e, n);
                    throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t)
                }
                function s(t) {
                    if ("number" != typeof t)
                        throw new TypeError('"size" argument must be of type number');
                    if (t < 0)
                        throw new RangeError('The value "' + t + '" is invalid for option "size"')
                }
                function h(t) {
                    return s(t),
                    f(t < 0 ? 0 : 0 | p(t))
                }
                function a(t) {
                    for (var r = t.length < 0 ? 0 : 0 | p(t.length), e = f(r), n = 0; n < r; n += 1)
                        e[n] = 255 & t[n];
                    return e
                }
                function p(t) {
                    if (t >= o)
                        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + o.toString(16) + " bytes");
                    return 0 | t
                }
                function c(t, e) {
                    if (r.isBuffer(t))
                        return t.length;
                    if (ArrayBuffer.isView(t) || z(t, ArrayBuffer))
                        return t.byteLength;
                    if ("string" != typeof t)
                        throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof t);
                    var n = t.length
                      , i = arguments.length > 2 && !0 === arguments[2];
                    if (!i && 0 === n)
                        return 0;
                    for (var o = !1; ; )
                        switch (e) {
                        case "ascii":
                        case "latin1":
                        case "binary":
                            return n;
                        case "utf8":
                        case "utf-8":
                            return P(t).length;
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            return 2 * n;
                        case "hex":
                            return n >>> 1;
                        case "base64":
                            return j(t).length;
                        default:
                            if (o)
                                return i ? -1 : P(t).length;
                            e = ("" + e).toLowerCase(),
                            o = !0
                        }
                }
                function l(t, r, e) {
                    var n = t[r];
                    t[r] = t[e],
                    t[e] = n
                }
                function y(t, e, n, i, o) {
                    if (0 === t.length)
                        return -1;
                    if ("string" == typeof n ? (i = n,
                    n = 0) : n > 2147483647 ? n = 2147483647 : n < -2147483648 && (n = -2147483648),
                    D(n = +n) && (n = o ? 0 : t.length - 1),
                    n < 0 && (n = t.length + n),
                    n >= t.length) {
                        if (o)
                            return -1;
                        n = t.length - 1
                    } else if (n < 0) {
                        if (!o)
                            return -1;
                        n = 0
                    }
                    if ("string" == typeof e && (e = r.from(e, i)),
                    r.isBuffer(e))
                        return 0 === e.length ? -1 : g(t, e, n, i, o);
                    if ("number" == typeof e)
                        return e &= 255,
                        "function" == typeof Uint8Array.prototype.indexOf ? o ? Uint8Array.prototype.indexOf.call(t, e, n) : Uint8Array.prototype.lastIndexOf.call(t, e, n) : g(t, [e], n, i, o);
                    throw new TypeError("val must be string, number or Buffer")
                }
                function g(t, r, e, n, i) {
                    var o, f = 1, u = t.length, s = r.length;
                    if (void 0 !== n && ("ucs2" === (n = String(n).toLowerCase()) || "ucs-2" === n || "utf16le" === n || "utf-16le" === n)) {
                        if (t.length < 2 || r.length < 2)
                            return -1;
                        f = 2,
                        u /= 2,
                        s /= 2,
                        e /= 2
                    }
                    function h(t, r) {
                        return 1 === f ? t[r] : t.readUInt16BE(r * f)
                    }
                    if (i) {
                        var a = -1;
                        for (o = e; o < u; o++)
                            if (h(t, o) === h(r, -1 === a ? 0 : o - a)) {
                                if (-1 === a && (a = o),
                                o - a + 1 === s)
                                    return a * f
                            } else
                                -1 !== a && (o -= o - a),
                                a = -1
                    } else
                        for (e + s > u && (e = u - s),
                        o = e; o >= 0; o--) {
                            for (var p = !0, c = 0; c < s; c++)
                                if (h(t, o + c) !== h(r, c)) {
                                    p = !1;
                                    break
                                }
                            if (p)
                                return o
                        }
                    return -1
                }
                function w(t, r, e, n) {
                    e = Number(e) || 0;
                    var i = t.length - e;
                    n ? (n = Number(n)) > i && (n = i) : n = i;
                    var o = r.length;
                    n > o / 2 && (n = o / 2);
                    for (var f = 0; f < n; ++f) {
                        var u = parseInt(r.substr(2 * f, 2), 16);
                        if (D(u))
                            return f;
                        t[e + f] = u
                    }
                    return f
                }
                function d(t, r, e, n) {
                    return N(P(r, t.length - e), t, e, n)
                }
                function v(t, r, e, n) {
                    return N(function(t) {
                        for (var r = [], e = 0; e < t.length; ++e)
                            r.push(255 & t.charCodeAt(e));
                        return r
                    }(r), t, e, n)
                }
                function b(t, r, e, n) {
                    return v(t, r, e, n)
                }
                function m(t, r, e, n) {
                    return N(j(r), t, e, n)
                }
                function E(t, r, e, n) {
                    return N(function(t, r) {
                        for (var e, n, i, o = [], f = 0; f < t.length && !((r -= 2) < 0); ++f)
                            e = t.charCodeAt(f),
                            n = e >> 8,
                            i = e % 256,
                            o.push(i),
                            o.push(n);
                        return o
                    }(r, t.length - e), t, e, n)
                }
                function B(t, r, e) {
                    return 0 === r && e === t.length ? n.fromByteArray(t) : n.fromByteArray(t.slice(r, e))
                }
                function A(t, r, e) {
                    e = Math.min(t.length, e);
                    for (var n = [], i = r; i < e; ) {
                        var o, f, u, s, h = t[i], a = null, p = h > 239 ? 4 : h > 223 ? 3 : h > 191 ? 2 : 1;
                        if (i + p <= e)
                            switch (p) {
                            case 1:
                                h < 128 && (a = h);
                                break;
                            case 2:
                                128 == (192 & (o = t[i + 1])) && (s = (31 & h) << 6 | 63 & o) > 127 && (a = s);
                                break;
                            case 3:
                                o = t[i + 1],
                                f = t[i + 2],
                                128 == (192 & o) && 128 == (192 & f) && (s = (15 & h) << 12 | (63 & o) << 6 | 63 & f) > 2047 && (s < 55296 || s > 57343) && (a = s);
                                break;
                            case 4:
                                o = t[i + 1],
                                f = t[i + 2],
                                u = t[i + 3],
                                128 == (192 & o) && 128 == (192 & f) && 128 == (192 & u) && (s = (15 & h) << 18 | (63 & o) << 12 | (63 & f) << 6 | 63 & u) > 65535 && s < 1114112 && (a = s)
                            }
                        null === a ? (a = 65533,
                        p = 1) : a > 65535 && (a -= 65536,
                        n.push(a >>> 10 & 1023 | 55296),
                        a = 56320 | 1023 & a),
                        n.push(a),
                        i += p
                    }
                    return function(t) {
                        var r = t.length;
                        if (r <= U)
                            return String.fromCharCode.apply(String, t);
                        var e = ""
                          , n = 0;
                        for (; n < r; )
                            e += String.fromCharCode.apply(String, t.slice(n, n += U));
                        return e
                    }(n)
                }
                e.kMaxLength = o,
                r.TYPED_ARRAY_SUPPORT = function() {
                    try {
                        var t = new Uint8Array(1);
                        return t.__proto__ = {
                            __proto__: Uint8Array.prototype,
                            foo: function() {
                                return 42
                            }
                        },
                        42 === t.foo()
                    } catch (t) {
                        return !1
                    }
                }(),
                r.TYPED_ARRAY_SUPPORT || "undefined" == typeof console || "function" != typeof console.error || console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."),
                Object.defineProperty(r.prototype, "parent", {
                    enumerable: !0,
                    get: function() {
                        if (r.isBuffer(this))
                            return this.buffer
                    }
                }),
                Object.defineProperty(r.prototype, "offset", {
                    enumerable: !0,
                    get: function() {
                        if (r.isBuffer(this))
                            return this.byteOffset
                    }
                }),
                "undefined" != typeof Symbol && null != Symbol.species && r[Symbol.species] === r && Object.defineProperty(r, Symbol.species, {
                    value: null,
                    configurable: !0,
                    enumerable: !1,
                    writable: !1
                }),
                r.poolSize = 8192,
                r.from = function(t, r, e) {
                    return u(t, r, e)
                }
                ,
                r.prototype.__proto__ = Uint8Array.prototype,
                r.__proto__ = Uint8Array,
                r.alloc = function(t, r, e) {
                    return function(t, r, e) {
                        return s(t),
                        t <= 0 ? f(t) : void 0 !== r ? "string" == typeof e ? f(t).fill(r, e) : f(t).fill(r) : f(t)
                    }(t, r, e)
                }
                ,
                r.allocUnsafe = function(t) {
                    return h(t)
                }
                ,
                r.allocUnsafeSlow = function(t) {
                    return h(t)
                }
                ,
                r.isBuffer = function(t) {
                    return null != t && !0 === t._isBuffer && t !== r.prototype
                }
                ,
                r.compare = function(t, e) {
                    if (z(t, Uint8Array) && (t = r.from(t, t.offset, t.byteLength)),
                    z(e, Uint8Array) && (e = r.from(e, e.offset, e.byteLength)),
                    !r.isBuffer(t) || !r.isBuffer(e))
                        throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
                    if (t === e)
                        return 0;
                    for (var n = t.length, i = e.length, o = 0, f = Math.min(n, i); o < f; ++o)
                        if (t[o] !== e[o]) {
                            n = t[o],
                            i = e[o];
                            break
                        }
                    return n < i ? -1 : i < n ? 1 : 0
                }
                ,
                r.isEncoding = function(t) {
                    switch (String(t).toLowerCase()) {
                    case "hex":
                    case "utf8":
                    case "utf-8":
                    case "ascii":
                    case "latin1":
                    case "binary":
                    case "base64":
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        return !0;
                    default:
                        return !1
                    }
                }
                ,
                r.concat = function(t, e) {
                    if (!Array.isArray(t))
                        throw new TypeError('"list" argument must be an Array of Buffers');
                    if (0 === t.length)
                        return r.alloc(0);
                    var n;
                    if (void 0 === e)
                        for (e = 0,
                        n = 0; n < t.length; ++n)
                            e += t[n].length;
                    var i = r.allocUnsafe(e)
                      , o = 0;
                    for (n = 0; n < t.length; ++n) {
                        var f = t[n];
                        if (z(f, Uint8Array) && (f = r.from(f)),
                        !r.isBuffer(f))
                            throw new TypeError('"list" argument must be an Array of Buffers');
                        f.copy(i, o),
                        o += f.length
                    }
                    return i
                }
                ,
                r.byteLength = c,
                r.prototype._isBuffer = !0,
                r.prototype.swap16 = function() {
                    var t = this.length;
                    if (t % 2 != 0)
                        throw new RangeError("Buffer size must be a multiple of 16-bits");
                    for (var r = 0; r < t; r += 2)
                        l(this, r, r + 1);
                    return this
                }
                ,
                r.prototype.swap32 = function() {
                    var t = this.length;
                    if (t % 4 != 0)
                        throw new RangeError("Buffer size must be a multiple of 32-bits");
                    for (var r = 0; r < t; r += 4)
                        l(this, r, r + 3),
                        l(this, r + 1, r + 2);
                    return this
                }
                ,
                r.prototype.swap64 = function() {
                    var t = this.length;
                    if (t % 8 != 0)
                        throw new RangeError("Buffer size must be a multiple of 64-bits");
                    for (var r = 0; r < t; r += 8)
                        l(this, r, r + 7),
                        l(this, r + 1, r + 6),
                        l(this, r + 2, r + 5),
                        l(this, r + 3, r + 4);
                    return this
                }
                ,
                r.prototype.toString = function() {
                    var t = this.length;
                    return 0 === t ? "" : 0 === arguments.length ? A(this, 0, t) : function(t, r, e) {
                        var n = !1;
                        if ((void 0 === r || r < 0) && (r = 0),
                        r > this.length)
                            return "";
                        if ((void 0 === e || e > this.length) && (e = this.length),
                        e <= 0)
                            return "";
                        if ((e >>>= 0) <= (r >>>= 0))
                            return "";
                        for (t || (t = "utf8"); ; )
                            switch (t) {
                            case "hex":
                                return S(this, r, e);
                            case "utf8":
                            case "utf-8":
                                return A(this, r, e);
                            case "ascii":
                                return T(this, r, e);
                            case "latin1":
                            case "binary":
                                return I(this, r, e);
                            case "base64":
                                return B(this, r, e);
                            case "ucs2":
                            case "ucs-2":
                            case "utf16le":
                            case "utf-16le":
                                return L(this, r, e);
                            default:
                                if (n)
                                    throw new TypeError("Unknown encoding: " + t);
                                t = (t + "").toLowerCase(),
                                n = !0
                            }
                    }
                    .apply(this, arguments)
                }
                ,
                r.prototype.toLocaleString = r.prototype.toString,
                r.prototype.equals = function(t) {
                    if (!r.isBuffer(t))
                        throw new TypeError("Argument must be a Buffer");
                    return this === t || 0 === r.compare(this, t)
                }
                ,
                r.prototype.inspect = function() {
                    var t = ""
                      , r = e.INSPECT_MAX_BYTES;
                    return t = this.toString("hex", 0, r).replace(/(.{2})/g, "$1 ").trim(),
                    this.length > r && (t += " ... "),
                    "<Buffer " + t + ">"
                }
                ,
                r.prototype.compare = function(t, e, n, i, o) {
                    if (z(t, Uint8Array) && (t = r.from(t, t.offset, t.byteLength)),
                    !r.isBuffer(t))
                        throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof t);
                    if (void 0 === e && (e = 0),
                    void 0 === n && (n = t ? t.length : 0),
                    void 0 === i && (i = 0),
                    void 0 === o && (o = this.length),
                    e < 0 || n > t.length || i < 0 || o > this.length)
                        throw new RangeError("out of range index");
                    if (i >= o && e >= n)
                        return 0;
                    if (i >= o)
                        return -1;
                    if (e >= n)
                        return 1;
                    if (this === t)
                        return 0;
                    for (var f = (o >>>= 0) - (i >>>= 0), u = (n >>>= 0) - (e >>>= 0), s = Math.min(f, u), h = this.slice(i, o), a = t.slice(e, n), p = 0; p < s; ++p)
                        if (h[p] !== a[p]) {
                            f = h[p],
                            u = a[p];
                            break
                        }
                    return f < u ? -1 : u < f ? 1 : 0
                }
                ,
                r.prototype.includes = function(t, r, e) {
                    return -1 !== this.indexOf(t, r, e)
                }
                ,
                r.prototype.indexOf = function(t, r, e) {
                    return y(this, t, r, e, !0)
                }
                ,
                r.prototype.lastIndexOf = function(t, r, e) {
                    return y(this, t, r, e, !1)
                }
                ,
                r.prototype.write = function(t, r, e, n) {
                    if (void 0 === r)
                        n = "utf8",
                        e = this.length,
                        r = 0;
                    else if (void 0 === e && "string" == typeof r)
                        n = r,
                        e = this.length,
                        r = 0;
                    else {
                        if (!isFinite(r))
                            throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
                        r >>>= 0,
                        isFinite(e) ? (e >>>= 0,
                        void 0 === n && (n = "utf8")) : (n = e,
                        e = void 0)
                    }
                    var i = this.length - r;
                    if ((void 0 === e || e > i) && (e = i),
                    t.length > 0 && (e < 0 || r < 0) || r > this.length)
                        throw new RangeError("Attempt to write outside buffer bounds");
                    n || (n = "utf8");
                    for (var o = !1; ; )
                        switch (n) {
                        case "hex":
                            return w(this, t, r, e);
                        case "utf8":
                        case "utf-8":
                            return d(this, t, r, e);
                        case "ascii":
                            return v(this, t, r, e);
                        case "latin1":
                        case "binary":
                            return b(this, t, r, e);
                        case "base64":
                            return m(this, t, r, e);
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            return E(this, t, r, e);
                        default:
                            if (o)
                                throw new TypeError("Unknown encoding: " + n);
                            n = ("" + n).toLowerCase(),
                            o = !0
                        }
                }
                ,
                r.prototype.toJSON = function() {
                    return {
                        type: "Buffer",
                        data: Array.prototype.slice.call(this._arr || this, 0)
                    }
                }
                ;
                var U = 4096;
                function T(t, r, e) {
                    var n = "";
                    e = Math.min(t.length, e);
                    for (var i = r; i < e; ++i)
                        n += String.fromCharCode(127 & t[i]);
                    return n
                }
                function I(t, r, e) {
                    var n = "";
                    e = Math.min(t.length, e);
                    for (var i = r; i < e; ++i)
                        n += String.fromCharCode(t[i]);
                    return n
                }
                function S(t, r, e) {
                    var n = t.length;
                    (!r || r < 0) && (r = 0),
                    (!e || e < 0 || e > n) && (e = n);
                    for (var i = "", o = r; o < e; ++o)
                        i += k(t[o]);
                    return i
                }
                function L(t, r, e) {
                    for (var n = t.slice(r, e), i = "", o = 0; o < n.length; o += 2)
                        i += String.fromCharCode(n[o] + 256 * n[o + 1]);
                    return i
                }
                function R(t, r, e) {
                    if (t % 1 != 0 || t < 0)
                        throw new RangeError("offset is not uint");
                    if (t + r > e)
                        throw new RangeError("Trying to access beyond buffer length")
                }
                function C(t, e, n, i, o, f) {
                    if (!r.isBuffer(t))
                        throw new TypeError('"buffer" argument must be a Buffer instance');
                    if (e > o || e < f)
                        throw new RangeError('"value" argument is out of bounds');
                    if (n + i > t.length)
                        throw new RangeError("Index out of range")
                }
                function _(t, r, e, n, i, o) {
                    if (e + n > t.length)
                        throw new RangeError("Index out of range");
                    if (e < 0)
                        throw new RangeError("Index out of range")
                }
                function O(t, r, e, n, o) {
                    return r = +r,
                    e >>>= 0,
                    o || _(t, 0, e, 4),
                    i.write(t, r, e, n, 23, 4),
                    e + 4
                }
                function x(t, r, e, n, o) {
                    return r = +r,
                    e >>>= 0,
                    o || _(t, 0, e, 8),
                    i.write(t, r, e, n, 52, 8),
                    e + 8
                }
                r.prototype.slice = function(t, e) {
                    var n = this.length;
                    (t = ~~t) < 0 ? (t += n) < 0 && (t = 0) : t > n && (t = n),
                    (e = void 0 === e ? n : ~~e) < 0 ? (e += n) < 0 && (e = 0) : e > n && (e = n),
                    e < t && (e = t);
                    var i = this.subarray(t, e);
                    return i.__proto__ = r.prototype,
                    i
                }
                ,
                r.prototype.readUIntLE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || R(t, r, this.length);
                    for (var n = this[t], i = 1, o = 0; ++o < r && (i *= 256); )
                        n += this[t + o] * i;
                    return n
                }
                ,
                r.prototype.readUIntBE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || R(t, r, this.length);
                    for (var n = this[t + --r], i = 1; r > 0 && (i *= 256); )
                        n += this[t + --r] * i;
                    return n
                }
                ,
                r.prototype.readUInt8 = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 1, this.length),
                    this[t]
                }
                ,
                r.prototype.readUInt16LE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 2, this.length),
                    this[t] | this[t + 1] << 8
                }
                ,
                r.prototype.readUInt16BE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 2, this.length),
                    this[t] << 8 | this[t + 1]
                }
                ,
                r.prototype.readUInt32LE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 4, this.length),
                    (this[t] | this[t + 1] << 8 | this[t + 2] << 16) + 16777216 * this[t + 3]
                }
                ,
                r.prototype.readUInt32BE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 4, this.length),
                    16777216 * this[t] + (this[t + 1] << 16 | this[t + 2] << 8 | this[t + 3])
                }
                ,
                r.prototype.readIntLE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || R(t, r, this.length);
                    for (var n = this[t], i = 1, o = 0; ++o < r && (i *= 256); )
                        n += this[t + o] * i;
                    return n >= (i *= 128) && (n -= Math.pow(2, 8 * r)),
                    n
                }
                ,
                r.prototype.readIntBE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || R(t, r, this.length);
                    for (var n = r, i = 1, o = this[t + --n]; n > 0 && (i *= 256); )
                        o += this[t + --n] * i;
                    return o >= (i *= 128) && (o -= Math.pow(2, 8 * r)),
                    o
                }
                ,
                r.prototype.readInt8 = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 1, this.length),
                    128 & this[t] ? -1 * (255 - this[t] + 1) : this[t]
                }
                ,
                r.prototype.readInt16LE = function(t, r) {
                    t >>>= 0,
                    r || R(t, 2, this.length);
                    var e = this[t] | this[t + 1] << 8;
                    return 32768 & e ? 4294901760 | e : e
                }
                ,
                r.prototype.readInt16BE = function(t, r) {
                    t >>>= 0,
                    r || R(t, 2, this.length);
                    var e = this[t + 1] | this[t] << 8;
                    return 32768 & e ? 4294901760 | e : e
                }
                ,
                r.prototype.readInt32LE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 4, this.length),
                    this[t] | this[t + 1] << 8 | this[t + 2] << 16 | this[t + 3] << 24
                }
                ,
                r.prototype.readInt32BE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 4, this.length),
                    this[t] << 24 | this[t + 1] << 16 | this[t + 2] << 8 | this[t + 3]
                }
                ,
                r.prototype.readFloatLE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 4, this.length),
                    i.read(this, t, !0, 23, 4)
                }
                ,
                r.prototype.readFloatBE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 4, this.length),
                    i.read(this, t, !1, 23, 4)
                }
                ,
                r.prototype.readDoubleLE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 8, this.length),
                    i.read(this, t, !0, 52, 8)
                }
                ,
                r.prototype.readDoubleBE = function(t, r) {
                    return t >>>= 0,
                    r || R(t, 8, this.length),
                    i.read(this, t, !1, 52, 8)
                }
                ,
                r.prototype.writeUIntLE = function(t, r, e, n) {
                    (t = +t,
                    r >>>= 0,
                    e >>>= 0,
                    n) || C(this, t, r, e, Math.pow(2, 8 * e) - 1, 0);
                    var i = 1
                      , o = 0;
                    for (this[r] = 255 & t; ++o < e && (i *= 256); )
                        this[r + o] = t / i & 255;
                    return r + e
                }
                ,
                r.prototype.writeUIntBE = function(t, r, e, n) {
                    (t = +t,
                    r >>>= 0,
                    e >>>= 0,
                    n) || C(this, t, r, e, Math.pow(2, 8 * e) - 1, 0);
                    var i = e - 1
                      , o = 1;
                    for (this[r + i] = 255 & t; --i >= 0 && (o *= 256); )
                        this[r + i] = t / o & 255;
                    return r + e
                }
                ,
                r.prototype.writeUInt8 = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 1, 255, 0),
                    this[r] = 255 & t,
                    r + 1
                }
                ,
                r.prototype.writeUInt16LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 2, 65535, 0),
                    this[r] = 255 & t,
                    this[r + 1] = t >>> 8,
                    r + 2
                }
                ,
                r.prototype.writeUInt16BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 2, 65535, 0),
                    this[r] = t >>> 8,
                    this[r + 1] = 255 & t,
                    r + 2
                }
                ,
                r.prototype.writeUInt32LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 4, 4294967295, 0),
                    this[r + 3] = t >>> 24,
                    this[r + 2] = t >>> 16,
                    this[r + 1] = t >>> 8,
                    this[r] = 255 & t,
                    r + 4
                }
                ,
                r.prototype.writeUInt32BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 4, 4294967295, 0),
                    this[r] = t >>> 24,
                    this[r + 1] = t >>> 16,
                    this[r + 2] = t >>> 8,
                    this[r + 3] = 255 & t,
                    r + 4
                }
                ,
                r.prototype.writeIntLE = function(t, r, e, n) {
                    if (t = +t,
                    r >>>= 0,
                    !n) {
                        var i = Math.pow(2, 8 * e - 1);
                        C(this, t, r, e, i - 1, -i)
                    }
                    var o = 0
                      , f = 1
                      , u = 0;
                    for (this[r] = 255 & t; ++o < e && (f *= 256); )
                        t < 0 && 0 === u && 0 !== this[r + o - 1] && (u = 1),
                        this[r + o] = (t / f >> 0) - u & 255;
                    return r + e
                }
                ,
                r.prototype.writeIntBE = function(t, r, e, n) {
                    if (t = +t,
                    r >>>= 0,
                    !n) {
                        var i = Math.pow(2, 8 * e - 1);
                        C(this, t, r, e, i - 1, -i)
                    }
                    var o = e - 1
                      , f = 1
                      , u = 0;
                    for (this[r + o] = 255 & t; --o >= 0 && (f *= 256); )
                        t < 0 && 0 === u && 0 !== this[r + o + 1] && (u = 1),
                        this[r + o] = (t / f >> 0) - u & 255;
                    return r + e
                }
                ,
                r.prototype.writeInt8 = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 1, 127, -128),
                    t < 0 && (t = 255 + t + 1),
                    this[r] = 255 & t,
                    r + 1
                }
                ,
                r.prototype.writeInt16LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 2, 32767, -32768),
                    this[r] = 255 & t,
                    this[r + 1] = t >>> 8,
                    r + 2
                }
                ,
                r.prototype.writeInt16BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 2, 32767, -32768),
                    this[r] = t >>> 8,
                    this[r + 1] = 255 & t,
                    r + 2
                }
                ,
                r.prototype.writeInt32LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 4, 2147483647, -2147483648),
                    this[r] = 255 & t,
                    this[r + 1] = t >>> 8,
                    this[r + 2] = t >>> 16,
                    this[r + 3] = t >>> 24,
                    r + 4
                }
                ,
                r.prototype.writeInt32BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || C(this, t, r, 4, 2147483647, -2147483648),
                    t < 0 && (t = 4294967295 + t + 1),
                    this[r] = t >>> 24,
                    this[r + 1] = t >>> 16,
                    this[r + 2] = t >>> 8,
                    this[r + 3] = 255 & t,
                    r + 4
                }
                ,
                r.prototype.writeFloatLE = function(t, r, e) {
                    return O(this, t, r, !0, e)
                }
                ,
                r.prototype.writeFloatBE = function(t, r, e) {
                    return O(this, t, r, !1, e)
                }
                ,
                r.prototype.writeDoubleLE = function(t, r, e) {
                    return x(this, t, r, !0, e)
                }
                ,
                r.prototype.writeDoubleBE = function(t, r, e) {
                    return x(this, t, r, !1, e)
                }
                ,
                r.prototype.copy = function(t, e, n, i) {
                    if (!r.isBuffer(t))
                        throw new TypeError("argument should be a Buffer");
                    if (n || (n = 0),
                    i || 0 === i || (i = this.length),
                    e >= t.length && (e = t.length),
                    e || (e = 0),
                    i > 0 && i < n && (i = n),
                    i === n)
                        return 0;
                    if (0 === t.length || 0 === this.length)
                        return 0;
                    if (e < 0)
                        throw new RangeError("targetStart out of bounds");
                    if (n < 0 || n >= this.length)
                        throw new RangeError("Index out of range");
                    if (i < 0)
                        throw new RangeError("sourceEnd out of bounds");
                    i > this.length && (i = this.length),
                    t.length - e < i - n && (i = t.length - e + n);
                    var o = i - n;
                    if (this === t && "function" == typeof Uint8Array.prototype.copyWithin)
                        this.copyWithin(e, n, i);
                    else if (this === t && n < e && e < i)
                        for (var f = o - 1; f >= 0; --f)
                            t[f + e] = this[f + n];
                    else
                        Uint8Array.prototype.set.call(t, this.subarray(n, i), e);
                    return o
                }
                ,
                r.prototype.fill = function(t, e, n, i) {
                    if ("string" == typeof t) {
                        if ("string" == typeof e ? (i = e,
                        e = 0,
                        n = this.length) : "string" == typeof n && (i = n,
                        n = this.length),
                        void 0 !== i && "string" != typeof i)
                            throw new TypeError("encoding must be a string");
                        if ("string" == typeof i && !r.isEncoding(i))
                            throw new TypeError("Unknown encoding: " + i);
                        if (1 === t.length) {
                            var o = t.charCodeAt(0);
                            ("utf8" === i && o < 128 || "latin1" === i) && (t = o)
                        }
                    } else
                        "number" == typeof t && (t &= 255);
                    if (e < 0 || this.length < e || this.length < n)
                        throw new RangeError("Out of range index");
                    if (n <= e)
                        return this;
                    var f;
                    if (e >>>= 0,
                    n = void 0 === n ? this.length : n >>> 0,
                    t || (t = 0),
                    "number" == typeof t)
                        for (f = e; f < n; ++f)
                            this[f] = t;
                    else {
                        var u = r.isBuffer(t) ? t : r.from(t, i)
                          , s = u.length;
                        if (0 === s)
                            throw new TypeError('The value "' + t + '" is invalid for argument "value"');
                        for (f = 0; f < n - e; ++f)
                            this[f + e] = u[f % s]
                    }
                    return this
                }
                ;
                var M = /[^+\/0-9A-Za-z-_]/g;
                function k(t) {
                    return t < 16 ? "0" + t.toString(16) : t.toString(16)
                }
                function P(t, r) {
                    var e;
                    r = r || 1 / 0;
                    for (var n = t.length, i = null, o = [], f = 0; f < n; ++f) {
                        if ((e = t.charCodeAt(f)) > 55295 && e < 57344) {
                            if (!i) {
                                if (e > 56319) {
                                    (r -= 3) > -1 && o.push(239, 191, 189);
                                    continue
                                }
                                if (f + 1 === n) {
                                    (r -= 3) > -1 && o.push(239, 191, 189);
                                    continue
                                }
                                i = e;
                                continue
                            }
                            if (e < 56320) {
                                (r -= 3) > -1 && o.push(239, 191, 189),
                                i = e;
                                continue
                            }
                            e = 65536 + (i - 55296 << 10 | e - 56320)
                        } else
                            i && (r -= 3) > -1 && o.push(239, 191, 189);
                        if (i = null,
                        e < 128) {
                            if ((r -= 1) < 0)
                                break;
                            o.push(e)
                        } else if (e < 2048) {
                            if ((r -= 2) < 0)
                                break;
                            o.push(e >> 6 | 192, 63 & e | 128)
                        } else if (e < 65536) {
                            if ((r -= 3) < 0)
                                break;
                            o.push(e >> 12 | 224, e >> 6 & 63 | 128, 63 & e | 128)
                        } else {
                            if (!(e < 1114112))
                                throw new Error("Invalid code point");
                            if ((r -= 4) < 0)
                                break;
                            o.push(e >> 18 | 240, e >> 12 & 63 | 128, e >> 6 & 63 | 128, 63 & e | 128)
                        }
                    }
                    return o
                }
                function j(t) {
                    return n.toByteArray(function(t) {
                        if ((t = (t = t.split("=")[0]).trim().replace(M, "")).length < 2)
                            return "";
                        for (; t.length % 4 != 0; )
                            t += "=";
                        return t
                    }(t))
                }
                function N(t, r, e, n) {
                    for (var i = 0; i < n && !(i + e >= r.length || i >= t.length); ++i)
                        r[i + e] = t[i];
                    return i
                }
                function z(t, r) {
                    return t instanceof r || null != t && null != t.constructor && null != t.constructor.name && t.constructor.name === r.name
                }
                function D(t) {
                    return t != t
                }
            }
            ).call(this, t("buffer").Buffer)
        }
        , {
            "base64-js": 1,
            buffer: 2,
            ieee754: 3
        }],
        3: [function(t, r, e) {
            e.read = function(t, r, e, n, i) {
                var o, f, u = 8 * i - n - 1, s = (1 << u) - 1, h = s >> 1, a = -7, p = e ? i - 1 : 0, c = e ? -1 : 1, l = t[r + p];
                for (p += c,
                o = l & (1 << -a) - 1,
                l >>= -a,
                a += u; a > 0; o = 256 * o + t[r + p],
                p += c,
                a -= 8)
                    ;
                for (f = o & (1 << -a) - 1,
                o >>= -a,
                a += n; a > 0; f = 256 * f + t[r + p],
                p += c,
                a -= 8)
                    ;
                if (0 === o)
                    o = 1 - h;
                else {
                    if (o === s)
                        return f ? NaN : 1 / 0 * (l ? -1 : 1);
                    f += Math.pow(2, n),
                    o -= h
                }
                return (l ? -1 : 1) * f * Math.pow(2, o - n)
            }
            ,
            e.write = function(t, r, e, n, i, o) {
                var f, u, s, h = 8 * o - i - 1, a = (1 << h) - 1, p = a >> 1, c = 23 === i ? Math.pow(2, -24) - Math.pow(2, -77) : 0, l = n ? 0 : o - 1, y = n ? 1 : -1, g = r < 0 || 0 === r && 1 / r < 0 ? 1 : 0;
                for (r = Math.abs(r),
                isNaN(r) || r === 1 / 0 ? (u = isNaN(r) ? 1 : 0,
                f = a) : (f = Math.floor(Math.log(r) / Math.LN2),
                r * (s = Math.pow(2, -f)) < 1 && (f--,
                s *= 2),
                (r += f + p >= 1 ? c / s : c * Math.pow(2, 1 - p)) * s >= 2 && (f++,
                s /= 2),
                f + p >= a ? (u = 0,
                f = a) : f + p >= 1 ? (u = (r * s - 1) * Math.pow(2, i),
                f += p) : (u = r * Math.pow(2, p - 1) * Math.pow(2, i),
                f = 0)); i >= 8; t[e + l] = 255 & u,
                l += y,
                u /= 256,
                i -= 8)
                    ;
                for (f = f << i | u,
                h += i; h > 0; t[e + l] = 255 & f,
                l += y,
                f /= 256,
                h -= 8)
                    ;
                t[e + l - y] |= 128 * g
            }
        }
        , {}],
        4: [function(t, r, e) {
            (function(r) {
                "use strict";
                var n = t("base64-js")
                  , i = t("ieee754")
                  , o = "function" == typeof Symbol && "function" == typeof Symbol.for ? Symbol.for("nodejs.util.inspect.custom") : null;
                e.Buffer = r,
                e.SlowBuffer = function(t) {
                    +t != t && (t = 0);
                    return r.alloc(+t)
                }
                ,
                e.INSPECT_MAX_BYTES = 50;
                var f = 2147483647;
                function u(t) {
                    if (t > f)
                        throw new RangeError('The value "' + t + '" is invalid for option "size"');
                    var e = new Uint8Array(t);
                    return Object.setPrototypeOf(e, r.prototype),
                    e
                }
                function r(t, r, e) {
                    if ("number" == typeof t) {
                        if ("string" == typeof r)
                            throw new TypeError('The "string" argument must be of type string. Received type number');
                        return a(t)
                    }
                    return s(t, r, e)
                }
                function s(t, e, n) {
                    if ("string" == typeof t)
                        return function(t, e) {
                            "string" == typeof e && "" !== e || (e = "utf8");
                            if (!r.isEncoding(e))
                                throw new TypeError("Unknown encoding: " + e);
                            var n = 0 | y(t, e)
                              , i = u(n)
                              , o = i.write(t, e);
                            o !== n && (i = i.slice(0, o));
                            return i
                        }(t, e);
                    if (ArrayBuffer.isView(t))
                        return p(t);
                    if (null == t)
                        throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t);
                    if (D(t, ArrayBuffer) || t && D(t.buffer, ArrayBuffer))
                        return c(t, e, n);
                    if ("undefined" != typeof SharedArrayBuffer && (D(t, SharedArrayBuffer) || t && D(t.buffer, SharedArrayBuffer)))
                        return c(t, e, n);
                    if ("number" == typeof t)
                        throw new TypeError('The "value" argument must not be of type number. Received type number');
                    var i = t.valueOf && t.valueOf();
                    if (null != i && i !== t)
                        return r.from(i, e, n);
                    var o = function(t) {
                        if (r.isBuffer(t)) {
                            var e = 0 | l(t.length)
                              , n = u(e);
                            return 0 === n.length ? n : (t.copy(n, 0, 0, e),
                            n)
                        }
                        if (void 0 !== t.length)
                            return "number" != typeof t.length || F(t.length) ? u(0) : p(t);
                        if ("Buffer" === t.type && Array.isArray(t.data))
                            return p(t.data)
                    }(t);
                    if (o)
                        return o;
                    if ("undefined" != typeof Symbol && null != Symbol.toPrimitive && "function" == typeof t[Symbol.toPrimitive])
                        return r.from(t[Symbol.toPrimitive]("string"), e, n);
                    throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof t)
                }
                function h(t) {
                    if ("number" != typeof t)
                        throw new TypeError('"size" argument must be of type number');
                    if (t < 0)
                        throw new RangeError('The value "' + t + '" is invalid for option "size"')
                }
                function a(t) {
                    return h(t),
                    u(t < 0 ? 0 : 0 | l(t))
                }
                function p(t) {
                    for (var r = t.length < 0 ? 0 : 0 | l(t.length), e = u(r), n = 0; n < r; n += 1)
                        e[n] = 255 & t[n];
                    return e
                }
                function c(t, e, n) {
                    if (e < 0 || t.byteLength < e)
                        throw new RangeError('"offset" is outside of buffer bounds');
                    if (t.byteLength < e + (n || 0))
                        throw new RangeError('"length" is outside of buffer bounds');
                    var i;
                    return i = void 0 === e && void 0 === n ? new Uint8Array(t) : void 0 === n ? new Uint8Array(t,e) : new Uint8Array(t,e,n),
                    Object.setPrototypeOf(i, r.prototype),
                    i
                }
                function l(t) {
                    if (t >= f)
                        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + f.toString(16) + " bytes");
                    return 0 | t
                }
                function y(t, e) {
                    if (r.isBuffer(t))
                        return t.length;
                    if (ArrayBuffer.isView(t) || D(t, ArrayBuffer))
                        return t.byteLength;
                    if ("string" != typeof t)
                        throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof t);
                    var n = t.length
                      , i = arguments.length > 2 && !0 === arguments[2];
                    if (!i && 0 === n)
                        return 0;
                    for (var o = !1; ; )
                        switch (e) {
                        case "ascii":
                        case "latin1":
                        case "binary":
                            return n;
                        case "utf8":
                        case "utf-8":
                            return j(t).length;
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            return 2 * n;
                        case "hex":
                            return n >>> 1;
                        case "base64":
                            return N(t).length;
                        default:
                            if (o)
                                return i ? -1 : j(t).length;
                            e = ("" + e).toLowerCase(),
                            o = !0
                        }
                }
                function g(t, r, e) {
                    var n = t[r];
                    t[r] = t[e],
                    t[e] = n
                }
                function w(t, e, n, i, o) {
                    if (0 === t.length)
                        return -1;
                    if ("string" == typeof n ? (i = n,
                    n = 0) : n > 2147483647 ? n = 2147483647 : n < -2147483648 && (n = -2147483648),
                    F(n = +n) && (n = o ? 0 : t.length - 1),
                    n < 0 && (n = t.length + n),
                    n >= t.length) {
                        if (o)
                            return -1;
                        n = t.length - 1
                    } else if (n < 0) {
                        if (!o)
                            return -1;
                        n = 0
                    }
                    if ("string" == typeof e && (e = r.from(e, i)),
                    r.isBuffer(e))
                        return 0 === e.length ? -1 : d(t, e, n, i, o);
                    if ("number" == typeof e)
                        return e &= 255,
                        "function" == typeof Uint8Array.prototype.indexOf ? o ? Uint8Array.prototype.indexOf.call(t, e, n) : Uint8Array.prototype.lastIndexOf.call(t, e, n) : d(t, [e], n, i, o);
                    throw new TypeError("val must be string, number or Buffer")
                }
                function d(t, r, e, n, i) {
                    var o, f = 1, u = t.length, s = r.length;
                    if (void 0 !== n && ("ucs2" === (n = String(n).toLowerCase()) || "ucs-2" === n || "utf16le" === n || "utf-16le" === n)) {
                        if (t.length < 2 || r.length < 2)
                            return -1;
                        f = 2,
                        u /= 2,
                        s /= 2,
                        e /= 2
                    }
                    function h(t, r) {
                        return 1 === f ? t[r] : t.readUInt16BE(r * f)
                    }
                    if (i) {
                        var a = -1;
                        for (o = e; o < u; o++)
                            if (h(t, o) === h(r, -1 === a ? 0 : o - a)) {
                                if (-1 === a && (a = o),
                                o - a + 1 === s)
                                    return a * f
                            } else
                                -1 !== a && (o -= o - a),
                                a = -1
                    } else
                        for (e + s > u && (e = u - s),
                        o = e; o >= 0; o--) {
                            for (var p = !0, c = 0; c < s; c++)
                                if (h(t, o + c) !== h(r, c)) {
                                    p = !1;
                                    break
                                }
                            if (p)
                                return o
                        }
                    return -1
                }
                function v(t, r, e, n) {
                    e = Number(e) || 0;
                    var i = t.length - e;
                    n ? (n = Number(n)) > i && (n = i) : n = i;
                    var o = r.length;
                    n > o / 2 && (n = o / 2);
                    for (var f = 0; f < n; ++f) {
                        var u = parseInt(r.substr(2 * f, 2), 16);
                        if (F(u))
                            return f;
                        t[e + f] = u
                    }
                    return f
                }
                function b(t, r, e, n) {
                    return z(j(r, t.length - e), t, e, n)
                }
                function m(t, r, e, n) {
                    return z(function(t) {
                        for (var r = [], e = 0; e < t.length; ++e)
                            r.push(255 & t.charCodeAt(e));
                        return r
                    }(r), t, e, n)
                }
                function E(t, r, e, n) {
                    return m(t, r, e, n)
                }
                function B(t, r, e, n) {
                    return z(N(r), t, e, n)
                }
                function A(t, r, e, n) {
                    return z(function(t, r) {
                        for (var e, n, i, o = [], f = 0; f < t.length && !((r -= 2) < 0); ++f)
                            e = t.charCodeAt(f),
                            n = e >> 8,
                            i = e % 256,
                            o.push(i),
                            o.push(n);
                        return o
                    }(r, t.length - e), t, e, n)
                }
                function U(t, r, e) {
                    return 0 === r && e === t.length ? n.fromByteArray(t) : n.fromByteArray(t.slice(r, e))
                }
                function T(t, r, e) {
                    e = Math.min(t.length, e);
                    for (var n = [], i = r; i < e; ) {
                        var o, f, u, s, h = t[i], a = null, p = h > 239 ? 4 : h > 223 ? 3 : h > 191 ? 2 : 1;
                        if (i + p <= e)
                            switch (p) {
                            case 1:
                                h < 128 && (a = h);
                                break;
                            case 2:
                                128 == (192 & (o = t[i + 1])) && (s = (31 & h) << 6 | 63 & o) > 127 && (a = s);
                                break;
                            case 3:
                                o = t[i + 1],
                                f = t[i + 2],
                                128 == (192 & o) && 128 == (192 & f) && (s = (15 & h) << 12 | (63 & o) << 6 | 63 & f) > 2047 && (s < 55296 || s > 57343) && (a = s);
                                break;
                            case 4:
                                o = t[i + 1],
                                f = t[i + 2],
                                u = t[i + 3],
                                128 == (192 & o) && 128 == (192 & f) && 128 == (192 & u) && (s = (15 & h) << 18 | (63 & o) << 12 | (63 & f) << 6 | 63 & u) > 65535 && s < 1114112 && (a = s)
                            }
                        null === a ? (a = 65533,
                        p = 1) : a > 65535 && (a -= 65536,
                        n.push(a >>> 10 & 1023 | 55296),
                        a = 56320 | 1023 & a),
                        n.push(a),
                        i += p
                    }
                    return function(t) {
                        var r = t.length;
                        if (r <= I)
                            return String.fromCharCode.apply(String, t);
                        var e = ""
                          , n = 0;
                        for (; n < r; )
                            e += String.fromCharCode.apply(String, t.slice(n, n += I));
                        return e
                    }(n)
                }
                e.kMaxLength = f,
                r.TYPED_ARRAY_SUPPORT = function() {
                    try {
                        var t = new Uint8Array(1)
                          , r = {
                            foo: function() {
                                return 42
                            }
                        };
                        return Object.setPrototypeOf(r, Uint8Array.prototype),
                        Object.setPrototypeOf(t, r),
                        42 === t.foo()
                    } catch (t) {
                        return !1
                    }
                }(),
                r.TYPED_ARRAY_SUPPORT || "undefined" == typeof console || "function" != typeof console.error || console.error("This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."),
                Object.defineProperty(r.prototype, "parent", {
                    enumerable: !0,
                    get: function() {
                        if (r.isBuffer(this))
                            return this.buffer
                    }
                }),
                Object.defineProperty(r.prototype, "offset", {
                    enumerable: !0,
                    get: function() {
                        if (r.isBuffer(this))
                            return this.byteOffset
                    }
                }),
                r.poolSize = 8192,
                r.from = function(t, r, e) {
                    return s(t, r, e)
                }
                ,
                Object.setPrototypeOf(r.prototype, Uint8Array.prototype),
                Object.setPrototypeOf(r, Uint8Array),
                r.alloc = function(t, r, e) {
                    return function(t, r, e) {
                        return h(t),
                        t <= 0 ? u(t) : void 0 !== r ? "string" == typeof e ? u(t).fill(r, e) : u(t).fill(r) : u(t)
                    }(t, r, e)
                }
                ,
                r.allocUnsafe = function(t) {
                    return a(t)
                }
                ,
                r.allocUnsafeSlow = function(t) {
                    return a(t)
                }
                ,
                r.isBuffer = function(t) {
                    return null != t && !0 === t._isBuffer && t !== r.prototype
                }
                ,
                r.compare = function(t, e) {
                    if (D(t, Uint8Array) && (t = r.from(t, t.offset, t.byteLength)),
                    D(e, Uint8Array) && (e = r.from(e, e.offset, e.byteLength)),
                    !r.isBuffer(t) || !r.isBuffer(e))
                        throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
                    if (t === e)
                        return 0;
                    for (var n = t.length, i = e.length, o = 0, f = Math.min(n, i); o < f; ++o)
                        if (t[o] !== e[o]) {
                            n = t[o],
                            i = e[o];
                            break
                        }
                    return n < i ? -1 : i < n ? 1 : 0
                }
                ,
                r.isEncoding = function(t) {
                    switch (String(t).toLowerCase()) {
                    case "hex":
                    case "utf8":
                    case "utf-8":
                    case "ascii":
                    case "latin1":
                    case "binary":
                    case "base64":
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        return !0;
                    default:
                        return !1
                    }
                }
                ,
                r.concat = function(t, e) {
                    if (!Array.isArray(t))
                        throw new TypeError('"list" argument must be an Array of Buffers');
                    if (0 === t.length)
                        return r.alloc(0);
                    var n;
                    if (void 0 === e)
                        for (e = 0,
                        n = 0; n < t.length; ++n)
                            e += t[n].length;
                    var i = r.allocUnsafe(e)
                      , o = 0;
                    for (n = 0; n < t.length; ++n) {
                        var f = t[n];
                        if (D(f, Uint8Array) && (f = r.from(f)),
                        !r.isBuffer(f))
                            throw new TypeError('"list" argument must be an Array of Buffers');
                        f.copy(i, o),
                        o += f.length
                    }
                    return i
                }
                ,
                r.byteLength = y,
                r.prototype._isBuffer = !0,
                r.prototype.swap16 = function() {
                    var t = this.length;
                    if (t % 2 != 0)
                        throw new RangeError("Buffer size must be a multiple of 16-bits");
                    for (var r = 0; r < t; r += 2)
                        g(this, r, r + 1);
                    return this
                }
                ,
                r.prototype.swap32 = function() {
                    var t = this.length;
                    if (t % 4 != 0)
                        throw new RangeError("Buffer size must be a multiple of 32-bits");
                    for (var r = 0; r < t; r += 4)
                        g(this, r, r + 3),
                        g(this, r + 1, r + 2);
                    return this
                }
                ,
                r.prototype.swap64 = function() {
                    var t = this.length;
                    if (t % 8 != 0)
                        throw new RangeError("Buffer size must be a multiple of 64-bits");
                    for (var r = 0; r < t; r += 8)
                        g(this, r, r + 7),
                        g(this, r + 1, r + 6),
                        g(this, r + 2, r + 5),
                        g(this, r + 3, r + 4);
                    return this
                }
                ,
                r.prototype.toString = function() {
                    var t = this.length;
                    return 0 === t ? "" : 0 === arguments.length ? T(this, 0, t) : function(t, r, e) {
                        var n = !1;
                        if ((void 0 === r || r < 0) && (r = 0),
                        r > this.length)
                            return "";
                        if ((void 0 === e || e > this.length) && (e = this.length),
                        e <= 0)
                            return "";
                        if ((e >>>= 0) <= (r >>>= 0))
                            return "";
                        for (t || (t = "utf8"); ; )
                            switch (t) {
                            case "hex":
                                return R(this, r, e);
                            case "utf8":
                            case "utf-8":
                                return T(this, r, e);
                            case "ascii":
                                return S(this, r, e);
                            case "latin1":
                            case "binary":
                                return L(this, r, e);
                            case "base64":
                                return U(this, r, e);
                            case "ucs2":
                            case "ucs-2":
                            case "utf16le":
                            case "utf-16le":
                                return C(this, r, e);
                            default:
                                if (n)
                                    throw new TypeError("Unknown encoding: " + t);
                                t = (t + "").toLowerCase(),
                                n = !0
                            }
                    }
                    .apply(this, arguments)
                }
                ,
                r.prototype.toLocaleString = r.prototype.toString,
                r.prototype.equals = function(t) {
                    if (!r.isBuffer(t))
                        throw new TypeError("Argument must be a Buffer");
                    return this === t || 0 === r.compare(this, t)
                }
                ,
                r.prototype.inspect = function() {
                    var t = ""
                      , r = e.INSPECT_MAX_BYTES;
                    return t = this.toString("hex", 0, r).replace(/(.{2})/g, "$1 ").trim(),
                    this.length > r && (t += " ... "),
                    "<Buffer " + t + ">"
                }
                ,
                o && (r.prototype[o] = r.prototype.inspect),
                r.prototype.compare = function(t, e, n, i, o) {
                    if (D(t, Uint8Array) && (t = r.from(t, t.offset, t.byteLength)),
                    !r.isBuffer(t))
                        throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof t);
                    if (void 0 === e && (e = 0),
                    void 0 === n && (n = t ? t.length : 0),
                    void 0 === i && (i = 0),
                    void 0 === o && (o = this.length),
                    e < 0 || n > t.length || i < 0 || o > this.length)
                        throw new RangeError("out of range index");
                    if (i >= o && e >= n)
                        return 0;
                    if (i >= o)
                        return -1;
                    if (e >= n)
                        return 1;
                    if (this === t)
                        return 0;
                    for (var f = (o >>>= 0) - (i >>>= 0), u = (n >>>= 0) - (e >>>= 0), s = Math.min(f, u), h = this.slice(i, o), a = t.slice(e, n), p = 0; p < s; ++p)
                        if (h[p] !== a[p]) {
                            f = h[p],
                            u = a[p];
                            break
                        }
                    return f < u ? -1 : u < f ? 1 : 0
                }
                ,
                r.prototype.includes = function(t, r, e) {
                    return -1 !== this.indexOf(t, r, e)
                }
                ,
                r.prototype.indexOf = function(t, r, e) {
                    return w(this, t, r, e, !0)
                }
                ,
                r.prototype.lastIndexOf = function(t, r, e) {
                    return w(this, t, r, e, !1)
                }
                ,
                r.prototype.write = function(t, r, e, n) {
                    if (void 0 === r)
                        n = "utf8",
                        e = this.length,
                        r = 0;
                    else if (void 0 === e && "string" == typeof r)
                        n = r,
                        e = this.length,
                        r = 0;
                    else {
                        if (!isFinite(r))
                            throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
                        r >>>= 0,
                        isFinite(e) ? (e >>>= 0,
                        void 0 === n && (n = "utf8")) : (n = e,
                        e = void 0)
                    }
                    var i = this.length - r;
                    if ((void 0 === e || e > i) && (e = i),
                    t.length > 0 && (e < 0 || r < 0) || r > this.length)
                        throw new RangeError("Attempt to write outside buffer bounds");
                    n || (n = "utf8");
                    for (var o = !1; ; )
                        switch (n) {
                        case "hex":
                            return v(this, t, r, e);
                        case "utf8":
                        case "utf-8":
                            return b(this, t, r, e);
                        case "ascii":
                            return m(this, t, r, e);
                        case "latin1":
                        case "binary":
                            return E(this, t, r, e);
                        case "base64":
                            return B(this, t, r, e);
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            return A(this, t, r, e);
                        default:
                            if (o)
                                throw new TypeError("Unknown encoding: " + n);
                            n = ("" + n).toLowerCase(),
                            o = !0
                        }
                }
                ,
                r.prototype.toJSON = function() {
                    return {
                        type: "Buffer",
                        data: Array.prototype.slice.call(this._arr || this, 0)
                    }
                }
                ;
                var I = 4096;
                function S(t, r, e) {
                    var n = "";
                    e = Math.min(t.length, e);
                    for (var i = r; i < e; ++i)
                        n += String.fromCharCode(127 & t[i]);
                    return n
                }
                function L(t, r, e) {
                    var n = "";
                    e = Math.min(t.length, e);
                    for (var i = r; i < e; ++i)
                        n += String.fromCharCode(t[i]);
                    return n
                }
                function R(t, r, e) {
                    var n = t.length;
                    (!r || r < 0) && (r = 0),
                    (!e || e < 0 || e > n) && (e = n);
                    for (var i = "", o = r; o < e; ++o)
                        i += Y[t[o]];
                    return i
                }
                function C(t, r, e) {
                    for (var n = t.slice(r, e), i = "", o = 0; o < n.length; o += 2)
                        i += String.fromCharCode(n[o] + 256 * n[o + 1]);
                    return i
                }
                function _(t, r, e) {
                    if (t % 1 != 0 || t < 0)
                        throw new RangeError("offset is not uint");
                    if (t + r > e)
                        throw new RangeError("Trying to access beyond buffer length")
                }
                function O(t, e, n, i, o, f) {
                    if (!r.isBuffer(t))
                        throw new TypeError('"buffer" argument must be a Buffer instance');
                    if (e > o || e < f)
                        throw new RangeError('"value" argument is out of bounds');
                    if (n + i > t.length)
                        throw new RangeError("Index out of range")
                }
                function x(t, r, e, n, i, o) {
                    if (e + n > t.length)
                        throw new RangeError("Index out of range");
                    if (e < 0)
                        throw new RangeError("Index out of range")
                }
                function M(t, r, e, n, o) {
                    return r = +r,
                    e >>>= 0,
                    o || x(t, 0, e, 4),
                    i.write(t, r, e, n, 23, 4),
                    e + 4
                }
                function k(t, r, e, n, o) {
                    return r = +r,
                    e >>>= 0,
                    o || x(t, 0, e, 8),
                    i.write(t, r, e, n, 52, 8),
                    e + 8
                }
                r.prototype.slice = function(t, e) {
                    var n = this.length;
                    (t = ~~t) < 0 ? (t += n) < 0 && (t = 0) : t > n && (t = n),
                    (e = void 0 === e ? n : ~~e) < 0 ? (e += n) < 0 && (e = 0) : e > n && (e = n),
                    e < t && (e = t);
                    var i = this.subarray(t, e);
                    return Object.setPrototypeOf(i, r.prototype),
                    i
                }
                ,
                r.prototype.readUIntLE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || _(t, r, this.length);
                    for (var n = this[t], i = 1, o = 0; ++o < r && (i *= 256); )
                        n += this[t + o] * i;
                    return n
                }
                ,
                r.prototype.readUIntBE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || _(t, r, this.length);
                    for (var n = this[t + --r], i = 1; r > 0 && (i *= 256); )
                        n += this[t + --r] * i;
                    return n
                }
                ,
                r.prototype.readUInt8 = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 1, this.length),
                    this[t]
                }
                ,
                r.prototype.readUInt16LE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 2, this.length),
                    this[t] | this[t + 1] << 8
                }
                ,
                r.prototype.readUInt16BE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 2, this.length),
                    this[t] << 8 | this[t + 1]
                }
                ,
                r.prototype.readUInt32LE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 4, this.length),
                    (this[t] | this[t + 1] << 8 | this[t + 2] << 16) + 16777216 * this[t + 3]
                }
                ,
                r.prototype.readUInt32BE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 4, this.length),
                    16777216 * this[t] + (this[t + 1] << 16 | this[t + 2] << 8 | this[t + 3])
                }
                ,
                r.prototype.readIntLE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || _(t, r, this.length);
                    for (var n = this[t], i = 1, o = 0; ++o < r && (i *= 256); )
                        n += this[t + o] * i;
                    return n >= (i *= 128) && (n -= Math.pow(2, 8 * r)),
                    n
                }
                ,
                r.prototype.readIntBE = function(t, r, e) {
                    t >>>= 0,
                    r >>>= 0,
                    e || _(t, r, this.length);
                    for (var n = r, i = 1, o = this[t + --n]; n > 0 && (i *= 256); )
                        o += this[t + --n] * i;
                    return o >= (i *= 128) && (o -= Math.pow(2, 8 * r)),
                    o
                }
                ,
                r.prototype.readInt8 = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 1, this.length),
                    128 & this[t] ? -1 * (255 - this[t] + 1) : this[t]
                }
                ,
                r.prototype.readInt16LE = function(t, r) {
                    t >>>= 0,
                    r || _(t, 2, this.length);
                    var e = this[t] | this[t + 1] << 8;
                    return 32768 & e ? 4294901760 | e : e
                }
                ,
                r.prototype.readInt16BE = function(t, r) {
                    t >>>= 0,
                    r || _(t, 2, this.length);
                    var e = this[t + 1] | this[t] << 8;
                    return 32768 & e ? 4294901760 | e : e
                }
                ,
                r.prototype.readInt32LE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 4, this.length),
                    this[t] | this[t + 1] << 8 | this[t + 2] << 16 | this[t + 3] << 24
                }
                ,
                r.prototype.readInt32BE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 4, this.length),
                    this[t] << 24 | this[t + 1] << 16 | this[t + 2] << 8 | this[t + 3]
                }
                ,
                r.prototype.readFloatLE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 4, this.length),
                    i.read(this, t, !0, 23, 4)
                }
                ,
                r.prototype.readFloatBE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 4, this.length),
                    i.read(this, t, !1, 23, 4)
                }
                ,
                r.prototype.readDoubleLE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 8, this.length),
                    i.read(this, t, !0, 52, 8)
                }
                ,
                r.prototype.readDoubleBE = function(t, r) {
                    return t >>>= 0,
                    r || _(t, 8, this.length),
                    i.read(this, t, !1, 52, 8)
                }
                ,
                r.prototype.writeUIntLE = function(t, r, e, n) {
                    (t = +t,
                    r >>>= 0,
                    e >>>= 0,
                    n) || O(this, t, r, e, Math.pow(2, 8 * e) - 1, 0);
                    var i = 1
                      , o = 0;
                    for (this[r] = 255 & t; ++o < e && (i *= 256); )
                        this[r + o] = t / i & 255;
                    return r + e
                }
                ,
                r.prototype.writeUIntBE = function(t, r, e, n) {
                    (t = +t,
                    r >>>= 0,
                    e >>>= 0,
                    n) || O(this, t, r, e, Math.pow(2, 8 * e) - 1, 0);
                    var i = e - 1
                      , o = 1;
                    for (this[r + i] = 255 & t; --i >= 0 && (o *= 256); )
                        this[r + i] = t / o & 255;
                    return r + e
                }
                ,
                r.prototype.writeUInt8 = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 1, 255, 0),
                    this[r] = 255 & t,
                    r + 1
                }
                ,
                r.prototype.writeUInt16LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 2, 65535, 0),
                    this[r] = 255 & t,
                    this[r + 1] = t >>> 8,
                    r + 2
                }
                ,
                r.prototype.writeUInt16BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 2, 65535, 0),
                    this[r] = t >>> 8,
                    this[r + 1] = 255 & t,
                    r + 2
                }
                ,
                r.prototype.writeUInt32LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 4, 4294967295, 0),
                    this[r + 3] = t >>> 24,
                    this[r + 2] = t >>> 16,
                    this[r + 1] = t >>> 8,
                    this[r] = 255 & t,
                    r + 4
                }
                ,
                r.prototype.writeUInt32BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 4, 4294967295, 0),
                    this[r] = t >>> 24,
                    this[r + 1] = t >>> 16,
                    this[r + 2] = t >>> 8,
                    this[r + 3] = 255 & t,
                    r + 4
                }
                ,
                r.prototype.writeIntLE = function(t, r, e, n) {
                    if (t = +t,
                    r >>>= 0,
                    !n) {
                        var i = Math.pow(2, 8 * e - 1);
                        O(this, t, r, e, i - 1, -i)
                    }
                    var o = 0
                      , f = 1
                      , u = 0;
                    for (this[r] = 255 & t; ++o < e && (f *= 256); )
                        t < 0 && 0 === u && 0 !== this[r + o - 1] && (u = 1),
                        this[r + o] = (t / f >> 0) - u & 255;
                    return r + e
                }
                ,
                r.prototype.writeIntBE = function(t, r, e, n) {
                    if (t = +t,
                    r >>>= 0,
                    !n) {
                        var i = Math.pow(2, 8 * e - 1);
                        O(this, t, r, e, i - 1, -i)
                    }
                    var o = e - 1
                      , f = 1
                      , u = 0;
                    for (this[r + o] = 255 & t; --o >= 0 && (f *= 256); )
                        t < 0 && 0 === u && 0 !== this[r + o + 1] && (u = 1),
                        this[r + o] = (t / f >> 0) - u & 255;
                    return r + e
                }
                ,
                r.prototype.writeInt8 = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 1, 127, -128),
                    t < 0 && (t = 255 + t + 1),
                    this[r] = 255 & t,
                    r + 1
                }
                ,
                r.prototype.writeInt16LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 2, 32767, -32768),
                    this[r] = 255 & t,
                    this[r + 1] = t >>> 8,
                    r + 2
                }
                ,
                r.prototype.writeInt16BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 2, 32767, -32768),
                    this[r] = t >>> 8,
                    this[r + 1] = 255 & t,
                    r + 2
                }
                ,
                r.prototype.writeInt32LE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 4, 2147483647, -2147483648),
                    this[r] = 255 & t,
                    this[r + 1] = t >>> 8,
                    this[r + 2] = t >>> 16,
                    this[r + 3] = t >>> 24,
                    r + 4
                }
                ,
                r.prototype.writeInt32BE = function(t, r, e) {
                    return t = +t,
                    r >>>= 0,
                    e || O(this, t, r, 4, 2147483647, -2147483648),
                    t < 0 && (t = 4294967295 + t + 1),
                    this[r] = t >>> 24,
                    this[r + 1] = t >>> 16,
                    this[r + 2] = t >>> 8,
                    this[r + 3] = 255 & t,
                    r + 4
                }
                ,
                r.prototype.writeFloatLE = function(t, r, e) {
                    return M(this, t, r, !0, e)
                }
                ,
                r.prototype.writeFloatBE = function(t, r, e) {
                    return M(this, t, r, !1, e)
                }
                ,
                r.prototype.writeDoubleLE = function(t, r, e) {
                    return k(this, t, r, !0, e)
                }
                ,
                r.prototype.writeDoubleBE = function(t, r, e) {
                    return k(this, t, r, !1, e)
                }
                ,
                r.prototype.copy = function(t, e, n, i) {
                    if (!r.isBuffer(t))
                        throw new TypeError("argument should be a Buffer");
                    if (n || (n = 0),
                    i || 0 === i || (i = this.length),
                    e >= t.length && (e = t.length),
                    e || (e = 0),
                    i > 0 && i < n && (i = n),
                    i === n)
                        return 0;
                    if (0 === t.length || 0 === this.length)
                        return 0;
                    if (e < 0)
                        throw new RangeError("targetStart out of bounds");
                    if (n < 0 || n >= this.length)
                        throw new RangeError("Index out of range");
                    if (i < 0)
                        throw new RangeError("sourceEnd out of bounds");
                    i > this.length && (i = this.length),
                    t.length - e < i - n && (i = t.length - e + n);
                    var o = i - n;
                    if (this === t && "function" == typeof Uint8Array.prototype.copyWithin)
                        this.copyWithin(e, n, i);
                    else if (this === t && n < e && e < i)
                        for (var f = o - 1; f >= 0; --f)
                            t[f + e] = this[f + n];
                    else
                        Uint8Array.prototype.set.call(t, this.subarray(n, i), e);
                    return o
                }
                ,
                r.prototype.fill = function(t, e, n, i) {
                    if ("string" == typeof t) {
                        if ("string" == typeof e ? (i = e,
                        e = 0,
                        n = this.length) : "string" == typeof n && (i = n,
                        n = this.length),
                        void 0 !== i && "string" != typeof i)
                            throw new TypeError("encoding must be a string");
                        if ("string" == typeof i && !r.isEncoding(i))
                            throw new TypeError("Unknown encoding: " + i);
                        if (1 === t.length) {
                            var o = t.charCodeAt(0);
                            ("utf8" === i && o < 128 || "latin1" === i) && (t = o)
                        }
                    } else
                        "number" == typeof t ? t &= 255 : "boolean" == typeof t && (t = Number(t));
                    if (e < 0 || this.length < e || this.length < n)
                        throw new RangeError("Out of range index");
                    if (n <= e)
                        return this;
                    var f;
                    if (e >>>= 0,
                    n = void 0 === n ? this.length : n >>> 0,
                    t || (t = 0),
                    "number" == typeof t)
                        for (f = e; f < n; ++f)
                            this[f] = t;
                    else {
                        var u = r.isBuffer(t) ? t : r.from(t, i)
                          , s = u.length;
                        if (0 === s)
                            throw new TypeError('The value "' + t + '" is invalid for argument "value"');
                        for (f = 0; f < n - e; ++f)
                            this[f + e] = u[f % s]
                    }
                    return this
                }
                ;
                var P = /[^+\/0-9A-Za-z-_]/g;
                function j(t, r) {
                    var e;
                    r = r || 1 / 0;
                    for (var n = t.length, i = null, o = [], f = 0; f < n; ++f) {
                        if ((e = t.charCodeAt(f)) > 55295 && e < 57344) {
                            if (!i) {
                                if (e > 56319) {
                                    (r -= 3) > -1 && o.push(239, 191, 189);
                                    continue
                                }
                                if (f + 1 === n) {
                                    (r -= 3) > -1 && o.push(239, 191, 189);
                                    continue
                                }
                                i = e;
                                continue
                            }
                            if (e < 56320) {
                                (r -= 3) > -1 && o.push(239, 191, 189),
                                i = e;
                                continue
                            }
                            e = 65536 + (i - 55296 << 10 | e - 56320)
                        } else
                            i && (r -= 3) > -1 && o.push(239, 191, 189);
                        if (i = null,
                        e < 128) {
                            if ((r -= 1) < 0)
                                break;
                            o.push(e)
                        } else if (e < 2048) {
                            if ((r -= 2) < 0)
                                break;
                            o.push(e >> 6 | 192, 63 & e | 128)
                        } else if (e < 65536) {
                            if ((r -= 3) < 0)
                                break;
                            o.push(e >> 12 | 224, e >> 6 & 63 | 128, 63 & e | 128)
                        } else {
                            if (!(e < 1114112))
                                throw new Error("Invalid code point");
                            if ((r -= 4) < 0)
                                break;
                            o.push(e >> 18 | 240, e >> 12 & 63 | 128, e >> 6 & 63 | 128, 63 & e | 128)
                        }
                    }
                    return o
                }
                function N(t) {
                    return n.toByteArray(function(t) {
                        if ((t = (t = t.split("=")[0]).trim().replace(P, "")).length < 2)
                            return "";
                        for (; t.length % 4 != 0; )
                            t += "=";
                        return t
                    }(t))
                }
                function z(t, r, e, n) {
                    for (var i = 0; i < n && !(i + e >= r.length || i >= t.length); ++i)
                        r[i + e] = t[i];
                    return i
                }
                function D(t, r) {
                    return t instanceof r || null != t && null != t.constructor && null != t.constructor.name && t.constructor.name === r.name
                }
                function F(t) {
                    return t != t
                }
                var Y = function() {
                    for (var t = new Array(256), r = 0; r < 16; ++r)
                        for (var e = 16 * r, n = 0; n < 16; ++n)
                            t[e + n] = "0123456789abcdef"[r] + "0123456789abcdef"[n];
                    return t
                }()
            }
            ).call(this, t("buffer").Buffer)
        }
        , {
            "base64-js": 5,
            buffer: 2,
            ieee754: 6
        }],
        5: [function(t, r, e) {
            arguments[4][1][0].apply(e, arguments)
        }
        , {
            dup: 1
        }],
        6: [function(t, r, e) {
            arguments[4][3][0].apply(e, arguments)
        }
        , {
            dup: 3
        }]
    }, {}, [4])(4)
});
Buffer = window.Buffer;
