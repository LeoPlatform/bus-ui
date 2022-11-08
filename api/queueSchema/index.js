"use strict";
let request = require("leo-auth");
let leo = require("leo-sdk");
let ls = leo.streams;
let util = require("leo-sdk/lib/reference.js");

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {

	let queue = util.ref(event.params.path.queue).asQueue(event.params.path.subqueue).id;

	await request.authorize(event, {
		lrn: 'lrn:leo:botmon:::',
		action: "getSchema"
	});
	let response = {};
	let error;
	try {
		let data = await leo.aws.s3.getObject({
			Bucket: leo.configuration.resources.LeoS3,
			Key: `files/bus_internal/queue_schemas/${queue}.json`
		}).promise();
		response = JSON.parse(data.Body.toString());
	} catch (err) {
		if (err.code !== "NoSuchKey") {
			error = new Error(`Unable to get schema for: ${queue}`);
		}
	}

	callback(error, response)
});
