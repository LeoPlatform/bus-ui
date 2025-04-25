"use strict";

var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var statsBuckets = require("../../lib/stats-buckets.js");
var util = require("leo-sdk/lib/reference.js");
let logger = require("leo-logger")("dashboard-api");

var moment = require("moment");
require("moment-round");
var async = require("async");

var CRON_TABLE = leo.configuration.resources.LeoCron;
var STATS_TABLE = require("leo-config").Resources.LeoStats;

function calcChange(current, prev) {
	if (current) {
		if (prev) {
			return Math.round(((current - prev) / prev) * 100) + '%';
		} else {
			return "100%";
		}
	} else if (prev) {
		return "-100%";
	} else {
		return "0%";
	}
}

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	if (!event.params.path.id) {
		let ref = util.ref(event.params.path.type);
		event.params.path.id = ref.id;
		event.params.path.type = ref.type;
	}

	var refObject = util.ref(event.params.path.id, event.params.path.type);
	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::',
		action: "dashboard",
		botmon: {}
	});
	var overrides = {
		"minute": "minute_1"
	};

	var r = event.params.querystring.range || event.params.querystring.period;
	event.params.querystring.range = overrides[r] || r;
	var numberOfPeriods = event.params.querystring.count || 1;
	var request_timestamp = moment(event.params.querystring.timestamp);
	var compareBucket = statsBuckets.data[event.params.querystring.range];
	var currentCompareTimestamp = compareBucket.prev(request_timestamp.clone(), 1 * numberOfPeriods).valueOf();
	var prevCompareTimestamp = compareBucket.prev(request_timestamp.clone(), 2 * numberOfPeriods).valueOf();
	var startTimestamp = compareBucket.prev(request_timestamp.clone(), 3 * numberOfPeriods).valueOf();
	var period = event.params.querystring.range;
	var range = statsBuckets.ranges[period] || {
		period: period,
		count: 1,
		startOf: (timestamp) => timestamp.startOf(period.replace(/_[0-9]+$/))
	};

	if (statsBuckets.ranges[period] && statsBuckets.ranges[period].rolling && numberOfPeriods == 1) {
		range = statsBuckets.ranges[period].rolling;
	}

	var bucket = statsBuckets.data[range.period];
	var endTime = bucket.value(request_timestamp.clone());
	var startTime = bucket.value(moment(startTimestamp));
	if (endTime > moment()) {
		endTime = moment();
	}
	var startBucket = bucket.transform(startTime);
	var endBucket = bucket.transform(endTime);
	logger.log("RAW", moment(startTime).format(), moment(endTime).format(), request_timestamp.format());
	logger.log("NEW", startBucket, endBucket);

	var buckets = [];
	var bucketArrayIndex = {};
	var c = startTime;
	var e = endTime.valueOf();
	var count = 0;
	while (c <= e) {
		var t = bucket.value(c.clone()).valueOf();
		buckets.push(t);
		bucketArrayIndex[t] = count++;
		c.add(bucket.duration);
	}

	var inputs = {
		request_timestamp: request_timestamp,
		prevCompareTimestamp: prevCompareTimestamp,
		currentCompareTimestamp: currentCompareTimestamp,
		startBucket: startBucket,
		endBucket: endBucket,
		buckets: buckets,
		period: period,
		bucketArrayIndex: bucketArrayIndex
	};

	if (refObject.type == "bot") {

		// Leo_cron_stats start-end bucket exec stats
		// Leo_cron Query by id
		// Queues from Checkpoints
		// Leo_cron_stats start-end queue stats

		botDashboard(refObject, inputs, (err, data) => {
			if (!err && data) {
				data.start = startTime.valueOf();
				data.end = endTime.valueOf();
				data.buckets = buckets;
			}
			callback(err, data)
		});

	} else if (refObject.type == "queue" || refObject.type == "system") {
		// Leo_cron Scan
		// Get bots that reference this queue
		// Leo_cron_stats start-end writes
		// Leo_cron_Stats start-end reads
		queueDashboard(refObject, inputs, (err, data) => {
			if (!err && data) {
				data.start = startTime.valueOf();
				data.end = endTime.valueOf();
				data.buckets = buckets;
			}
			callback(err, data)
		});
	} else {
		callback(`Unknown type: ${refObject.type}`)
	}
});

