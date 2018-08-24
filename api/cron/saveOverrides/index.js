"use strict";
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var CRON_TABLE = leo.configuration.resources.LeoCron;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    let botId = util.botRef(event.body && event.body.id).id;
    let set = {};
    if(Object.keys(event.body).length !== 0) {
        set = event.body.health
    }

    dynamodb.merge(CRON_TABLE, botId, {
        health: set
    }, (err, data) => {

        if (err) {
            callback(err);
        } else {
            callback(null, data);
        }
    });
});