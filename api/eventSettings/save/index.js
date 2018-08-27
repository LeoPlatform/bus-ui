"use strict";

var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var moment = require("moment");
var uuid = require("uuid");

var EVENT_TABLE = leo.configuration.resources.LeoEvent;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var body = event.body;

	var ref = util.ref(body.id || body.event || uuid.v4(), "queue");

	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::eventsettings/{id}',
		action: "saveEventSettings",
		botmon: {
			id: ref.id
		}
	});
	var doc = Object.assign({}, body);
	save(ref, doc, callback)
});

function save(ref, doc, callback) {
	var sets = [];
	var names = {};
	var attributes = {};

	// Fields not allowed to update
	delete doc.event; // Part of the key
	delete doc.id; // this is an alias for event send from the frontend, doesn't need to be saved
	delete doc.kinesis_number;
	delete doc.initial_kinesis_number;
	delete doc.s3_kinesis_number;
	delete doc.s3_new_kinesis_number;
	delete doc.archive_kinesis_number;

	for (var k in doc) {
		if (doc[k] !== undefined && doc[k] !== "") {
			var fieldName = k.replace(/[^a-z]+/ig, "_");
			sets.push(`#${fieldName} = :${fieldName}`);
			names[`#${fieldName}`] = k;
			attributes[`:${fieldName}`] = doc[k];
		}
	}

	var params = {
		TableName: EVENT_TABLE,
		Key: {
			event: ref.id
		},
		UpdateExpression: 'set ' + sets.join(", "),
		ExpressionAttributeNames: names,
		ExpressionAttributeValues: attributes,
		"ReturnConsumedCapacity": 'TOTAL',
		ReturnValues: 'ALL_NEW',
	}

	console.log(JSON.stringify(params, null, 2))
	dynamodb.docClient.update(params, function (err, result) {
		if (err) {
			callback(err);
		} else {
			callback(null, {
				refId: ref.toString()
			});
		}
	});
}