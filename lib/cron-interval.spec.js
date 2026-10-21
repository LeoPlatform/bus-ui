"use strict";
const assert = require("assert");
const averageCronInterval = require("./cron-interval.js");

describe("averageCronInterval", function() {
	it("returns the average gap for a 6-field leo cron", function() {
		assert.strictEqual(averageCronInterval("0 * * * * *"), 60000);
		assert.strictEqual(averageCronInterval("0 */5 * * * *"), 300000);
	});

	it("returns null for a 5-field cron", function() {
		assert.strictEqual(averageCronInterval("* * * * *"), null);
	});

	it("reads an unrecognized expression as later's every-second default", function() {
		assert.strictEqual(averageCronInterval("garbage"), 1000);
	});
});
