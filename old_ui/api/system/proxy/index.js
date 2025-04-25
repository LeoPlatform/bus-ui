"use strict";
var configure = require("leo-sdk/leoConfigure.js");

var aws = require("aws-sdk");
var lambda = new aws.Lambda({
	// region: region
});
var proxies = [{
	match: /^csv\/upload/,
	file: "systems/csv/api/upload/index.js",
	lambda_function: 'Leo_csv_api_upload',
	event: {

	}
}];

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
	var proxy = proxies[0];

	if (configure._meta.env == "local") {
        var file = require("leo-sdk/" + proxy.file);
        file.handler(event, context, callback);
    }
});