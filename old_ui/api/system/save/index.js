"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var uuid = require("uuid");
var extend = require("extend");

var SYSTEM_TABLE = leo.configuration.resources.LeoSystem;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var ref = util.ref(event.params.path.id || event.body.id, "system");
	var id = ref && ref.id;

	request.authorize(event, {
		lrn: 'lrn:leo:botmon:::',
		action: "saveSystem",
		botmon: {}
	});
	event.body.crons = event.body.crons || [];
	event.body.checksums = event.body.checksums || {};
	event.body.id = id;

	buildId(event.body, (err, id) => {
		update(SYSTEM_TABLE, id, event.body, function (err, data) {
			if (err) {
				callback(err);
			} else {
				callback(null, {
					id: util.refId(id, "system")
				});
			}
		});
	});
});

function update(table, id, obj, callback) {
	dynamodb.get(table, id, (err, data) => {
		if (err) {
			return callback(err);
		}
		var data = extend(true, data, obj);
		dynamodb.put(table, id, data, callback)
	});
}

function buildId(doc, done) {
	if (doc.id) {
		return done(null, doc.id);
	}

	var baseId = doc.label.replace(/[^A-z0-9]+/g, "_");
	var id = baseId;
	var tries = 1;
	var randomAt = 3;
	var uuidAt = 10;

	var get = () => {
		console.log("ID:", id);
		dynamodb.get(SYSTEM_TABLE, id, (err, data) => {
			if (!data) {
				return done(err, id);
			}
			tries++;
			id = baseId + `_${tries}`;

			if (tries > randomAt) {
				id = baseId + `_${("0000" + Math.round(Math.random()*10000)).slice(-4)}`;
			}
			if (tries >= uuidAt) {
				done(null, uuid.v4());
			} else {
				get();
			}
		});
	};

	get();
}