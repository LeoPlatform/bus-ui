"use strict";
const assert = require("assert");
const averageCronInterval = require("./cron-interval.js");

describe("averageCronInterval", function() {
	it("returns the average gap for a 6-field leo cron", function() {
		assert.strictEqual(averageCronInterval("0 * * * * *"), 60000);
		assert.strictEqual(averageCronInterval("0 */5 * * * *"), 300000);
	});

	it("throws on a 5-field cron so callers can skip the bot", function() {
		assert.throws(() => averageCronInterval("* * * * *"));
	});

	it("does not throw on an unrecognized expression", function() {
		assert.doesNotThrow(() => averageCronInterval("garbage"));
	});
});
