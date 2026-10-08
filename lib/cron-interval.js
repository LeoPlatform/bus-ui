"use strict";
let later = require("later");

module.exports = function averageCronInterval(expression) {
	let prev = later.schedule(later.parse.cron(expression, true)).prev(5);
	if (!Array.isArray(prev) || prev.length < 2) {
		return null;
	}
	let diff = [];
	prev.map(a => a.valueOf()).reduce((a, b) => {
		diff.push(a - b);
		return b;
	});
	return diff.reduce((a, b) => a + b) / diff.length;
};
