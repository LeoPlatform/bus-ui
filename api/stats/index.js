"use strict";

let request = require("leo-auth");
let stats = require("../../lib/stats.js");
require("moment-round");

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    await request.authorize(event, {
        lrn: 'lrn:leo:botmon:::',
        action: "stats",
        botmon: {}
    });
    stats(event, (err, data) => {
        callback(err, (data || {}).stats)
    });
});