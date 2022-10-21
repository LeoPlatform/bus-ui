"use strict";
let request = require("leo-auth");
let leo = require("leo-sdk");
let { trace } = require("leo-sdk/lib/event-trace");
const STATS_TABLE = JSON.parse(process.env.Resources).LeoStats;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {

    await request.authorize(event, {
        lrn: 'lrn:leo:botmon:::',
        action: "eventTrace",
        botmon: {}
    });

    let queue = event.params.path.queue;
    let eid = event.params.path.id || event.params.path.eid;
    let children = event.params.querystring.children;

    let response = await trace(
        leo,
        STATS_TABLE,
        {
            eid: eid,
            queue: queue,
            children: children && children.split(",")
        }
    );

    callback(null, response);
});