function queueData(key, type, queue, request_timestamp, buckets) {
	var ref = util.ref(key)
	return {
		type: type,
		id: ref.refId(),
		event: ref.id,
		label: ref.id,
		[`last_${type}`]: queue.timestamp,
		[`last_${type}_event_timestamp`]: parseInt(queue.checkpoint && queue.checkpoint.split && queue.checkpoint.split(/\//).pop().split(/\-/)[0] || 0),
		last_event_source_timestamp: queue.source_timestamp,
		[`last_${type}_lag`]: request_timestamp.diff(moment(queue.timestamp)),
		last_event_source_timestamp_lag: request_timestamp.diff(moment(queue.source_timestamp)),
		values: buckets.map((time) => {
			return {
				value: 0,
				time: time
			}
		}),
		lags: buckets.map((time) => {
			return {
				value: null,
				time: time
			}
		}),
		[`${type}s`]: (type === "read") && buckets.map((time) => {
			return {
				value: 0,
				time: time
			}
		}) || undefined,
		compare: {
			[`${type}s`]: {
				prev: 0,
				current: 0,
				change: 0
			},
			[`${type}_lag`]: {
				prev: 0,
				current: 0,
				prevCount: 0,
				currentCount: 0
			}
		},
		lagEvents: 0,
		checkpoint: queue.checkpoint,
		timestamp: parseInt(queue.checkpoint && queue.checkpoint.split && queue.checkpoint.split(/\//).pop().split(/\-/)[0] || 0)

	}
}

function botDashboard(refObject, data, callback) {
	var startBucket = data.startBucket;
	var endBucket = data.endBucket;
	var buckets = data.buckets;
	var period = data.period;
	var bucketArrayIndex = data.bucketArrayIndex;
	var request_timestamp = data.request_timestamp;
	var prevCompareTimestamp = data.prevCompareTimestamp;
	var currentCompareTimestamp = data.currentCompareTimestamp;
	var selfProcessor = function(ref, done) {
		leo.aws.dynamodb.query({
			TableName: STATS_TABLE,
			KeyConditionExpression: "#id = :id and #bucket between :bucket and :endBucket",
			ExpressionAttributeNames: {
				"#bucket": "bucket",
				"#id": "id"
			},
			ExpressionAttributeValues: {
				":bucket": startBucket,
				":endBucket": endBucket,
				":id": ref.refId()
			},
			"ReturnConsumedCapacity": 'TOTAL'
		}, { mb: 100 })
			.catch(callback)
			.then(bucketStats => {
				logger.log(period, bucketStats.LastEvaluatedKey, bucketStats.ConsumedCapacity, bucketStats.Items.length)

				var node = {
					executions: buckets.map((time) => {
						return {
							value: 0,
							time: time
						}
					}),
					errors: buckets.map((time) => {
						return {
							value: 0,
							time: time
						}
					}),
					duration: buckets.map((time) => {
						return {
							value: 0,
							total: 0,
							min: 0,
							max: 0,
							time: time
						}
					}),
					queues: {
						read: {},
						write: {}
					},
					compare: {
						executions: {
							prev: 0,
							current: 0,
							change: 0
						},
						errors: {
							prev: 0,
							current: 0,
							change: 0
						},
						duration: {
							prev: 0,
							current: 0,
							change: 0
						}
					}
				};
				bucketStats.Items.map(stat => {
					var index = bucketArrayIndex[stat.time]
					//logger.log(stat.id, stat.bucket);
					if (stat.current.execution) {
						let exec = stat.current.execution;
						node.executions[index].value = exec.units;
						node.errors[index].value = exec.errors; //Math.max(exec.errors, exec.units - exec.completions);
						node.duration[index] = {
							value: exec.duration / exec.units,
							total: exec.duration,
							max: exec.max_duration,
							min: exec.min_duration,
							time: stat.time
						};
						if (stat.time >= prevCompareTimestamp && stat.time < currentCompareTimestamp) {
							node.compare.executions.prev += node.executions[index].value;
							node.compare.errors.prev += node.errors[index].value;
							node.compare.duration.prev += node.duration[index].total;
						} else if (stat.time >= currentCompareTimestamp) {
							node.compare.executions.current += node.executions[index].value;
							node.compare.errors.current += node.errors[index].value;
							node.compare.duration.current += node.duration[index].total;
						}
					}
					["read", "write"].map(type => {
						var typeS = `${type}s`;
						if (stat.current[type] != undefined) {
							Object.keys(stat.current[type]).forEach((key, k) => {
								var link = stat.current[type][key];
								if (!(key in node.queues[type])) {
									node.queues[type][key] = queueData(key, type, link, request_timestamp, buckets);
								}
								var queue = node.queues[type][key];

								queue.lags[index].value += (link.timestamp - link.source_timestamp) || 0;
								if (type === "write") {
									queue.values[index].value += parseInt(link.units);
								} else {
									queue[`${typeS}`][index].value += parseInt(link.units);
								}

								if (stat.time >= prevCompareTimestamp && stat.time < currentCompareTimestamp) {
									queue.compare[`${typeS}`].prev += parseInt(link.units);
									queue.compare[`${type}_lag`].prev += (link.timestamp - link.source_timestamp) || 0;
									queue.compare[`${type}_lag`].prevCount++;
								} else if (stat.time >= currentCompareTimestamp) {
									queue.compare[`${typeS}`].current += parseInt(link.units);
									queue.compare[`${type}_lag`].current += (link.timestamp - link.source_timestamp) || 0;
									queue.compare[`${type}_lag`].currentCount++;
								}

								queue[`last_${type}`] = link.timestamp;
								queue[`last_${type}_event_timestamp`] = parseInt(link.checkpoint && link.checkpoint.split && link.checkpoint.split(/\//).pop().split(/\-/)[0] || 0);
								queue.last_event_source_timestamp = link.source_timestamp;
								queue[`last_${type}_lag`] = request_timestamp.diff(moment(link.timestamp));
								queue.last_event_source_timestamp_lag = request_timestamp.diff(moment(link.source_timestamp));

								queue.checkpoint = link.checkpoint;
								queue.timestamp = parseInt(link.checkpoint && link.checkpoint.split && link.checkpoint.split(/\//).pop().split(/\-/)[0] || 0)
							})
						}
					});
				});

				if (node.compare.executions.current) {
					node.compare.duration.current /= node.compare.executions.current;
				}
				if (node.compare.executions.prev) {
					node.compare.duration.prev /= node.compare.executions.prev;
				}
				node.compare.executions.change = calcChange(node.compare.executions.current, node.compare.executions.prev);
				node.compare.errors.change = calcChange(node.compare.errors.current, node.compare.errors.prev);
				node.compare.duration.change = calcChange(node.compare.duration.current, node.compare.duration.prev);

				["read", "write"].map(type => {
					var typeS = `${type}s`;
					Object.keys(node.queues[type]).map(key => {
						let link = node.queues[type][key];

						if (link.compare[`${type}_lag`].currentCount) {
							link.compare[`${type}_lag`].current /= link.compare[`${type}_lag`].currentCount;
						}
						if (link.compare[`${type}_lag`].prevCount) {
							link.compare[`${type}_lag`].prev /= link.compare[`${type}_lag`].prevCount;
						}

						link.compare[`${type}_lag`].change = calcChange(link.compare[`${type}_lag`].current, link.compare[`${type}_lag`].prev);
						link.compare[`${typeS}`].change = calcChange(link.compare[`${typeS}`].current, link.compare[`${typeS}`].prev);

					});
				});

				done(null, node);
			});
	};

	var botProcessor = function(ref, done) {
		dynamodb.get(CRON_TABLE, ref.id, (err, bot) => {
			done(err, bot);
		});
	};

	async.parallel({
		bot: done => botProcessor(refObject, done),
		self: done => selfProcessor(refObject, done),
	}, (err, results) => {
		var self = results.self;
		var bot = results.bot || {};

		var tasks = [];

		Object.keys(self.queues && self.queues.read || {}).map(key => {
			tasks.push((done) => {
				leo.aws.dynamodb.query({
					TableName: STATS_TABLE,
					KeyConditionExpression: "#id = :id and #bucket between :bucket and :endBucket",
					ExpressionAttributeNames: {
						"#bucket": "bucket",
						"#id": "id"
					},
					ExpressionAttributeValues: {
						":bucket": startBucket,
						":endBucket": endBucket,
						":id": util.ref(key).queue().refId()
					},
					"ReturnConsumedCapacity": 'TOTAL'
				}, { mb: 100 })
					.catch(done)
					.then(bucketStats => {

						var isBehind = false;
						var isBehindOnLast = false;
						var isBehindOnFirst = false;
						bucketStats.Items.map(stat => {
							var time = stat.time || moment.utc(stat.bucket.replace(/^.*_/, ""), "").valueOf()
							var index = bucketArrayIndex[time];
							var queue = self.queues.read[stat.id];
							Object.keys(stat.current.write || {}).map(key => {
								let link = stat.current.write[key]
								queue.values[index].value += parseInt(link.units);
								queue.latestWriteCheckpoint = maxString(queue.latestWriteCheckpoint, link.checkpoint);
								if (link.timestamp > queue.last_read_event_timestamp || link.checkpoint && queue.checkpoint < link.checkpoint) {
									queue.lagEvents += parseInt(link.units);
									if (!isBehind) { //Then we found our first one that is behind
										queue.values[index].marked = true;
									}
									isBehind = true;
									if (index == 0) {
										isBehindOnFirst = true;
									} else if (index == buckets.length) {
										isBehindOnLast = true;
									}
								}

								if (!queue.compare.writes) {
									queue.compare.writes = {
										prev: 0,
										current: 0,
										change: 0
									};
								}
								if (stat.time >= prevCompareTimestamp && stat.time < currentCompareTimestamp) {
									queue.compare[`writes`].prev += parseInt(link.units);
								} else if (stat.time >= currentCompareTimestamp) {
									queue.compare[`writes`].current += parseInt(link.units);
								}

							});
						});
						done();
					});
			})
		});

		let source = (bot.lambda && bot.lambda.settings && bot.lambda.settings[0] && bot.lambda.settings[0].source);
		self.kinesis_number = bot.checkpoints && bot.checkpoints.read && bot.checkpoints.read[source] && bot.checkpoints.read[source].checkpoint;
		if (!self.kinesis_number) {
			self.kinesis_number = Object.keys(bot.checkpoints && bot.checkpoints.read || {}).map(b => bot.checkpoints.read[b].checkpoint).filter(c => !!c).sort().pop(0) || "";
		}

		// Add missing Queues from checkpoints
		tasks.push((done) => {
			var cp = bot.checkpoints || {};
			["read", "write"].map(type => {
				Object.keys(cp[type]).map(key => {
					var id = util.refId(key);
					var queue = self.queues[type][id];
					if (!queue) {
						var data = cp[type][key];
						self.queues[type][id] = queueData(id, type, {
							timestamp: data.ended_timestamp,
							checkpoint: data.checkpoint,
							source_timestamp: data.source_timestamp
						}, request_timestamp, buckets);
					}
				});
			});
			done();
		});

		async.parallel(tasks, (err, results) => {
			//logger.log(JSON.stringify(bot, null, 2));

			// Make reads lags grow over time if not reading
			Object.keys(self.queues.read).map(key => {
				var link = self.queues.read[key];

				if (link.compare.writes) {
					link.compare.writes.change = calcChange(link.compare.writes.current, link.compare.writes.prev);
				}

				var last = {
					value: null
				};
				var latestWriteCheckpoint = link.latestWriteCheckpoint;
				link.lags.map(function(v) {
					if (last.value !== null && v.value === null && link.checkpoint < latestWriteCheckpoint) {
						v.value = last.value + (v.time - last.time);
					}
					last = v;
				});

			})

			callback(err, self);
		});

	});

}

function botData(key, type, bot, request_timestamp, buckets) {

	var ref = util.ref(key)
	return {
		id: ref.refId(),
		type: type,
		event: ref.id,
		label: ref.id,
		last_write: bot.timestamp,
		last_event_source_timestamp: bot.source_timestamp,
		last_write_lag: request_timestamp.diff(moment(bot.timestamp)),
		values: buckets.map((time) => {
			return {
				value: 0,
				time: time
			}
		}),
		lags: buckets.map((time) => {
			return {
				value: null,
				time: time
			}
		}),
		lagEvents: 0,
		compare: {
			reads: {
				prev: 0,
				current: 0,
				change: 0
			},
			writes: {
				prev: 0,
				current: 0,
				change: 0
			},
			read_lag: {
				prev: 0,
				current: 0,
				prevCount: 0,
				currentCount: 0
			},
			write_lag: {
				prev: 0,
				current: 0,
				prevCount: 0,
				currentCount: 0
			}
		},
		last_event_source_timestamp_lag: request_timestamp.diff(moment(bot.source_timestamp)),
		checkpoint: bot.checkpoint,
		timestamp: parseInt(bot.checkpoint && bot.checkpoint.split(/\//).pop().split(/\-/)[0] || 0)
	};
}

function queueDashboard(refObject, data, callback) {
	var startBucket = data.startBucket;
	var endBucket = data.endBucket;
	var buckets = data.buckets;
	var period = data.period;
	var bucketArrayIndex = data.bucketArrayIndex;
	var request_timestamp = data.request_timestamp;
	var prevCompareTimestamp = data.prevCompareTimestamp;
	var currentCompareTimestamp = data.currentCompareTimestamp;

	var selfProcessor = function(done) {
		leo.aws.dynamodb.query({
			TableName: STATS_TABLE,
			KeyConditionExpression: "#id = :id and #bucket between :bucket and :endBucket",
			ExpressionAttributeNames: {
				"#bucket": "bucket",
				"#id": "id"
			},
			ExpressionAttributeValues: {
				":bucket": startBucket,
				":endBucket": endBucket,
				":id": refObject.queue().refId()
			},
			"ReturnConsumedCapacity": 'TOTAL'
		}, { mb: 100 })
			.catch(done)
			.then(bucketStats => {
				logger.log(period, bucketStats.LastEvaluatedKey, bucketStats.ConsumedCapacity, bucketStats.Items.length);

				var node = {
					reads: buckets.map((time) => {
						return {
							value: 0,
							time: time
						}
					}),
					writes: buckets.map((time) => {
						return {
							value: 0,
							time: time
						}
					}),
					read_lag: buckets.map((time) => {
						return {
							value: 0,
							total: 0,
							min: null,
							max: 0,
							time: time
						}
					}),
					write_lag: buckets.map((time) => {
						return {
							value: 0,
							total: 0,
							min: null,
							max: 0,
							time: time
						}
					}),
					bots: {
						read: {},
						write: {}
					},
					compare: {
						reads: {
							prev: 0,
							current: 0,
							change: 0
						},
						writes: {
							prev: 0,
							current: 0,
							change: 0
						},
						read_lag: {
							prev: 0,
							current: 0,
							prevCount: 0,
							currentCount: 0
						},
						write_lag: {
							prev: 0,
							current: 0,
							prevCount: 0,
							currentCount: 0
						}
					}
				};
				bucketStats.Items.map(stat => {
					var index = bucketArrayIndex[stat.time];
					//logger.log(stat.id, stat.bucket, stat.time);

					//logger.log(stat);
					["read", "write"].map(type => {
						var typeS = `${type}s`;
						if (stat.current[type] != undefined) {
							Object.keys(stat.current[type]).forEach((key, k) => {
								var link = stat.current[type][key];
								if (!(key in node.bots[type])) {
									node.bots[type][key] = botData(key, type, link, request_timestamp, buckets);
									node.bots[type][key].event = refObject.refId();
								}
								node[`${typeS}`][index].value += parseInt(link.units);
								node[`max_${type}_checkpoint`] = maxString(node[`${typeS}_checkpoint`], link.checkpoint);

								var bot = node.bots[type][key];
								bot.values[index].value = parseInt(link.units);
								var linkLag = (link.timestamp - link.source_timestamp) || 0;
								bot.lags[index].value += linkLag;

								var lag = node[`${type}_lag`][index];
								//node[`${typeS}_lag`][index].value += parseInt(link.units);
								lag.count++;
								lag.total += linkLag;
								//lag.value += parseInt(link.units);
								lag.min = lag.min != null ? Math.min(lag.min, linkLag) : linkLag;
								lag.max = Math.max(lag.max, linkLag);

								if (stat.time >= prevCompareTimestamp && stat.time < currentCompareTimestamp) {
									bot.compare[`${typeS}`].prev += parseInt(link.units);
									bot.compare[`${type}_lag`].prev += (link.timestamp - link.source_timestamp) || 0;
									bot.compare[`${type}_lag`].prevCount++;
								} else if (stat.time >= currentCompareTimestamp) {
									bot.compare[`${typeS}`].current += parseInt(link.units);
									bot.compare[`${type}_lag`].current += (link.timestamp - link.source_timestamp) || 0;
									bot.compare[`${type}_lag`].currentCount++;
								}

								bot[`last_${type}`] = link.timestamp;
								bot[`last_${type}_event_timestamp`] = parseInt(link.checkpoint && link.checkpoint.split && link.checkpoint.split(/\//).pop().split(/\-/)[0] || 0);
								bot.last_event_source_timestamp = link.source_timestamp;
								bot[`last_${type}_lag`] = request_timestamp.diff(moment(link.timestamp));
								bot.last_event_source_timestamp_lag = request_timestamp.diff(moment(link.source_timestamp));

								bot.checkpoint = link.checkpoint;
								bot.timestamp = parseInt(link.checkpoint && link.checkpoint.split && link.checkpoint.split(/\//).pop().split(/\-/)[0] || 0)
							})
						}
					});
				});

				["read", "write"].map(type => {
					var typeS = `${type}s`;
					Object.keys(node.bots[type]).map(key => {
						let link = node.bots[type][key];

						if (link.compare[`${type}_lag`].currentCount) {
							link.compare[`${type}_lag`].current /= link.compare[`${type}_lag`].currentCount;
						}
						if (link.compare[`${type}_lag`].prevCount) {
							link.compare[`${type}_lag`].prev /= link.compare[`${type}_lag`].prevCount;
						}

						link.compare[`${type}_lag`].change = calcChange(link.compare[`${type}_lag`].current, link.compare[`${type}_lag`].prev);
						link.compare[`${typeS}`].change = calcChange(link.compare[`${typeS}`].current, link.compare[`${typeS}`].prev);

					});
				});

				node.reads.forEach((e) => {
					if (e.time >= prevCompareTimestamp && e.time < currentCompareTimestamp) {
						node.compare.reads.prev += e.value;
					} else if (e.time >= currentCompareTimestamp) {
						node.compare.reads.current += e.value;
					}
				});
				node.writes.forEach((e) => {
					if (e.time >= prevCompareTimestamp && e.time < currentCompareTimestamp) {
						node.compare.writes.prev += e.value;
					} else if (e.time >= currentCompareTimestamp) {
						node.compare.writes.current += e.value;
					}
				});
				node.read_lag.forEach((e) => {
					if (e.total && e.time >= prevCompareTimestamp && e.time < currentCompareTimestamp) {
						node.compare.read_lag.prev += e.total;
						node.compare.read_lag.prevCount++;
					} else if (e.total && e.time >= currentCompareTimestamp) {
						node.compare.read_lag.current += e.total;
						node.compare.read_lag.currentCount++;
					}
				});
				if (node.compare.read_lag.current) {
					node.compare.read_lag.current /= node.compare.read_lag.currentCount;
				}
				if (node.compare.read_lag.prev) {
					node.compare.read_lag.prev /= node.compare.read_lag.prevcount;
				}

				node.write_lag.forEach((e) => {
					if (e.total && e.time >= prevCompareTimestamp && e.time < currentCompareTimestamp) {
						node.compare.write_lag.prev += e.total;
						node.compare.write_lag.prevCount++;
					} else if (e.total && e.time >= currentCompareTimestamp) {
						node.compare.write_lag.current += e.total;
						node.compare.write_lag.currentCount++;
					}
				});
				if (node.compare.write_lag.current) {
					node.compare.write_lag.current /= node.compare.write_lag.currentCount;
				}
				if (node.compare.write_lag.prev) {
					node.compare.write_lag.prev /= node.compare.write_lag.prevCount;
				}
				node.compare.reads.change = calcChange(node.compare.reads.current, node.compare.reads.prev);
				node.compare.writes.change = calcChange(node.compare.writes.current, node.compare.writes.prev);
				node.compare.read_lag.change = calcChange(node.compare.read_lag.current, node.compare.read_lag.prev);
				node.compare.write_lag.change = calcChange(node.compare.write_lag.current, node.compare.write_lag.prev);

				done(null, node);
			});
	};
	var botsProcessor = function(done) {
		dynamodb.scan(CRON_TABLE, null, (err, bots) => {
			if (err) {
				done(err)
			} else {
				var id = refObject.refId();
				var rawId = refObject.id;
				done(null, bots.filter(bot => {
					let read = bot.checkpoints && bot.checkpoints.read || {};
					let write = bot.checkpoints && bot.checkpoints.write || {};
					return !bot.archived && (read[id] || read[rawId] || write[id] || write[rawId]);
				}).map(bot => {
					let read = bot.checkpoints && bot.checkpoints.read || {};
					let write = bot.checkpoints && bot.checkpoints.write || {};
					return {
						id: util.refId(bot.id, "bot"),
						read: read[id] || read[rawId],
						write: write[id] || write[rawId]
					}
				}));
			}
		});
	};
	async.parallel({
		bots: botsProcessor,
		self: selfProcessor,
	}, (err, results) => {
		if (err) {
			logger.log(err);
			return callback(err);
		}
		var self = results.self;
		var bots = results.bots;

		var latestWriteCheckpoint = self["max_write_checkpoint"];
		// Make reads lags grow over time if not reading
		Object.keys(self.bots.read).map(key => {
			var link = self.bots.read[key];
			var last = {
				value: null
			};

			link.lags.map(function(v) {
				if (last.value !== null && v.value === null && link.checkpoint < latestWriteCheckpoint) {
					v.value = last.value + (v.time - last.time);
				}
				last = v;
			});
		});

		bots.map(bot => {
			if (!!bot.read && !self.bots.read[bot.id]) {
				self.bots.read[bot.id] = botData(bot.id, "read", {
					timestamp: bot.timestamp,
					source_timestamp: bot.source_timestamp,
					checkpoint: bot.checkpoint
				}, request_timestamp, buckets);
				self.bots.read[bot.id].event = refObject.refId();
			}
			if (!!bot.write && !self.bots.write[bot.id]) {
				self.bots.write[bot.id] = botData(bot.id, "write", {
					timestamp: bot.timestamp,
					source_timestamp: bot.source_timestamp,
					checkpoint: bot.checkpoint
				}, request_timestamp, buckets);
				self.bots.write[bot.id].event = refObject.refId();
			}
		});

		callback(err, self);

	});
}

function systemDashboard() { }

function smartMergeStats(s, r) {
	if (r.source_timestamp !== undefined) {
		return mergeStats(s, r)
	} else {
		return mergeExecutionStats(s, r);
	}
}

function mergeExecutionStats(s, r) {
	s.completions = sum(s.completions, r.completions);
	s.units = sum(s.units, r.units);
	s.duration = sum(safeNumber(parseInt(s.duration)), safeNumber(parseInt(r.duration)));
	s.max_duration = max(s.max_duration, r.max_duration);

	if (r.min_duration > 0) {
		s.min_duration = min(s.min_duration, r.min_duration);
	} else {
		s.min_duration = s.min_duration || 0;
	}

	s.errors = sum(s.errors, r.errors);
	return s;
}

function mergeStats(s, r) {
	s.source_timestamp = max(s.source_timestamp, r.source_timestamp);
	s.timestamp = max(s.timestamp, r.timestamp);
	s.units = sum(s.units, r.units);
	s.checkpoint = r.checkpoint || s.checkpoint;

	return s;
}

function maxString() {
	var max = arguments[0]
	for (var i = 1; i < arguments.length; ++i) {
		if (arguments[i] != null && arguments[i] != undefined) {
			max = max > arguments[i] ? max : arguments[i];
		}
	}
	return max;
}

function max(a, b) {
	if (typeof a === "number") {
		return Math.max(a, b);
	} else if (typeof a === "string") {
		return a.localeCompare(b) >= 1 ? a : b;
	} else {
		return b;
	}
}

function min(a, b) {
	if (typeof a === "number") {
		return Math.min(a, b);
	} else if (typeof a === "string") {
		return a.localeCompare(b) >= 1 ? b : a;
	} else {
		return b;
	}
}

function sum(a, b, defaultValue) {
	return (a || defaultValue || 0) + (b || defaultValue || 0)
}

function safeNumber(number) {
	if (isNaN(number) || !number) {
		return 0;
	} else {
		return number;
	}
}
