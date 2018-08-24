var leo = require("leo-sdk/lib/test");
var moment = require("moment");
var refUtil = require("leo-sdk/lib/reference.js");

describe("local", function () {
	it("Should be able to read events from DynamoDB", function (done) {
		this.timeout(60000);
		leo.invoke.lambda.api(require("../index.js"), {
			"body": {},
			"params": {
				"path": {},
				"querystring": {
					timestamp: moment().format(),
					range: "hour",
					count: 6
				},
				"header": {}
			},
			"stage-variables": {},
			"context": {
				"account-id": "842137980019",
				"api-id": "78f9ltyjx3",
				"api-key": "test-invoke-api-key",
				"authorizer-principal-id": "",
				"caller": "AIDAJMDYKGLZNKNYYMS7Y",
				"cognito-authentication-provider": "",
				"cognito-authentication-type": "",
				"cognito-identity-id": "",
				"cognito-identity-pool-id": "",
				"http-method": "PUT",
				"stage": "test-invoke-stage",
				"source-ip": "192.168.1.13",
				"user": "AIDAJMDYKGLZNKNYYMS7Y",
				"user-agent": "Apache-HttpClient/4.3.4 (java 1.5)",
				"user-arn": "arn:aws:iam::842137980019:user/slyon",
				"request-id": "test-invoke-request",
				"resource-id": "1ivls4",
				"resource-path": "/settings/{client}/{id}"
			}
		}, function (err, data) {
			if (err) throw err;
			done();
		});
	});
});