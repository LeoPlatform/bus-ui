"use strict";
var config = require("leo-sdk/leoConfigure.js");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = function (event, context, callback) {
	context.leouser.authorize(event, {
		lrn: 'lrn:leo:botmon:::csv/{queue}',
		action: "csvUpload",
		csv: {
			queue: 'test'
		}
	}, function (err) {
		if (err) {
			callback(err);
		} else {
			const url = s3.getSignedUrl('putObject', {
				Bucket: config.bus.s3,
				Key: "systems/csv/",
				Expires: 60
			});
			callback(null, url);
		}
	});
};