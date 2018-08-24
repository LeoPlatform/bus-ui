"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var CRON_TABLE = leo.configuration.resources.LeoCron;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var id = util.botRefId(event.params && event.params.path && event.params.path.id);
	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::cron/{id}',
		action: "deleteCron",
		core: {
			id: id
		}
	});
	dynamodb.delete(CRON_TABLE, id, callback);
});