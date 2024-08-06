"use strict";

let request = require("leo-auth");
let leo = require('leo-sdk');
let stats = require("../../lib/stats.js");
require("moment-round");
var zlib = require("zlib");
let logger = require("leo-logger")("stats-api");
let moment = require('moment');
const { writeFileSync } = require("fs");

let compressionThreshold = 100000; // 100k

const S3_BUCKET = leo.configuration.resources.LeoS3;


exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    await request.authorize(event, {
        lrn: 'lrn:leo:botmon:::',
        action: "stats",
        botmon: {}
    });
    // This function finds strings that are bigger than 1024 and logs them out
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

    // If event contains nextPart grab that from S3 and pass it back
    // console.log(`event=>${JSON.stringify(event)}`);
    if(event.queryStringParameters && event.queryStringParameters.nextPart) {
        console.log("GOT TO NEW PART");
        const responseHeaders = {
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Origin': '*',
        };
        responseHeaders['Content-Encoding'] = 'gzip';
        let isBase64Encoded = true;
        let data = leo.aws.s3.getObject({
            Bucket: S3_BUCKET,
            Key: event.queryStringParameters.nextPart
        }).promise().then((data) => {
            console.log("s3_data => ", data);                
            callback(undefined, {
                body: data.Body.toString(),
                isBase64Encoded,
                headers: responseHeaders,
                statusCode: 200,
            });
        }).catch(callback);


    } else {
        // console.log("FETCHING STATS DATA");

        stats(event, (err, data) => {
            let stats = (data || {}).stats;
            if (stats) {
                let responseBody = JSON.stringify(stats);
                console.log(`response body length = ${responseBody.length}`);
                logger.log(`response body length = ${responseBody.length}`);

                let s3Prefix = 'files/botmon_stats_payload' + moment().format("/YYYY/MM/DD/HH/mm/") + context.awsRequestId + "_queues.json.gz";
                console.log(`s3Prefix => ${s3Prefix}`);
    

                let bots = {
                    start: stats.start,
                    end: stats.end,
                    period: stats.period,
                    nodes: {
                        bot: stats.nodes.bot
                    },
                    nextPart: s3Prefix
                };
                let queues = {
                    start: stats.start,
                    end: stats.end,
                    period: stats.period,
                    nodes: {
                        queue: stats.nodes.queue,
                        system: stats.nodes.system
                    }
                };
                let nextPart;
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
                
    
    
                let work = Promise.resolve();
    
                if (willAcceptGzip && responseBody.length > compressionThreshold) {
                    responseHeaders['Content-Encoding'] = 'gzip';
                    isBase64Encoded = true;
                    // console.log(`compressing response,  size = ${responseBody.length}`);
                    logger.log(`compressing response,  size = ${responseBody.length}`);
                    responseBody = zlib.gzipSync(responseBody).toString('base64');
                    // console.log(`after compression, response size = ${responseBody.length}`)
                    logger.log(`after compression, response size = ${responseBody.length}`)
                    if (responseBody.length > 5000000) {
                        // Compress bots and see if it is still too big
                        responseBody = zlib.gzipSync(JSON.stringify(bots)).toString('base64');
                        if (responseBody.length < 5000000) {
                            // console.log(`after compression for just bots, response size = ${responseBody.length}`)
                            // respond with the bot data and send the queue data to S3
                            let queuePayload = zlib.gzipSync(JSON.stringify(queues)).toString('base64');
                            work = leo.aws.s3.upload({
                                Bucket: S3_BUCKET,
                                Key: s3Prefix,
                                Body: queuePayload,
                            }, (err) => {
                                console.log("done uploading to s3", err);
                            }).promise();
                        } else {
                            console.log("EVEN JUST THE BOTS IS TOO BIG");
                            work = Promise.reject("payload too big still");
                        }                                   
                    }
                }
                work.then(() => {
                    callback(undefined, {
                        body: responseBody,
                        headers: responseHeaders,
                        isBase64Encoded,
                        statusCode: 200,
                    });
                }).catch(callback);
                
            } else {
                callback(err, (data || {}).stats);
            }
        });
    }

});
