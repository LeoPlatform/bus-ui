"use strict";

let moment = require("moment");
require("moment-round");
let stats = require("../../lib/stats.js");
let leo = require("leo-sdk");
let refutil = require("leo-sdk/lib/reference.js");
let aws = require("aws-sdk");
let dynamodb = leo.aws.dynamodb;
let _ = require("lodash");
let async = require("async");
let configure = leo.configuration;

let CRON_TABLE = leo.configuration.resources.LeoCron;
let SETTINGS_SNS = "healthSNS_data";
let SNS_TOPIC = [require("leo-config").Resources.SnsTopic] || [""];
let DOMAIN_URL = require("leo-config").Resources.DomainUrl || "";

exports.handler = require("leo-sdk/wrappers/cron")(async (event, context, callback) => {
	dynamodb.query({
		TableName: CRON_TABLE,
		ProjectionExpression: "id, health",
	}, {
		method: "scan"
	}).then(function (data) {
		let ts = moment();
		let overrides = data.Items;

		stats({
			"body": {},
			"params": {
				"path": {},
				"querystring": {
					timestamp: moment().format(),
					range: "minute",
					count: 15
				},
				"header": {}
			}
		}, (err, stats) => {
			getAlarmedBots(stats, (err, alarmed) => {
				getLatest((err, lastReport) => {

					if (err || !lastReport) {
						lastReport = {};
					}
					let runs = lastReport.value && lastReport.value.runs ? lastReport.value.runs+1 : 1;
					let lastSns = lastReport.value && lastReport.value.lastSNS ? lastReport.value.lastSNS : null;
					let tempLastSNS = lastSns;
					let oldList = lastReport.value && lastReport.value.botIds ? lastReport.value.botIds : {};
                    let oldSuccess = lastReport.value && lastReport.value.success ? lastReport.value.success : {};
                    let tagsObj = (lastReport.value && lastReport.value.tags) || {};
					let newReportBots = {};
					let newSuccess = {};
					let recovering = [];
					let CONSECUTIVE_DEFAULT = 3;
                    let all_Topics = Object.assign({},tagsObj,{"___default": SNS_TOPIC});
                    let all_Messages = all_Topics;
                    _.mapKeys(all_Topics , (value, key) => {
                    	let arn = all_Topics[key];
                        all_Messages[key] = {};
                        _.extend(all_Messages[key], {'arn':arn, 'message': '', 'message2': '', 'finalMessage': '', 'newAlarmed': false});
                    });

					let timeout = {
						minutes: 20
					};
					if (!lastSns || moment(lastSns).add(timeout) < ts) {
						lastSns = ts.valueOf();
					}
					let statsNodes = stats.stats.nodes['bot'];
					let overridesObj = {};
					overrides.map(k => overridesObj[refutil.botRefId(k.id)] = Object.assign({
						health: {}
					}, k));

                    Object.keys(statsNodes).map((id) => {
                        if (id in oldSuccess && alarmed.indexOf(id) === -1) {
                            newSuccess[id] = oldSuccess[id] + 1;
                        }
                        else if (alarmed.indexOf(id) === -1){
                            newSuccess[id] = 1;
                        } else {
                        	newSuccess[id] = 0;
						}
                        if (newSuccess[id] != undefined && oldSuccess[id] != undefined && oldSuccess[id] < CONSECUTIVE_DEFAULT && alarmed.indexOf(id) === -1) {
                        	alarmed.push(id);
                        	recovering.push(id);
						}
					});

					alarmed.forEach(k => {
                        let skipOnReport = false;
                        let node = statsNodes[k];
                        let tagsArray = (node.tags && node.tags.split(',')) || [];
                        let consecutive_errors = ((node.expect && node.expect.consecutive_errors) && (typeof node.expect.consecutive_errors === 'number')) ? node.expect.consecutive_errors : CONSECUTIVE_DEFAULT;
                        let alarmKeys;
                        if (recovering.indexOf(node.id) === -1 && node.alarms) {
							alarmKeys = Object.keys(node.alarms);
                        }
                        if (node.id in oldList) {
                            newReportBots[node.id] = oldList[node.id] + 1;
                        } else {
                            newReportBots[node.id] = 1;
                        }
						if (overridesObj && overridesObj[k] && overridesObj[k].health && overridesObj[k].health.mute && overridesObj[k].health.mute !== false) {

                        	if (overridesObj[k].health.mute === true) {
                        		skipOnReport = true;
                        	} else {
                        		let timeStamp = overridesObj[k].health.mute;
                        		if (timeStamp >= moment.now()) {
                        			skipOnReport = true;
                        		}
                        	}
                        }
						_.mapKeys(all_Topics , (value, key) => {
                            if (!skipOnReport && (key === '___default' || tagsArray.indexOf(key) > -1)) {
                            	if (recovering.indexOf(node.id) !== -1) {
                                    all_Messages[key].message += `\nBot Name -     ${node.name || 'N/A'}
Bot Id -            ${node.id}\n`;
                                    if (node.owner === 'leo') {
                                        all_Messages[key].message += `Owner -          Leo Owned\n`
                                    }

                                    // display bot status
									all_Messages[key].message += `Bot Status:      Recovering\n`;
								} else if (newReportBots[node.id] > (consecutive_errors-1) && newReportBots[node.id] !== consecutive_errors) {
										all_Messages[key].message += `\nBot Name -     ${node.name || 'N/A'}
Bot Id -            ${node.id}\n`;
										if (node.owner === 'leo') {
                                            all_Messages[key].message += `Owner -          Leo Owned\n`
										}

										// display bot status
										if (node.rogue) {
											all_Messages[key].message += `Bot Status:      Rogue\n`;
										}

										alarmKeys.forEach((alarm) => {
                                            all_Messages[key].message += (alarm.replace(/,/, '') + ' -          ').slice(0, 17) + node.alarms[alarm].msg + '\n'
										})
								} else if (newReportBots[node.id] > (consecutive_errors-1) && newReportBots[node.id] === consecutive_errors){
									all_Messages[key].newAlarmed = true;
                                    all_Messages[key].message2 += '\nNEW ALARMED BOT';
                                    all_Messages[key].message2 += `\nBot Name -     ${node.name}
Bot Id -            ${node.id}\n`;
									if (node.owner === 'leo') {
                                        all_Messages[key].message2 += `Owner -          Leo Owned\n`
									}

									// display bot status
									if (node.rogue) {
										all_Messages[key].message += `Bot Status:      Rogue\n`;
									}

									alarmKeys.forEach((alarm) => {
                                        all_Messages[key].message2 += (alarm.replace(/,/, '') + ' -          ').slice(0, 17) + node.alarms[alarm].msg + '\n'
									})
								}
							}
						});
                    });

                    _.mapKeys(all_Topics , (value, key) => {
                        all_Messages[key].finalMessage = all_Messages[key].message2 + all_Messages[key].message;
                    });

					let newBotOnList = false;
					_.map(newReportBots, (value, id) => {
						let skipOnReport = false;
                        if (overridesObj[id].health.mute === true) {
                            skipOnReport = true;
                        } else {
                            let timeStamp = overridesObj[id].health.mute;
                            if (timeStamp >= moment.now()) {
                                skipOnReport = true;
                            }
                        }
						let consecutive = (statsNodes[id] && statsNodes[id].health && statsNodes[id].health.consecutive_errors) || CONSECUTIVE_DEFAULT;
                        if (newReportBots[id] === consecutive && !skipOnReport) {
							newBotOnList = true;
						}
					});

                    let sentEmail = false;
                    let count = 0;
                    async.forEachOf(all_Topics, (obj, key, callback) => {
                    	count++;
                        if (runs > CONSECUTIVE_DEFAULT && ((obj.finalMessage !== '') && (lastSns === ts.valueOf()) || (newBotOnList && obj.newAlarmed))) {
                            let reportTitle = "Bot Health Report:\n";
                            let tagName = '';
                            if (key !== '___default') {
                            	tagName = `This email is from the ${key} subscription\n`
							}
                            let dashboardClick = "If you would like to mute a bot or see your dashboard click or visit the link below:\n";
                            obj.finalMessage = dashboardClick + encodeURI(DOMAIN_URL) + '\n\n\n' + reportTitle + tagName + obj.finalMessage + "\n\n";
                            lastSns = ts.valueOf();
                            sentEmail = true;
							if (Array.isArray(obj.arn) && obj.arn.length>0) {
                                for (let i = 0; i < obj.arn.length; i++) {
                                    sendSNS(obj.arn[i], obj.finalMessage, "Leo Health Report")
                                }
							}
                        }
                        callback()
                    });

 					dynamodb.saveSetting(SETTINGS_SNS, {
						lastSNS: sentEmail ? lastSns : tempLastSNS,
						botIds: newReportBots,
						success: newSuccess,
						tags: tagsObj,
                        runs: runs
					}, function() {
						callback();
					})
                });
			});
        });
	}).catch(callback);

});

