'use strict';

var moment = require("moment");

var bucketsData = {
	"minute_1": {
		period: "minute",
		prefix: "minute_",
		transform: function (timestamp) {
			return "minute_" + timestamp.clone().utc().startOf("minute").format("YYYY-MM-DD HH:mm");
		},
		value: function (timestamp) {
			return timestamp.clone().utc().startOf("minute");
		},
		prev: function (timestamp, amount) {
			return moment(timestamp).utc().subtract((amount || 1), "minutes");
		},
		next: function (timestamp, amount) {
			return moment(timestamp).utc().add((amount || 1), "minutes");
		},
		parent: "minute_5",
		duration: {
			m: 1
		},
		defaultContainer: "minute",
		defaultContainerInterval: 6 * 5
	},
	"minute_5": {
		period: "minute_5",
		prefix: "minute_5_",
		transform: function (timestamp) {
			var offset = (timestamp.utc().minute() + 5) % 5;
			return "minute_5_" + timestamp.clone().utc().subtract(offset, "minutes").startOf("minute").format("YYYY-MM-DD HH:mm");
		},
		value: function (timestamp) {
			var offset = (timestamp.utc().minute() + 5) % 5;
			return timestamp.clone().utc().subtract(offset, "minutes").startOf("minute");
		},
		prev: function (timestamp, amount) {
			return moment(timestamp).utc().subtract(5 * (amount || 1), "minutes");
		},
		next: function (timestamp, amount) {
			return moment(timestamp).utc().add(5 * (amount || 1), "minutes");
		},
		parent: "minute_15",
		duration: {
			m: 5
		},
		defaultContainer: "minute",
		defaultContainerInterval: 6 * 15
	},
	"minute_15": {
		period: "minute_15",
		prefix: "minute_15_",
		transform: function (timestamp) {
			var offset = (timestamp.utc().minute() + 15) % 15;
			return "minute_15_" + timestamp.clone().utc().subtract(offset, "minutes").startOf("minute").format("YYYY-MM-DD HH:mm");
		},
		value: function (timestamp) {
			var offset = (timestamp.utc().minute() + 15) % 15;
			return timestamp.clone().utc().subtract(offset, "minutes").startOf("minute");
		},
		prev: function (timestamp, amount) {
			return moment(timestamp).utc().subtract(15 * (amount || 1), "minutes");
		},
		next: function (timestamp, amount) {
			return moment(timestamp).utc().add(15 * (amount || 1), "minutes");
		},
		parent: "hour",
		duration: {
			m: 15
		},
		defaultContainer: "hour",
		defaultContainerInterval: 6
	},
	"hour": {
		period: "hour",
		prefix: "hour_",
		transform: function (timestamp) {
			return "hour_" + timestamp.clone().utc().startOf("hour").format("YYYY-MM-DD HH");
		},
		value: function (timestamp) {
			return timestamp.clone().utc().startOf("hour");
		},
		prev: function (timestamp, amount) {
			return moment(timestamp).utc().subtract((amount || 1), "hour");
		},
		next: function (timestamp, amount) {
			return moment(timestamp).utc().add((amount || 1), "hour");
		},
		parent: "day",
		duration: {
			h: 1
		},
		defaultContainer: "hour",
		defaultContainerInterval: 30
	},
	"day": {
		period: "day",
		prefix: "day_",
		transform: function (timestamp) {
			return "day_" + timestamp.clone().utc().startOf("day").format("YYYY-MM-DD");
		},
		value: function (timestamp) {
			return timestamp.clone().utc().startOf("day");
		},
		prev: function (timestamp, amount) {
			return moment(timestamp).utc().subtract((amount || 1), "day");
		},
		next: function (timestamp, amount) {
			return moment(timestamp).utc().add((amount || 1), "day");
		},
		parent: "week",
		duration: {
			d: 1
		},
		defaultContainer: "day",
		defaultContainerInterval: 30
	},
	"week": {
		period: "week",
		prefix: "week_",
		transform: function (timestamp) {
			return "week_" + timestamp.clone().utc().startOf("week").format("YYYY-MM-DD");
		},
		value: function (timestamp) {
			return timestamp.clone().utc().startOf("week");
		},
		prev: function (timestamp, amount) {
			return moment(timestamp).utc().subtract((amount || 1), "week");
		},
		next: function (timestamp, amount) {
			return moment(timestamp).utc().add((amount || 1), "week");
		},
		parent: null,
		duration: {
			w: 1
		},
		defaultContainer: "week",
		defaultContainerInterval: 30
	}
};

var ranges = {
	"minute": {
		period: "minute_1",
		count: 1,
		startOf: (timestamp) => timestamp.clone().startOf("minute")
	},
	"minute_1": {
		period: "minute_1",
		count: 1,
		startOf: (timestamp) => timestamp.clone().startOf("minute")
	},
	"minute_5": {
		period: "minute_1",
		count: 5,
		startOf: (timestamp) => {
			var offset = (timestamp.utc().minute() + 5) % 5;
			return timestamp.clone().subtract(offset, "minutes").startOf("minute");
		}
	},
	"minute_15": {
		period: "minute_1",
		count: 15,
		startOf: (timestamp) => {
			var offset = (timestamp.minute() + 15) % 15;
			return timestamp.clone().subtract(offset, "minutes").startOf("minute");
		}
	},
	"hour": {
		period: "hour",
		count: 1,
		startOf: (timestamp) => timestamp.clone().startOf("hour"),
		rolling: {
			period: "minute_15",
			count: 4
		}
	},
	"hour_6": {
		period: "hour",
		count: 6,
		startOf: (timestamp) => timestamp.clone().startOf("hour"),
	},
	"day": {
		period: "hour",
		count: 24,
		startOf: (timestamp) => timestamp.clone().startOf("day")
	},
	"week": {
		period: "hour",
		count: 168,
		startOf: (timestamp) => timestamp.clone().startOf("week")
	}
};
module.exports = {
	data: bucketsData,
	ranges: ranges
	// getBucket: function (period) {
	// 	var range = period;
	// 	if (typeof period == "string") {
	// 		range = ranges[period]
	// 	}
	// 	if (!range || !bucketsData[range.period]) {
	// 		return null;
	// 	}

	// 	var bucket = bucketsData[range.period];

	// 	return {
	// 		prefix: bucket.prefix,
	// 		transform: function (timestamp) {
	// 			return bucket.transform(timestamp);
	// 		},
	// 		prev: function (timestamp, amount) {
	// 			return bucket.prev(timestamp, (amount || 1) * range.count);
	// 		},
	// 		next: function (timestamp, amount) {
	// 			return bucket.prev(timestamp, (amount || 1) * range.count);
	// 		},
	// 		duration: moment.duration(bucket.duration) * range.count,
	// 	}
	// }
};