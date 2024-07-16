"use strict";
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var statsBuckets = require("./stats-buckets.js");
var zlib = require("zlib");
var refUtil = require("leo-sdk/lib/reference.js");
let logger = require("leo-logger")("stats-lib");

let moment = require("moment");
let later = require("later");
require("moment-round");
let async = require("async");
let _ = require('lodash');

const humanize = require("./humanize.js");

var CRON_TABLE = leo.configuration.resources.LeoCron;
var EVENT_TABLE = leo.configuration.resources.LeoEvent;
var SYSTEM_TABLE = leo.configuration.resources.LeoSystem;
var STATS_TABLE = JSON.parse(process.env.Resources).LeoStats;

let statsCache = {};

const systemSegments = parseInt(process.env.SYSTEM_SCAN_SEGMENTS ?? "1") || 1;
const botSegments = parseInt(process.env.BOT_SCAN_SEGMENTS ?? "1") || 1;
const queueSegments = parseInt(process.env.QUEUE_SCAN_SEGMENTS ?? "1") || 1;


module.exports = function(event, callback) {
	var useLatestCheckpoints = event.params.querystring.useLatestCheckpoints == true;
	var request_timestamp = moment(event.params.querystring.timestamp);
	var period = event.params.querystring.range;
	var numberOfPeriods = event.params.querystring.count || 1;
	var rolling = event.params.querystring.rolling == undefined ? true : !!event.params.querystring.rolling;
	var includeRawBotData = event.includeRawBotData;

	var range = statsBuckets.ranges[period] || {
		period: period,
		count: 1,
		startOf: (timestamp) => timestamp.startOf(period.replace(/_[0-9]+$/))
	};

	var inclusiveStart = true;
	var inclusiveEnd = false;
	var endNextCount = 1;
	if (!rolling && range.startOf) {
		request_timestamp = range.startOf(request_timestamp);
		endNextCount = range.count;
	} else if (rolling && statsBuckets.ranges[period] && statsBuckets.ranges[period].rolling && numberOfPeriods == 1) {
		range = statsBuckets.ranges[period].rolling;
	}
	var bucketUtils = statsBuckets.data[range.period];
	period = bucketUtils.period;

	logger.log("Requested Timestamp:", request_timestamp.format(), range.count, numberOfPeriods)
	var endTime = bucketUtils.value(bucketUtils.next(request_timestamp.clone(), endNextCount));
	var startTime = bucketUtils.prev(endTime, range.count * numberOfPeriods);

	var out = {
		start: startTime.valueOf(),
		end: endTime.valueOf(),
		period: range.period,
		nodes: {
			system: {},
			bot: {},
			queue: {}
		}
	};
	var isCurrent = true;
	var compare_timestamp = request_timestamp.clone();
	if (out.end < moment.now()) {
		compare_timestamp = moment(out.end);
		isCurrent = false;
	}
	if (out.end >= moment.now()) {
		compare_timestamp = moment();
		isCurrent = true;
	}
	if (isCurrent) {
		useLatestCheckpoints = true;
	}

	async.parallel({
		systems: systemsProcessor,
		queues: queuesProcessor,
		bots: botsProcessor,
		stats: statsProcessorParallel,
	}, (err, results) => {
		if (err) {
			logger.log(err);
			return callback(err);
		}
		merge(results, callback);
	});

	function merge(results, done) {
		let statsData = results.stats;

		out.nodes.system = results.systems;
		out.nodes.bot = results.bots;
		out.nodes.queue = results.queues;

		// Post Process Bots
		Object.keys(out.nodes.bot).map(key => {
			let bot = out.nodes.bot[key];

			Object.keys(bot.link_to.parent).map(key => {
				get(key).link_to.children[bot.id] = Object.assign({}, bot.link_to.parent[key], {
					id: bot.id
				});
			});

			Object.keys(bot.link_to.children).map(key => {
				let link = bot.link_to.children[key];
				let child = get(key);

				if (useLatestCheckpoints && child.latest_checkpoint <= link.checkpoint) {
					child.latest_checkpoint = link.checkpoint;
				}
				if (useLatestCheckpoints && child.latest_write <= link.last_write) {
					child.latest_write = link.last_write;
				}
				child.link_to.parent[bot.id] = Object.assign({}, link, {
					id: bot.id
				});
			});

		});

		// Merge In Stats
		Object.keys(statsData).map(botId => {
			let botStats = statsData[botId];
			let exec = botStats.execution;

			var bot = get(botId);
			bot.executions = exec.units;
			bot.errors = exec.errors; //Math.max(exec.errors, exec.units - exec.completions);
			if (bot.health && bot.health.error_limit && typeof bot.health.error_limit === 'number') {
				bot.expect.error_limit = bot.health.error_limit;
			}
			if (bot.errors >= 1 && bot.errors >= bot.executions * bot.expect.error_limit && !bot.archived) {
				bot.isAlarmed = true;
				bot.alarms.errors = {
					value: bot.errors,
					limit: `${bot.errors} > ${bot.executions * bot.expect.error_limit}`,
					msg: ` ${bot.errors} > ${bot.executions * bot.expect.error_limit}`
				};
			}
			bot.duration = {
				min: exec.min_duration,
				max: exec.max_duration,
				total: exec.duration,
				avg: exec.duration / exec.units
			}

			// Reads
			Object.keys(botStats.read).map(key => {
				let linkData = botStats.read[key];
				let other = get(key);

				let data = {
					type: "read",
					last_read: linkData.timestamp,
					last_event_source_timestamp: linkData.source_timestamp,
					checkpoint: linkData.checkpoint,
					units: linkData.units,
					test: true
				}

				if (isCurrent && other.link_to.children[bot.id]) {
					let currentStats = other.link_to.children[bot.id]
					data.checkpoint = currentStats.checkpoint;
					data.last_read = currentStats.last_read;
					data.last_event_source_timestamp = currentStats.last_event_source_timestamp;
				}

				bot.link_to.parent[other.id] = Object.assign({}, data, {
					id: other.id
				});

				other.link_to.children[bot.id] = Object.assign({}, data, {
					id: bot.id
				});

			});

			// Writes
			Object.keys(botStats.write).map(key => {
				let linkData = botStats.write[key];
				let other = get(key);

				let data = {
					type: "write",
					last_write: linkData.timestamp,
					last_event_source_timestamp: linkData.source_timestamp,
					checkpoint: linkData.checkpoint,
					units: linkData.units,
					test: true
				};

				if (isCurrent && other.link_to.parent[bot.id]) {
					let currentStats = other.link_to.parent[bot.id];
					data.checkpoint = currentStats.checkpoint;
					data.last_write = currentStats.last_write;
					data.last_event_source_timestamp = currentStats.last_event_source_timestamp;
				}

				bot.link_to.children[other.id] = Object.assign({}, data, {
					id: other.id
				});

				other.link_to.parent[bot.id] = Object.assign({}, data, {
					id: bot.id
				});

				other.latest_write = Math.max(linkData.timestamp, other.latest_write)
				if (!other.latest_checkpoint || other.latest_checkpoint.localeCompare(linkData.checkpoint) <= 0) {
					other.latest_checkpoint = linkData.checkpoint
				};
			});
		});

		// Post Process Queues
		["queue", "system"].map(type => {
			Object.keys(out.nodes[type]).map(key => {
				let queue = out.nodes[type][key];
				if (queue.owner) {
					queue.hidden = true;
					let ownerCheck = queue.id.replace(/^(system|bot)\./, '$1:');
					if (out.nodes.system[ownerCheck] || out.nodes.bot[ownerCheck]) {
						queue.owner = ownerCheck;
					}
					let owner = get(queue.owner);
					owner.subqueues.push(queue.id);
					let ref = refUtil.ref(queue.id);
					let q = ref.owner().queue;

					// Rename the label if there is a sub queue
					if (queue.label === ref.id && q) {
						queue.label = owner.label + " - " + q;
					}
				}

				// Post Processing on Write Links
				Object.keys(queue.link_to.parent).map(key => {
					let link = queue.link_to.parent[key];
					let bot = get(key);
					let link2 = bot.link_to.children[queue.id];

					link2.event_source_lag = link.event_source_lag = moment(link.last_write).diff(link.last_event_source_timestamp);
					link2.last_write_lag = link.last_write_lag = compare_timestamp.diff(link.last_write);

					bot.queues.write.count++;
					bot.queues.write.events += link.units;
					queue.bots.write.count++;
					queue.bots.write.events += link.units;

					if (bot.health && bot.health.write_lag && typeof bot.health.write_lag === 'number') {
						bot.expect.write_lag = bot.health.write_lag;
					}

					let notTriggeredOrTime = false;
					if ((typeof bot.triggers === 'undefined' || !bot.triggers.length > 0 || bot.triggers === null) && (typeof bot.frequency === 'undefined' || bot.frequency === '' || bot.frequency === null)) {
						notTriggeredOrTime = true;
					}

					if (link.last_write && link.last_write >= bot.queues.write.last_write) {
						bot.queues.write.last_write = link.last_write;
						bot.queues.write.last_write_lag = link.last_write_lag;
						if (link.last_write_lag >= bot.expect.write_lag && !notTriggeredOrTime && !bot.archived) {
							bot.isAlarmed = true;
							bot.alarms.write_lag = {
								value: humanize(link.last_write_lag),
								limit: humanize(bot.expect.write_lag),
								msg: `${humanize(link.last_write_lag)} > ${humanize(bot.expect.write_lag)}`
							};
						}
					}
					if (link.last_event_source_timestamp && link.last_event_source_timestamp >= bot.queues.write.last_source) {
						bot.queues.write.last_source = link.last_event_source_timestamp;
						bot.queues.write.last_source_lag = link.event_source_lag;
					}
					if (link.last_write && link.last_write >= queue.bots.write.last_write) {
						queue.bots.write.last_write = link.last_write;
						queue.bots.write.last_write_lag = link.last_write_lag;
					}
					if (link.last_event_source_timestamp && link.last_event_source_timestamp >= queue.bots.write.last_source) {
						queue.bots.write.last_source = link.last_event_source_timestamp;
						queue.bots.write.last_source_lag = link.event_source_lag;
					}

					// If this is a sub queue of a bot/system, link to the owner instead
					if (queue.owner) {
						var owner = get(queue.owner);
						if (owner.queue === queue.id) {
							var l = owner.link_to.parent[key];
							owner.link_to.parent[key] = Object.assign({}, l, link);
							delete queue.link_to.parent[key];

							delete bot.link_to.children[queue.id];
							bot.link_to.children[owner.id] = Object.assign(link2, {
								id: owner.id
							});
						}
					}
				});

				// Post Processing on Read Links
				Object.keys(queue.link_to.children).map(key => {
					var link = queue.link_to.children[key];
					var bot = get(key);
					var link2 = bot.link_to.parent[queue.id];
					if (link.checkpoint < queue.latest_checkpoint) {
						link.event_source_lag = compare_timestamp.diff(link.last_event_source_timestamp);
						link.last_read_lag = compare_timestamp.diff(link.last_read);
					} else if (link.checkpoint >= queue.latest_checkpoint) {
						link.event_source_lag = 0;
						link.last_read_lag = 0;
					} else {
						link.event_source_lag = null;
						link.last_read_lag = null;
					}
					link2.event_source_lag = link.event_source_lag;
					link2.last_read_lag = link.last_read_lag;

					bot.queues.read.count++;
					bot.queues.read.events += link.units;
					queue.bots.read.count++;
					queue.bots.read.events += link.units;

					if (bot.health && bot.health.source_lag && typeof bot.health.source_lag === 'number') {
						bot.expect.source_lag = bot.health.source_lag;
					}

					if (link.last_read && link.last_read >= bot.queues.read.last_read) {
						bot.queues.read.last_read = link.last_read;
						bot.queues.read.last_read_lag = link.last_read_lag;
					}

					let notTriggeredOrTime = false;
					if ((typeof bot.triggers === 'undefined' || !bot.triggers.length > 0 || bot.triggers === null) && (typeof bot.frequency === 'undefined' || bot.frequency === '' || bot.frequency === null)) {
						notTriggeredOrTime = true;
					}

					if (link.last_event_source_timestamp && link.last_event_source_timestamp >= bot.queues.read.last_source) {
						bot.queues.read.last_source = link.last_event_source_timestamp;
						bot.queues.read.last_source_lag = link.event_source_lag;
						if (link.event_source_lag > bot.expect.source_lag && !notTriggeredOrTime && !bot.archived) {
							bot.isAlarmed = true;
							bot.alarms.source_lag = {
								value: humanize(link.event_source_lag),
								limit: humanize(bot.expect.source_lag),
								msg: ` ${humanize(link.event_source_lag)} > ${humanize(bot.expect.source_lag)}`
							};
						}
					}
					if (link.last_read && link.last_read >= queue.bots.read.last_read) {
						queue.bots.read.last_read = link.last_read;
						queue.bots.read.last_read_lag = link.last_read_lag;
					}
					if (link.last_event_source_timestamp && link.last_event_source_timestamp >= queue.bots.read.last_source) {
						queue.bots.read.last_source = link.last_event_source_timestamp;
						queue.bots.read.last_source_lag = link.event_source_lag;
					}

					// If this is a sub queue of a bot/system, link to the owner instead
					if (queue.owner) {
						var owner = get(queue.owner);
						if (owner.queue === queue.id) {
							var l = owner.link_to.children[key];
							owner.link_to.children[key] = Object.assign({}, l, link);
							delete queue.link_to.children[key];

							delete bot.link_to.parent[queue.id];
							bot.link_to.parent[owner.id] = Object.assign(link2, {
								id: owner.id
							});
						}
					}
				});
			});
		});

		out.get = function(id) {
			var ref = refUtil.ref(id);
			return this.nodes[ref.type][ref.refId()];
		};

		done(null, {
			stats: out
		});
	}

	function statsProcessorParallel(done) {
		// console.time("STATS QUERY PARALLEL");
		// We know that by default end - start ~= 15 minutes (give or take a second)
		// We want to chunk this up into 2 minute chunks
		let start = out.start + (!inclusiveStart ? 1 : 0);
		let end = out.end - (!inclusiveEnd ? 1 : 0);

		let timeSpans = splitTime(start, end);

		let queries = [];
		for(const span of timeSpans) {
			let query = {
				TableName: STATS_TABLE,
				IndexName: "period-time-index",
				KeyConditionExpression: "#period = :period and #time between :start and :end",
				ExpressionAttributeNames: {
					"#time": "time",
					"#period": "period"
				},
				ExpressionAttributeValues: {
					":start": span.start,
					":end": span.end,
					":period": period
				},
				"ReturnConsumedCapacity": 'TOTAL'
			};
			queries.push(query);
		}

		parallelQuery(queries, { mb: 100 }, mergeStatsResults)
			.then( data => {
				// console.timeEnd("STATS QUERY PARALLEL");
				done(null, data)
			})
			.catch(done);
	}

	function statsProcessor(done) {
		let start = out.start + (!inclusiveStart ? 1 : 0);
		let end = out.end - (!inclusiveEnd ? 1 : 0);
		// Query for all the records in the 'period-time-index' where 'period' = minute AND (time > start AND time < end)
		leo.aws.dynamodb.query({
			TableName: STATS_TABLE,
			IndexName: "period-time-index",
			KeyConditionExpression: "#period = :period and #time between :start and :end",
			ExpressionAttributeNames: {
				"#time": "time",
				"#period": "period"
			},
			ExpressionAttributeValues: {
				":start": start,
				":end": end,
				":period": period
			},
			"ReturnConsumedCapacity": 'TOTAL'
		}, { mb: 100 })
			.catch(err => done(err))
// Take the response and merge it together
			.then(bucketsStats => {
				logger.log(period, bucketsStats.LastEvaluatedKey, bucketsStats.ConsumedCapacity, bucketsStats.Items.length)
				var out = {};

				var executionDefaults = {
					completions: 0,
					duration: 0,
					max_duration: 0,
					min_duration: 0,
					errors: 0,
					units: 0,
				};
				var defaults = {
					checkpoint: 0,
					source_timestamp: 0,
					timestamp: 0,
					units: 0
				};

				// loop through each record and merge the stats for each record
				bucketsStats.Items.map(stat => {
					//if (stat.id.match(/^bot:/)) {
					if (!(stat.id in out)) {
						out[stat.id] = {
							execution: Object.assign({}, executionDefaults),
							read: {},
							write: {},
						}
					}
					var node = out[stat.id];
					if (stat.current.execution) {
						node.execution = mergeExecutionStats(node.execution, stat.current.execution);
					}
					["read", "write"].map(type => {
						Object.keys(stat.current[type] || {}).map(key => {
							if (!(key in node[type])) {
								node[type][key] = Object.assign({}, defaults);
							}
							node[type][key] = mergeStats(node[type][key], stat.current[type][key]);
						})
					});
				});

				done(null, out);
			});
	}

	function get(id, type) {
		let ref = refUtil.ref(id, type);
		let ret = out.nodes[ref.type][ref.refId()];
		if (!ret) {
			out.nodes[ref.type][ref.refId()] = ret = create(ref);
		} else {
			ret.alarms = ret.alarms || {};
		}
		return ret;
	}

	function create(ref) {
		if (ref.type === "system") {
			return createSystem(ref)
		} else if (ref.type === "queue") {
			return createQueue(ref);
		} else if (ref.type === "bot") {
			return createBot(ref);
		}
	}

	function createSystem(systemId) {
		let ref = refUtil.ref(systemId, "system")
		return {
			id: ref.refId(),
			type: 'system',
			icon: "system.png",
			tags: '',
			label: ref.id,
			crons: [],
			checksums: false,
			heartbeat: {},
			queue: ref.asQueue().refId(),
			subqueues: [],
			bots: {
				read: {
					count: 0,
					events: 0,
					last_read: null,
					last_read_lag: null,
					last_source: null,
					last_source_lag: null
				},
				write: {
					count: 0,
					events: 0,
					last_write: null,
					last_write_lag: null,
					last_source: null,
					last_source_lag: null
				}
			},
			link_to: {
				parent: {},
				children: {}
			},
			logs: {
				errors: [],
				notices: []
			}
		};
	}

	function createQueue(queueId) {
		let ref = refUtil.ref(queueId, "queue");
		let owner = ref.owner();
		return {
			id: ref.refId(),
			type: 'queue',
			icon: ref.id.match(/^(commands|leo)\./) ? "icons/bus.png" : "queue.png",
			label: ref.id,
			latest_checkpoint: '',
			latest_write: 0,
			tags: '',
			queue: ref.asQueue().refId(),
			owner: owner && owner.refId(),
			bots: {
				read: {
					count: 0,
					events: 0,
					last_read: null,
					last_read_lag: null,
					last_source: null,
					last_source_lag: null
				},
				write: {
					count: 0,
					events: 0,
					last_write: null,
					last_write_lag: null,
					last_source: null,
					last_source_lag: null
				}
			},
			link_to: {
				parent: {},
				children: {}
			},
			logs: {
				errors: [],
				notices: []
			}
		};
	}

	function createBot(botId) {
		let ref = refUtil.ref(botId, "bot");
		return {
			id: ref.refId(),
			type: 'bot',
			status: 'running',
			rogue: false,
			label: ref.id,
			executions: 0,
			errors: 0,
			system: null,
			isAlarmed: false,
			readCaughtUp: false,
			alarms: {},
			source: false,
			last_run: {
				start: null,
				end: null
			},
			expect: {
				write_lag: 1000 * 60 * 1438560,
				source_lag: 1000 * 60 * 2.5,
				error_limit: .5,
				consecutive_errors: 2
			},
			templateId: "Custom",
			subqueues: [],
			queue: ref.asQueue().refId(),
			queues: {
				read: {
					count: 0,
					events: 0,
					last_read: null,
					last_read_lag: null,
					last_source: null,
					last_source_lag: null
				},
				write: {
					count: 0,
					events: 0,
					last_write: null,
					last_write_lag: null,
					last_source: null,
					last_source_lag: null
				}
			},
			duration: {
				min: 0,
				max: 0,
				total: 0,
				avg: 0
			},
			link_to: {
				parent: {},
				children: {}
			},
			logs: {
				errors: [],
				notices: []
			}
		};
	}

	function systemsProcessor(done) {
		parallelScan({
			TableName: SYSTEM_TABLE,
			"ReturnConsumedCapacity": 'TOTAL'
		}, {
			method: "scan",
			mb: 1,
		}, systemSegments).then((data) => {
			var systems = {};
			data.Items.map(system => {
				let s = createSystem(system.id);
				s.label = system.label || system.id;
				s.icon = system.icon;
				s.crons = system.crons;
				systems[s.id] = Object.assign(system, s)
			});
			done(null, systems);
		}).catch(done);
	}

	function queuesProcessor(done) {
		// console.time("QUEUES QUERY");
		parallelScan({
			TableName: EVENT_TABLE,
			"ReturnConsumedCapacity": 'TOTAL'
		}, {
			method: "scan",
			mb: 100
		}, queueSegments).then((data) => {
		// console.timeEnd("QUEUES QUERY");
				// console.log(`QUEUES QUERY ${JSON.stringify(data._stats)}`);
			var queues = {};
			data.Items.map(queue => {
				let q = createQueue(queue.event);
				if (!(q.id.match(/\/_archive$/g) || q.id.match(/\/_snapshot$/g))) {
					q.label = queue.name || q.label;
					q.tags = queue.other && queue.tags || '';
					q.archived = queue.archived;
					q.owner = queue.owner || q.owner;
					queues[q.id] = q;
				}
			});
			done(null, queues);
		}).catch(done);
	}

	function botsProcessor(done) {
		parallelScan({
			TableName: CRON_TABLE,
			"ReturnConsumedCapacity": 'TOTAL'
		}, {
			method: "scan",
			mb: 100
		}, botSegments).then((data) => {
			var bots = {};
			data.Items.map(bot => {
				let b = createBot(bot.id);
				let errorCount = bot.errorCount ? bot.errorCount : 0;

				//cronResults[cron.id] = cron;
				b.checksum = !!bot.checksum;
				b.label = bot.name || bot.description || bot.id;
				if (bot.invokeTime) {
					b.last_run = {
						start: bot.invokeTime
					};
				}
				if (bot.archived) {
					b.status = "archived";
				} else if (bot.paused) {
					b.status = "paused";
				}
				if (errorCount > 10) {
					b.rogue = true;
				}
				b.readCaughtUp = bot.readCaughtUp;

				if (bot.time) {
					let sched = later.parse.cron(bot.time, true);
					let prev = later.schedule(sched).prev(5);
					let diff = [];

					prev.map(a => a.valueOf()).reduce((a, b) => {
						diff.push(a - b);
						return b;
					});
					let total = diff.reduce((a, b) => a + b);
					b.expect.write_lag = moment.duration({ milliseconds: b.expect.write_lag }).add({ milliseconds: total / diff.length }).asMilliseconds();
				} else if (bot.triggers && bot.triggers[0] !== undefined) {
					let checkArr = [];
					_.forEach(bot.triggers, (trigger) => {
						let requested_kinesis = (bot.requested_kinesis && bot.requested_kinesis[trigger]) ? bot.requested_kinesis[trigger] : null;
						let read_checkpoint = (bot.checkpoints && bot.checkpoints.read && bot.checkpoints.read[trigger] && bot.checkpoints.read[trigger].checkpoint) ? bot.checkpoints.read[trigger].checkpoint : null;
						if ((read_checkpoint !== undefined && requested_kinesis !== undefined) && (read_checkpoint >= requested_kinesis)) {
							checkArr.push(true);
						} else {
							checkArr.push(false);
						}
					});
					// See if trigger bot is behind on any queue
					let temp = true;
					_.forEach(checkArr, (bool) => {
						if (bool === false) {
							temp = false;
						}
					});
					b.readCaughtUp = temp;
				}

				b.owner = bot.owner;
				b.archived = bot.archived || false;
				b.tags = bot.tags || b.tags;
				b.frequency = bot.time;
				b.triggers = bot.triggers || [];
				b.health = bot.health || {};
				b.message = bot.message;
				b.name = bot.name || '';
				b.templateId = bot.templateId || b.templateId;
				b.isAlarmed = bot.isAlarmed;
				b.alarms = bot.alarms;
				b.expect = bot.expect || b.expect;
				b.description = bot.description;
				b.source = (bot.lambda && bot.lambda.settings && bot.lambda.settings[0] && bot.lambda.settings[0].source) || false;
				b.expect.consecutive_errors = (bot.health && bot.health.consecutive_errors) || b.expect.consecutive_errors;
				if (bot.checkpoints) {
					["read", "write"].forEach(type => {
						if (!bot.checkpoints[type]) {
							return;
						}
						Object.keys(bot.checkpoints[type]).forEach((event) => {
							if (event === 'undefined') {
								return
							}

							var queueRef = refUtil.ref(event);

							if (queueRef.refId().match(/^queue:commands\./) && type == "write") {
								return;
							}

							var data = bot.checkpoints[type][event];
							var d = {
								id: b.id,
								type: type,
								units: 0,
								[`last_${type}`]: data.ended_timestamp,
								last_event_source_timestamp: data.source_timestamp,
								checkpoint: data.checkpoint
							}
							let relation = type === "write" ? "children" : "parent"
							if (!(queueRef.refId().match(/\/_archive$/g) || queueRef.refId().match(/\/_snapshot$/g))) {
								b.link_to[relation][queueRef.refId()] = d;
							}
						});
					});
				}

				if (bot.instances) {
					for (var i in bot.instances) {
						var instance = bot.instances[i];
						if (instance.log) {
							if (instance.status == "error") {
								b.logs.errors.push(JSON.parse(zlib.gunzipSync(instance.log)));
							} else {
								b.logs.notices.push(JSON.parse(zlib.gunzipSync(instance.log)));
							}
						}
					}
				}
				if (includeRawBotData) {
					b.raw = bot
				}

				bots[b.id] = b;

				try {
					let source = (bot.lambda && bot.lambda.settings && bot.lambda.settings[0] && bot.lambda.settings[0].source);
					b.kinesis_number = (bot.checkpoints && bot.checkpoints.read && bot.checkpoints.read[source] && bot.checkpoints.read[source].checkpoint);
					if (!b.kinesis_number) {
						b.kinesis_number = Object.keys(bot.checkpoints && bot.checkpoints.read || {}).map(x => bot.checkpoints.read[x].checkpoint).filter(c => !!c && c !== 'undefined' && c !== 'queue:undefined').sort()[0] || "";
					}
				} catch (err) {
					b.kinesis_number = "";
				}
				b.system = bot.system && bot.system.id ? bot.system.id : undefined;
			});


			done(null, bots);
		}).catch(done);
	}


	function parallelScan(query, opts, segments) {

		let requests = [];
		for (let i = 0; i < segments; i++) {
			requests.push(dynamodb.query(Object.assign({}, query, {
				TotalSegments: segments,
				Segment: i
			}), opts));
		}

		return Promise.all(requests).then( data => {
			let response = data.reduce((all, one) => {
				all.Items = all.Items.concat(one.Items);
				all.ScannedCount += one.ScannedCount;
				all.Count += one.Count;
				all._stats.mb += one._stats.mb;
				all._stats.count += one._stats.count;
				
				return all;
			}, {
				Items: [], 
				ScannedCount: 0,
				Count: 0,
				_stats: {
					mb: 0,
					count: 0
				}
			});
			return response;
		})
	}

	function parallelQuery(queries, opts, mergeFn) {
		// We need at least one query
		if (queries.length < 1) {
			
			return mergeFn(
				{
					Items: [], 
					ScannedCount: 0,
					Count: 0,
					_stats: {
						mb: 0,
						count: 0
					}
				}
				
			);
		};
		
		let requests = [];
		for (const [index, query] of queries.entries()) {
			let key = JSON.stringify(query.ExpressionAttributeValues);
			let end = query.ExpressionAttributeValues[":end"];

			//
			let isBucketClosed = (end < Date.now() - (1000 * 60 * 2 ));
			// console.log(`cache key => ${key} cache or request: ${statsCache[key] && isBucketClosed}, ${index}, ${queries.length}`);
			// Cache buckets that aren't expected to change and fetch buckets that will change (closer to now)
			if (statsCache[key] && isBucketClosed) {
				statsCache[key].lastFetched = Date.now();
				requests.push(Promise.resolve(statsCache[key]))
			} else {
				requests.push(dynamodb.query(query, opts).then(data => {
					// Cache anything that is available
					statsCache[key] = data;
					data.lastFetched = Date.now();
				
					return data
				}));
			}
		}


		return Promise.all(requests)
		.then(data => {
			let response = data.reduce((all, one) => {
				all.Items = all.Items.concat(one.Items);
				// all.ScannedCount += one.ScannedCount;
				// all.Count += one.Count;
				// all._stats.mb += one._stats.mb;
				// all._stats.count += one._stats.count;
				
				return all;
			}, {
				Items: [], 
				ScannedCount: 0,
				Count: 0,
				_stats: {
					mb: 0,
					count: 0
				}
			});
			return mergeFn(response);
		}).finally(()=>{
			// Purge old cache entries
			let count = 0;
			Object.entries(statsCache).forEach(([key, value]) => {
				// If the entry hasn't been fetched in 2 minutes, PURGE BABY
				if (value.lastFetched < Date.now() - (1000 * 60 * 2)) {
					delete statsCache[key]
				} else {
					count++;
				}
			});

			if (count > 50) {
				// sort the cache ascending order by lastFetched
				let sortedCache = Object.entries(statsCache).sort(([,a], [,b]) => a.lastFetched - b.lastFetched);
				// slice off any entries > 50 in length and delete from the cache
				sortedCache.slice(0,(sortedCache.length - 50)).forEach(([key]) => delete statsCache[key])
			}

			// console.log(Object.keys(statsCache));
			
		});


	}

	function splitTime(start, end) {
		if (!start || !end) {
			return [];
		};

		// console.log(`START: ${bucketUtils.value(moment(start)).format()}, END: ${bucketUtils.value(moment(end)).format()}`);
	
		let times = [];

		let current = start;

		// `minute_15` is going to do 15 one minute buckets, `hour` is going to do 4 `minute_15` buckets, 6 hour buckets for `hour_6` 
		// and for `day` we get 24 `hour` buckets. So the assumption is we will never need more than 30 buckets of data
		for (let index = 0; index < 30; index++) {
			let next = bucketUtils.next(current);
			times.push({start: current.valueOf(), end: next.valueOf()});
			current = next;
			// console.log(`CURRENT = ${current.valueOf()}, ${current.format()}`);
			// If current is past the end OR if current is past Now, bail we don't need future stuff
			if(current > end || current.valueOf() > Date.now()) {
				break;
			}
		}
	
		return times
	}

	function mergeStatsResults(bucketsStats) {
		var out = {};

		var executionDefaults = {
			completions: 0,
			duration: 0,
			max_duration: 0,
			min_duration: 0,
			errors: 0,
			units: 0,
		};
		var defaults = {
			checkpoint: 0,
			source_timestamp: 0,
			timestamp: 0,
			units: 0
		};
		bucketsStats.Items.map(stat => {

			// If we don't have the id in out create it and default it
			if (!(stat.id in out)) {
				out[stat.id] = {
					execution: Object.assign({}, executionDefaults),
					read: {},
					write: {},
				}
			}
			var node = out[stat.id];

			// If stat.current.execution is available merge that into node (which is a reference to out[stat.id])
			if (stat.current.execution) {
				node.execution = mergeExecutionStats(node.execution, stat.current.execution);
			}

			["read", "write"].map(type => {
				Object.keys(stat.current[type] || {}).map(key => {
					// if stat.current.read or stat.current.write doesn't exist in node default it
					if (!(key in node[type])) {
						node[type][key] = Object.assign({}, defaults);
					}
					// merge 'read' and 'write' stats into node
					node[type][key] = mergeStats(node[type][key], stat.current[type][key]);
				})
			});
		});

		return out;
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


	// Currently not used because it is surprisingly slow
	function promiseAllConcurrency(queue, concurrency) {
		if (concurrency == null) {
			concurrency = queue.length;
		}

		let startTime = Date.now();

		let index = 0;
		const results= [];

		let complete = 0;
		// Run a pseudo-thread
		const execThread = () => {
			if (index < queue.length) {
				const curIndex = index++;

				return queue[curIndex]().then((data) => {
					results[curIndex] = data;
					complete++;
					return execThread();
				});
			}

			return Promise.resolve();

		};

		// Start threads
		const threads = [];
		for (let thread = 0; thread < concurrency; thread++) {
			threads.push(execThread());
		}
		return Promise.all(threads).then(() => results);
	}

};
