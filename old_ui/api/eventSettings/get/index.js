"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var TABLE = leo.configuration.resources.LeoEvent;
exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var ref = util.ref(event.params.path.event, "queue");
	if (ref) {
		var id = ref.id;
		await request.authorize(event, {
			lrn: 'lrn:leo:botmon:::eventsettings/{id}',
			action: "getEventSettings",
			botmon: {
				id: id
			}
		});
		get(id, callback);
	} else {
		await request.authorize(event, {
			lrn: 'lrn:leo:botmon:::eventsettings',
			action: "listEventSettings"
		});
		scan(callback);
	}
});

function scan(callback) {
	dynamodb.query({
		TableName: TABLE
	}, {
		method: "scan"
	}).then(function (data) {
		callback(null, data.Items.map(fixQueue));
	}).fail(callback).done();
}

function get(id, callback) {
	dynamodb.get(TABLE, id, {
		id: "event"
	}, (err, queue) => {
		if (err) {
			callback(err, queue);
		} else {
			callback(null, fixQueue(queue || {
				event: id
			}, id))
		}
	});
}

function fixQueue(queue) {
	var ref = util.ref(queue.event);
	queue.event = ref.refId();
	queue.name = queue.name || ref.id;
	return queue;
}