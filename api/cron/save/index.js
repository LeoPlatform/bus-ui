"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");
var diff = require("deep-diff");

var CRON_TABLE = leo.configuration.resources.LeoCron;
var SETTINGS_TABLE = leo.configuration.resources.LeoSettings;
var SYSTEM_TABLE = leo.configuration.resources.LeoSystem;
var BOT_ID = "BOTSAVEAPI";
var LOG_DESTINATION = "queue:BotChangeLog";

var moment = require("moment");
var uuid = require("uuid");

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var body = event.body;

	var ref = util.ref(body.id, "bot");
	var id = ref && ref.id;

	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::cron/{id}',
		action: "saveCron",
		core: {
			id: id
		}
	});
	var doc = Object.assign({}, body, {
		"description": body.description,
		"lambda": body.lambda,
		"lambdaName": body.lambdaName,
		"paused": body.paused,
		"time": body.time,
		"delay": body.delay,
		"timeout": body.timeout
	});
	if (!id) {
		buildId(doc, (err, id) => {
			if (err) {
				return callback(err);
			}
			save(id, doc, callback);
		});
	} else {
		save(id, doc, callback)
	}
});

function buildId(doc, done) {
	if (doc.id) {
		return done(null, doc.id);
	}

	var baseId = doc.name.replace(/[^A-z0-9]+/g, "_");
	var id = baseId;
	var tries = 1;
	var randomAt = 3;
	var uuidAt = 10;

	var get = () => {
		console.log("ID:", id);
		dynamodb.get(CRON_TABLE, id, (err, data) => {
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

function save(id, doc, callback) {
	var refId = util.refId(id, "bot");
	var sets = [];
	var names = {};
	var attributes = {};

	// A bot is either time based or trigger based
	if (doc.triggers) {
		if (!Array.isArray) {
			doc.triggers = [doc.triggers];
		}
		doc.triggers = doc.triggers.map(t => util.refId(t));
		doc.time = null;
	} else if (doc.time) {
		doc.triggers = null;
	}

	doc.system = util.ref(doc.system, {
		type: "system"
	});

	delete doc.instances; // Instances shouldn't be updated
	delete doc.checkpoints; // Checkpoints should be updated
	delete doc.requested_kinesis; // requested_kinesis should be updated
	delete doc.id; // Part of the key
	delete doc.trigger; // don't update because it coudld undo a different trigger
	delete doc.invokeTime; // Only set by cron execution lambda
	if (doc.executeNow === true) {
		doc.trigger = moment.now();
		doc.ignorePaused = true;
		doc.errorCount = 0;
	}
	delete doc.executeNow;

	var newCheckpoint = doc.checkpoint;
    delete doc.checkpoint; // New version of checkpoint is an object not legacy string

	var skip = ["checksumReset"];

	for (var k in doc) {
		if (skip.indexOf(k) < 0 && doc[k] !== undefined && doc[k] !== "") {
			var fieldName = k.replace(/[^a-z]+/ig, "_");
			sets.push(`#${fieldName} = :${fieldName}`);
			names[`#${fieldName}`] = k;
			attributes[`:${fieldName}`] = doc[k];
		}
	}

	names[`#instances`] = "instances";
	attributes[`:instances`] = {};
	names["#requested_kinesis"] = "requested_kinesis";
	attributes[`:requested_kinesis`] = {};
	names["#checkpoints"] = "checkpoints";
	attributes[`:checkpoints`] = {
		read: {},
		write: {}
	};
	sets.push(`#instances = if_not_exists(#instances, :instances)`);
	sets.push(`#checkpoints = if_not_exists(#checkpoints, :checkpoints)`);
	sets.push(`#requested_kinesis = if_not_exists(#requested_kinesis, :requested_kinesis)`);

	var params = {
		TableName: CRON_TABLE,
		Key: {
			id: id
		},
		UpdateExpression: 'set ' + sets.join(", "),
		ExpressionAttributeNames: names,
		ExpressionAttributeValues: attributes,
		"ReturnConsumedCapacity": 'TOTAL',
		ReturnValues: 'ALL_NEW',
	}


    dynamodb.get(CRON_TABLE, id, (err, oldData) => {
    	if (oldData) {
    		delete oldData.instances;
		}
		dynamodb.docClient.update(params, function (err, result) {
			if (err) {
				callback(err);
			} else {
				var done = callback;
				var data = result.Attributes;
                var stream = leo.load(BOT_ID, LOG_DESTINATION);
                var newData = data;
                delete newData.instances;

                callback = (err, d) => {
                    var diffArray = diff(oldData, newData) || [];
                    var diffs = (diffArray).map(e => ({[`${e.path.join(".")}`]:{old:e.lhs || (e.item && e.item.lhs) || '', new: e.rhs || (e.item && e.item.rhs) || ''}}));
					if (diffs.length !== 0) {
                        stream.write({old: oldData, new: newData, diff: diffs});
                    }
					if (!err) {
						stream.end(() => {
							if (!err && data.system) {
								saveSystemEntry(id, data, doc).then(d => done(null, d)).catch(done);
							} else {
								done(err, d)
							}
						});
                    } else {
                    	done(err, d);
					}
				};

				var sets = [];
				var names = {
					"#checkpoints": "checkpoints"
				};
				var attributes = {};
				var index = 0;
				if (data.lambda && data.lambda.settings) {
					data.lambda.settings.forEach(setting => {
						index++;
						var destination = util.ref(setting.destination);
						if (destination && !data.checkpoints.write[destination]) {
							data.checkpoints.write[destination] = {};
							// Set blank Checkpoint
							sets.push(`#checkpoints.#write.#w_${index} = if_not_exists(#checkpoints.#write.#w_${index}, :w_${index})`);
							names[`#w_${index}`] = destination.toString();
							names["#write"] = "write";
							attributes[`:w_${index}`] = {};
						}
					});
				}

				if (newCheckpoint) {
					Object.keys(newCheckpoint).map((key)=> {
						index++;
						sets.push(`#checkpoints.#read.#r_${index} = :r_${index}`);
						names[`#r_${index}`] = key.toString();
						names["#read"] = "read";
						attributes[`:r_${index}`] = Object.assign({}, data.checkpoints.read[key], {
							checkpoint: newCheckpoint[key]
						});
					})
				}

				if (sets.length) {
					var params = {
						TableName: CRON_TABLE,
						Key: {
							id: id
						},
						UpdateExpression: 'set ' + sets.join(", "),
						ExpressionAttributeNames: names,
						ExpressionAttributeValues: attributes,
						"ReturnConsumedCapacity": 'TOTAL'
					};
					dynamodb.docClient.update(params, function (err, data) {
						console.log(err, data);
						callback(null, {
							refId: refId
						});
					});
				} else {
					callback(null, {
						refId: refId
					});
				}
			}
		});
    });
}

function saveSystemEntry(botId, cron, doc) {
	var system = cron.system;
	var systemId = (!system.id ? system : system.id.replace(/^s_/, ""));
	return new Promise((resolve, reject) => {
		if (system.type == "checksum") {
			var settings = cron.lambda.settings[0] || {};
			var otherSystem = ((!settings.master || settings.master.id == systemId) ? settings.slave : settings.master) || {};
			console.log(JSON.stringify(cron.lambda, null, 2));
			dynamodb.merge(SYSTEM_TABLE, systemId, {
				checksums: {
					[botId]: {
						bot_id: `b_${botId}`,
						label: cron.name,
						system: `s_${otherSystem.id}`,
						reset: doc.checksumReset
					}
				}
			}, (err, data) => {

				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		} else {
			resolve({});
		}
	});
}