function getAlarmedBots(data, callback) {
	let bots = Object.keys(data && data.stats && data.stats.nodes && data.stats.nodes['bot'] ? data.stats.nodes['bot'] : {});
	let botInfo = data && data.stats && data.stats.nodes && data.stats.nodes['bot'] ? data.stats.nodes['bot'] : {};
	let alarmedBots = [];

	_.map(bots, (bot) => {
		if (botInfo[bot].isAlarmed === true) {
			alarmedBots.push(botInfo[bot].id)
		}
	});
	callback(null, alarmedBots);
}

function getLatest(callback) {
	dynamodb.getSetting(SETTINGS_SNS, function (err, data) {
		if (err) {
			console.log(err)
			callback(err);
		} else {
			if (!data || !data.value || !data.value.table) {
				callback(null, data)
			}
		}
	});
}

function sendSNS(topic, message, subject) {
	console.log(`Sending SNS to Topic:${topic}  Message:${message}`);
	return new Promise((resolve, reject) => {
		let sns = new aws.SNS({
			params: {
				TopicArn: topic,
				Subject: subject
			},
			region: configure.aws.region
		});
		sns.publish({
			Message: message
		}, function (err, data) {
			console.log(err, data);
			if (err) {
				reject(err);
			} else {
				resolve(data)
			}
		});

	});
}