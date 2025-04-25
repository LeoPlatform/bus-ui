let moment = require("moment");
let extend = require("extend")
let leo = require("leo-sdk");
let dynamodb = leo.aws.dynamodb;
var refUtil = require("leo-sdk/lib/reference.js");

var statsBuckets = require("../../lib/stats-buckets").data;
let STATS_TABLE = require("leo-config").Resources.LeoStats;

exports.handler = require("leo-sdk/wrappers/cron")(async (event, context, callback) => {
	leo.offload({
		debug: event.debug,
		id: event.botId,
		queue: event.source,
		batch: event.batch,
		loops: Number.POSITIVE_INFINITY,
		transform: (payload, event, done) => {
			go(payload, done);
		}
	}, (err) => {
		callback(err);
	});
});

var timeframes = {
	'hour': 'YYYY-MM-DD HH',
	'minute_15': 'YYYY-MM-DD HH:mm',
	'minute_1': 'YYYY-MM-DD HH:mm'
};

let groups = {
	"started": "execution",
	"completed": "execution",
	"read": "read",
	"write": "write"
}

function go(allEvents, callback) {
	let statsList = [];
	allEvents.map(e => {

		e.payload.id = refUtil.botRefId(e.payload.id);
		if (e.payload.to) {
			e.payload.queue = refUtil.refId(e.payload.to);
			delete e.payload.to;
		}
		if (e.payload.from) {
			e.payload.queue = refUtil.refId(e.payload.from);
			delete e.payload.from;
		}

		statsList.push(Object.assign({}, e.payload, {
			includePeriod: true,
			eid: e.eid
		}));

		if (e.payload.type === "read" || e.payload.type == "write") {
			// Stats with Event as id
			statsList.push(Object.assign({}, e.payload, {
				id: e.payload.queue,
				queue: e.payload.id,
				eid: e.eid
			}));
		}
	});
	var startEid = allEvents[0].eid;
	console.log("Last timestamp is ", moment().format("YYYY-MM-DD HH:mm:ss"));
	var stats = {};
	var keys = [];
	for (var i = 0; i < statsList.length; i++) {
		var stat = statsList[i];
		var time = moment(stat.start);
		for (var timeframe in timeframes) {
			var bucket = statsBuckets[timeframe].transform(time.clone());
			keys.push({
				bucket: bucket,
				id: stat.id
			});
			stats[bucket] = {};
		}
	}
	dynamodb.batchGetTable(STATS_TABLE, keys, function(err, records) {
		for (var i = 0; i < records.length; i++) {
			var r = records[i];
			if (r.start_eid == startEid) { //Then we need to undo the last update, because we are redoing it
				stats[r.bucket][r.id] = Object.assign(r, {
					current: r.previous
				});
			} else {
				stats[r.bucket][r.id] = r;
			}

			stats[r.bucket][r.id].previous = extend(true, {}, r.current) || {};
		}
		statsList.forEach((r) => {
			var time = moment(r.start);
			for (var timeframe in timeframes) {
				var bucket = statsBuckets[timeframe].transform(time.clone());
				if (!(r.id in stats[bucket])) {
					stats[bucket][r.id] = {
						bucket: bucket,
						id: r.id,
						current: {
							read: {},
							write: {}
						},
						previous: {},
						time: statsBuckets[timeframe].value(time.clone()).valueOf(),
						period: r.includePeriod ? statsBuckets[timeframe].period : undefined
					}
				}

				let group = groups[r.type];
				var s = getObject(stats[bucket][r.id].current, [group, r.queue]);
				if (group == "execution") {
					if (r.type == "completed") {
						s.completions = sum(s.completions, 1);
						let duration = safeNumber(parseInt(r.ts)) - safeNumber(parseInt(r.start));
						s.duration = sum(safeNumber(parseInt(s.duration)), duration);
						s.max_duration = max(s.max_duration, duration);
						if (duration > 0) {
							s.min_duration = min(s.min_duration, duration);
						} else {
							s.min_duration = s.min_duration;
						}
						s.errors = sum(s.errors, r.is_error ? 1 : 0);
					} else {
						s.units = sum(s.units, 1);
					}
				} else {
					s.checkpoint = r.checkpoint || s.checkpoint;
					s.source_timestamp = r.source_ts || s.source_timestamp;
					s.timestamp = r.ts || s.timestamp;
					s.units = sum(s.units, r.units);
				}

				stats[bucket][r.id].modified = true;
			}
		});
		var batchWrite = dynamodb.createTableWriteStream(STATS_TABLE, {
			concurrency: 10,
			retry: 10,
			retryDelay: 1500,
			record_size: 30000
		});

		for (var bucket in stats) {
			for (var id in stats[bucket]) {
				var obj = stats[bucket][id];
				if (obj.modified) {
					delete obj.modified;
					obj.start_eid = startEid;
					batchWrite.put(obj);
				}
			}
		}

		batchWrite.end(function(err) {
			if (err) {
				console.log(err);
				callback(err);
			} else {
				console.log("success");
				callback(null, "Successfully wrote statistics");
			}

		});
	});
}

function getObject(obj, path) {
	return path.reduce((parent, field) => {
		if (typeof field === "undefined") {
			return parent;
		}
		return parent[field] = parent[field] || {};
	}, obj || {});

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
