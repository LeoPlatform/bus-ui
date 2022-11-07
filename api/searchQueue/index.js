"use strict";
let request = require("leo-auth");
let leo = require("leo-sdk");
let ls = leo.streams;
let util = require("leo-sdk/lib/reference.js");

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    let customFilter = function($, $$) {
        return true;
    };
    let index = event.params.path.query && event.params.path.query.match(/[(!]*\$\$?\./);

    if (index) {
        let filterEx = event.params.path.query.substring(index.index);
        try {
            let global = {};
            let g = global;
            let process;
            let require;
            let fs;
            let leo;
            let ls;
            let request;
            let util;
            let context;
            let callback;
            let event;
            customFilter = eval(
                `(function($,$$,$$$){
        		try{
        			return ${filterEx.replace(/=+/g, "==").replace(/==>/g, "=>").replace(/<==/g, "<=").replace(/>==/g, ">=").replace(/!==/g, "!=").replace(/\+==/g, "+=").replace(/-==/g, "-=").replace(/:==/g, "=")};	
        		}catch(e){
        			return false;
        		}
        	})`);
        } catch (e) {
            customFilter = function() {
                return false;
            };
            return callback('invalid filter expression')
        }
        event.params.path.query = event.params.path.query.substring(0, index.index).trim();
    }

    var queue = util.ref(event.params.path.queue).asQueue(event.params.path.subqueue).id;
    if (event.params.path.query) {
        var query = new RegExp(event.params.path.query, 'i');
    } else {
        var query = null;
    }
    var start = event.params.path.start;
    var requestedCount = event.params.querystring.count || 40;
    var debug = event.params.querystring.debug || false;

    await request.authorize(event, {
        lrn: 'lrn:leo:botmon:::',
        action: "searchQueue"
    });
    var response = {
        results: [],
        resumptionToken: null,
        last_time: null,
        count: 0,
        agg: event.params.querystring.agg ? JSON.parse(event.params.querystring.agg) : {}
    };
    let filter = function($, $$, $$$) {
        return (query === null || JSON.stringify($$).match(query)) && customFilter($, $$, $$$);
    };

    var readable = ls.fromLeo("test", queue, {
        start: start,
        debug: debug,
        getEventsV1: leo.getEvents,
        stopTime: Date.now() + context.getRemainingTimeInMillis() * 0.8,
        fast_s3_read: true
    });

    let exiting = false;

    var fullTimeout = setTimeout(function() {
        readable.destroy();
        exiting = true;
    }, 10000);

    var timeout;
    let size = 0;
    readable.pipe(ls.write((obj, done) => {
        if (exiting) {
            return done();
        }
        response.resumptionToken = obj.eid;
        response.last_time = obj.timestamp;
        response.count++;

        if (filter(obj.payload, obj, response.agg)) {
            response.results.push(Object.assign({}, obj));

            size += obj.size || Buffer.byteLength(JSON.stringify(obj));

            if (!timeout) {
                timeout = setTimeout(function() {
                    readable.destroy();
                    exiting = true;
                }, 1000);
            }
            if (response.results.length >= requestedCount || size >= (1024 * 1024 * 4)) {
                readable.destroy();
                exiting = true;
            }
        }
        done();
    })).on("finish", () => {
        clearTimeout(fullTimeout);
        clearTimeout(timeout);
        callback(null, response)
    });
});
