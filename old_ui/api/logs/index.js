"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");

var moment = require("moment");
var aws = require('aws-sdk');
var async = require("async");

let leoConfigRegion = require("leo-config").Resources.Region;

var cloudwatchlogs = new aws.CloudWatchLogs({
	region: leoConfigRegion
});

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var limit = 50;
	var lambda = event.params.path.lambda;
	var bot_id = util.ref(event.params.path.id, "bot").id;

	var matchParts;
	if (lambda && (matchParts = lambda.match(/^arn:aws:lambda:(.*?):[0-9]+:function:(.*)$/))) {
		lambda = matchParts[2];
		var region = matchParts[1];
		if (region !== leoConfigRegion) {
			cloudwatchlogs = new aws.CloudWatchLogs({
				region: region
			});
		}
	}
	var start = moment().subtract(10, "m").valueOf();
	if (event.params.querystring.start) {
		start = moment(parseInt(event.params.querystring.start)).valueOf();
	}
	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::',
		action: "logs",
		botmon: {}
	});
	var starts = [];
	var nextToken = null;
	var hasTime = true;

	var timeout = setTimeout(function() {
		hasTime = false;
	}, context.getRemainingTimeInMillis() * 0.8);
	if (event.params.querystring.stream) {
		requestLogs(lambda, event.params.querystring, (err, details) => {
			clearTimeout(timeout);
			callback(err, details);
		});
	} else {
		async.doWhilst((done) => {
			var pattern = "";
			var splitPattern = new RegExp("\t");
			if (bot_id === "all") {
				pattern = `"START"`;
				splitPattern = new RegExp("RequestId: *(.*?) Version")
			} else {
				pattern = `"[LEOCRON]:start:${bot_id}"`
			}
			cloudwatchlogs.filterLogEvents({
				logGroupName: '/aws/lambda/' + lambda,
				interleaved: false,
				limit: limit,
				startTime: start,
				filterPattern: pattern,
				nextToken: nextToken
			}, function(err, data) {
				if (err && err.code === "ResourceNotFoundException") {
					err = null;
					data = { events: [] }
				}
				if (err) {
					return done(err);
				}
				if (data.nextToken && starts.length < limit) {
					nextToken = data.nextToken;
				} else {
					nextToken = null;
				}
				data.events.map((e) => {
					starts.push({
						timestamp: e.timestamp,
						stream: e.logStreamName,
						requestId: e.message.split(splitPattern)[1],
						endtimestamp: moment.now()
					});
				});
				done();
			});
		}, () => {
			return hasTime && nextToken !== null;
		}, (err) => {

			starts = starts.sort((a, b) => {
				return b.timestamp - a.timestamp;
			});
			if (starts.length) {
				requestLogs(lambda, starts[0], (err, details) => {
					starts[0].details = details;
					clearTimeout(timeout);
					callback(err, starts);
				});
			} else {
				clearTimeout(timeout);
				callback(err, starts);
			}
		});
	}
});

function requestLogs(lambda, start, callback) {
	cloudwatchlogs.filterLogEvents({
		logGroupName: '/aws/lambda/' + lambda,
		interleaved: false,
		logStreamNames: [start.stream],
		limit: 1000,
		startTime: start.timestamp,
		filterPattern: `"${start.requestId}"`,
		nextToken: start.nextToken
	}, function(err, data) {
		var logs = [];
		var stats = {
			dynamodb: {
				read: 0,
				write: 0,
				events: []
			}
		};

		let regex = new RegExp(`^\\d{4}-\\d{2}-\\d{2}T.*?\\t${start.requestId}\\t`);
		data && data.events.map((e) => {
			if (e.message.match(/\[LEOLOG/)) {
				var stat = parseLeoLog(null, e);
				if (stat.event.match(/^dynamodb/)) {
					if (stat.event.match(/update|write/i)) {
						stats.dynamodb.write += stat.consumption;
					} else {
						stats.dynamodb.read += stat.consumption;
					}
					stats.dynamodb.events.push(stat);
				}
			} else if (e.message.match(/\[LEOCRON/)) {

			} else if (e.message.match(new RegExp(`\\s${start.requestId}`))) {
				let msg = e.message;
				if (e.message.match(regex)) {
					msg = e.message.split(/\t/).slice(2).join("\t")
				}
				logs.push({
					timestamp: e.timestamp,
					message: msg
				});
			}
		});
		callback(err, {
			logs,
			stats,
			nextToken: data.nextToken
		});
	});

}

function safeNumber(number) {
	if (isNaN(number) || !number) {
		return 0;
	} else {
		return number;
	}
}

function parseLeoLog(bot, e) {
	var data = e.message.trim().replace(/^.*\[LEOLOG\]:/, '').split(/:/);
	var version = safeNumber(parseInt(data[0].replace("v", "")))
	return (versionHandler[version] || versionHandler["1"])(bot, e, data);
}

var versionHandler = {
	"1": function(bot, e, data) {
		return {
			id: bot,
			version: safeNumber(parseInt(data[0].replace("v", ""))),
			runs: safeNumber(parseInt(data[1])),
			completions: 1,
			start: safeNumber(parseInt(data[2])),
			end: safeNumber(parseInt(data[3])),
			units: safeNumber(parseInt(data[4])),
			duration: safeNumber(parseInt(data[5])),
			min_duration: safeNumber(parseInt(data[6])),
			max_duration: safeNumber(parseInt(data[7])),
			consumption: safeNumber(parseFloat(data[8])),
			errors: safeNumber(parseInt(data[9])),
			event: data.slice(10).join(":"),
			timestamp: e.timestamp
		};
	},
	"2": function(bot, e) {

		var log = JSON.parse(e.message.trim().replace(/^.*\[LEOLOG\]:v2:/, ''));
		log.e = log.e || {};
		var data = log.p;

		var obj = {
			id: log.e.key || bot,
			version: 2,
			runs: safeNumber(parseInt(data[0])),
			start: safeNumber(parseInt(data[1])),
			end: safeNumber(parseInt(data[2])),
			units: safeNumber(parseInt(data[3])),
			duration: safeNumber(parseInt(data[4])),
			min_duration: safeNumber(parseInt(data[5])),
			max_duration: safeNumber(parseInt(data[6])),
			consumption: safeNumber(parseFloat(data[7])),
			errors: safeNumber(parseInt(data[8])),
			event: data[9],
			completions: safeNumber(parseInt(data[10])),
			timestamp: log.e.s || safeNumber(parseInt(data[1])) || e.timestamp
		};

		delete log.e.key;
		obj.extra = log.e;
		return obj;
	}
}
