"use strict";
var request = require("leo-auth");
var leo = require("leo-sdk")
var dynamodb = leo.aws.dynamodb;
var util = require("leo-sdk/lib/reference.js");
let async = require("async");

var CRON_TABLE = leo.configuration.resources.LeoCron;
var SETTINGS_TABLE = leo.configuration.resources.LeoSettings;

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var ref = util.ref(event.params && event.params.path && event.params.path.id, "bot");
	dynamodb.batchGetHashkey(SETTINGS_TABLE, "id", ["lambda_templates", "botmon_files"], async function (err, settings) {
		if (err) {
			callback(err);
			return;
		}
		if (ref) {
			var id = ref.id;
			await request.authorize(event, {
				lrn: 'lrn:leo:botmon:::cron/{id}',
				action: "getCron",
				core: {
					id: id
				}
			});
			get(id, (err, data) => {
                if (data && !data.templateId) {
					data.templateId = "Leo_core_custom_lambda_bot";
				}
				if (data && settings.lambda_templates && Object.keys(settings.lambda_templates.value).indexOf(data.lambdaName) !== -1) {
					data.isTemplated = true;
				} else if (!!data) {
					data.isTemplated = false;
				}
				callback(err, data);
			});
		} else {
            await request.authorize(event, {
				lrn: 'lrn:leo:botmon:::cron',
				action: "listCron"
			});
			if (event.body && event.body.ids){
				async.parallelLimit(event.body.ids.map((id) => {
					return (done) => {
						get(util.botRef(id).id, done);
					}
				}),5,(err, results) => {
					callback(err,results);
				});
			} else {
				scan(callback);
			}
		}
	});
});

function scan(callback) {
	dynamodb.query({
		TableName: CRON_TABLE
	}, {
		method: "scan"
	}).then(function (data) {
		callback(null, data.Items.map(i => util.fixBotReferences(i)));
	}).catch(callback);
}

function get(id, callback) {
	dynamodb.get(CRON_TABLE, id, (err, item) => {
		if (err) {
			callback(err);
		} else {
			callback(null, util.fixBotReferences(item))
		}
	});
}