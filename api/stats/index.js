"use strict";

let request = require("leo-auth");
let stats = require("../../lib/stats.js");
require("moment-round");
var zlib = require("zlib");
let logger = require("leo-logger")("stats-api");

let compressionThreshold = 100000; // 100k

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    await request.authorize(event, {
        lrn: 'lrn:leo:botmon:::',
        action: "stats",
        botmon: {}
    });

    function findBigStrings(obj, prefix = "") {
        if (!obj) return;
        let objType = typeof obj;
        if (objType === 'object') {
            if (Array.isArray(obj)) {
                obj.forEach((value, index) => {
                    let localPrefix = prefix === '' ? `[${index}]` : prefix + `[${index}]`;
                    findBigStrings(value, localPrefix);
                });
            }
            else {
                for (const key of Object.keys(obj)) {
                    let localPrefix = prefix === '' ? key : prefix + "." + key;
                    findBigStrings(obj[key], localPrefix);
                }
            }
        } else if (objType === 'string') {
            if (obj.length > 1024) {
                logger.log(`string stored at '${prefix}' is larger than 1024 bytes (length=${obj.length}): '${obj}'`);
            }
        }
    }

    stats(event, (err, data) => {
        let stats = (data || {}).stats;
        if (stats) {
            let responseBody = JSON.stringify(stats);
            logger.log(`response body length = ${responseBody.length}`);
            if (responseBody.length > 6000000) {
                findBigStrings(stats);
            }
            let isBase64Encoded = false;
            let willAcceptGzip = false;
            const responseHeaders = {
                'Access-Control-Allow-Credentials': true,
                'Access-Control-Allow-Origin': '*',
            };
            logger.log('event.headers', event.headers);
            for (const headerName of Object.keys(event.headers)) {
                if (headerName.toLowerCase() === 'accept-encoding') {
                    if (event.headers[headerName].indexOf('gzip') !== -1) {
                        willAcceptGzip = true;
                    }
                    break;
                }
            }

            if (willAcceptGzip && responseBody.length > compressionThreshold) {
                logger.log(`compressing response,  size = ${responseBody.length}`);
                responseBody = zlib.gzipSync(responseBody).toString('base64');
                responseHeaders['Content-Encoding'] = 'gzip';
                isBase64Encoded = true;
                logger.log(`after compression, response size = ${responseBody.length}`)
            }
            callback(undefined, {
                body: responseBody,
                headers: responseHeaders,
                isBase64Encoded,
                statusCode: 200,
            });
        } else {
            callback(err, (data || {}).stats);
        }
    });
});
