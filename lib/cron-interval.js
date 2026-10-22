"use strict";
let later = require("later");

module.exports = function averageCronInterval(expression) {
	let sched = later.parse.cron(expression, true);
	// later reports no parse error for a 5-field cron; it yields empty schedules that crash schedule().
	if (!sched.schedules.length || sched.schedules.every(s => Object.keys(s).length === 0)) {
		return null;
	}
	let prev = later.schedule(sched).prev(5);
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
