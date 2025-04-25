"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var SYSTEM_TABLE = leo.configuration.resources.LeoSystem;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var id = util.ref(event.params.path.id, "system").id;

	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::',
		action: "getSystem",
		botmon: {}
	});
	dynamodb.get(SYSTEM_TABLE, id, function (err, data) {
		console.log(err, data);
		if (err) {
			callback(err);
		} else {
			if (!data) {
				data = {
					id: id
				}
			}
			if (!data.settings) {
				data.settings = {};
			}
			data.label = data.label || data.id;
			if (!('crons' in data)) {
				data.crons = [];
			}
			if (!('checksums' in data)) {
				data.checksums = [];
			}
			callback(null, util.fixSystemReferences(data));
		}
	});
});