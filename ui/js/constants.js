
export const systemTypes = () => {
	return {
		'Elastic Search': {
			icon: 'elasticSearch.png',
			settings: ['host']
		},
		'CSV': {
			icon: 'text_file.png',
			settings: []
		},
		'MongoDB': {
			icon: 'mongoDB.png',
			settings: ['host', 'database']
		},
		'LeoDW': {
			icon: 'LeoMane.png',
			settings: []
		},
		'Custom': {
			icon: 'system.png',
			settings: []
		}
	}
}



export const chartSettings =  () => {
	return {
		'Execution Count': {
			key: "Execution Count",
			title: "Execution Count",
			series: ["Runs"],
			value: function (item) {
				return Math.round(item.value || 0);
			},
			sla: {
				field: "null-0(units)"
			},
			fields: ['executions'],
			helpText: {
				bot: 'How many times a bot executed during the given time interval.'
			},
			helpLink: ''
		},
		'Execution Time': {
			key: "Execution Time",
			title: "Execution Time",
			series: ["Max", "Avg", "Min"],
			value: function (item) {
				return [Math.round(item.max || 0), Math.round(item.value || 0), Math.round(item.min || 0)]
			},
			format: function(value) {
				return window.humanize(value)
				return value
			},
			totalFormat: function(value) {
				return window.humanize(value)
			},
			sla: {
				field: "/(duration,runs)"
			},
			fields: ['duration'],
			helpText: {
				bot: 'The average length of time in seconds that a bot executed during the given time interval.'
			},
			helpLink: ''
		},
		'Error Count': {
			key: "Error Count",
			title: "Error Count",
			value: function (item) {
				return Math.round(item.value || 0)
			},
			sla: {
				field: "null-0(errors)"
			},
			fields: ['errors'],
			helpText: {
				bot: 'How many times the bot errored during the given time interval.'
			},
			helpLink: ''
		},
		'Events Written': {
			key: 'Events Written',
			title: "Events Written",
			series: "Writes",
			value: function (item) {
				return Math.round(item.value || 0)
			},
			sla: {
				field: "null-0(units)"
			},
			fields: ['writes'],
			helpText: {
				queue: 'How many events were written to the queue from all bots during the given time interval.',
				queue_write: 'How many events were written to the queue by the selected bot during the given time interval.'
			},
			helpLink: ''
		},
		'Events In Queue': {
			//key: 'Events Written',
			//key: 'Events Read', //'Events In Queue',
			title: "Events In Queue",
			series: "Events",
			value: function (item) {
				return Math.round(item.value || 0)
			},
			sla: {
				field: "null-0(units)"
			},
			fields: ['writes'],
			helpText: {
				queue_read: 'Estimate of how many events that are unread by the selected bot are in the queue during the given time interval.'
			},
			helpLink: ''
		},
		'Events Read': {
			key: 'Events Read',
			title: "Events Read",
			series: "Reads",
			value: function (item) {
				return Math.round(item.value || 0)
			},
			sla: {
				field: "null-0(units)"
			},
			fields: ['reads'],
			helpText: {
				queue: 'How many events were read from the queue from all bots during the given time interval.',
				queue_read: 'How many events were read from the queue by the selected bot during the given time interval.'
			},
			helpLink: ''
		},
		'Source Lag': {
			key: 'Source Lag',
			title: "Lag in Seconds",
			fields: ['read_lag', 'write_lag'],
			series: ["Read Lag", "Write Lag"],
			value: function (item) {
				return moment.duration(item.value || 0).asSeconds()
			},
			format: function (value) {
				//return window.humanize(value * 1000)
				return value
			},
			helpText: {
				queue: 'The average age of the events read at the time they were read during the given time interval.'
			},
			helpLink: ''
		},
		'Read Source Lag': {
			key: 'Read Source Lag',
			title: "Lag",
			series: ["Read Lag"],
			fields: ['read_lag'],
			value: function (item) {
				return moment.duration(item.value || 0).asSeconds()
			},
			format: function (value) {
				return window.humanize(value * 1000)
				return value
			},
			totalFormat: function(value) {
				return window.humanize(value)
			},
			sla: {
				field: "lag(start, end, 'minutes')"
			},
			helpText: {
				queue_read: 'The average age of the events read by the selected bot at the time they were read during the given time interval.'
			},
			helpLink: ''
		},
		'Write Source Lag': {
			key: 'Write Source Lag',
			title: "Lag",
			series: ["Write Lag"],
			fields: ['write_lag'],
			value: function (item) {
				return moment.duration(item.value || 0).asSeconds()
			},
			format: function (value) {
				return window.humanize(value * 1000)
				return value
			},
			totalFormat: function(value) {
				return window.humanize(value)
			},
			sla: {
				field: "lag(start, end, 'minutes')"
			},
			helpText: {
				queue_write: 'The average age of the events read at the time they were read during the given time interval.',
			},
			helpLink: ''
		},
		analytics: {
			key: 'analytics',
			title: "Analytics",
			fields: ['analytics'],
			multi: true,
			//type: "line",
			configure: (chart, data, context) => {
				// Build Expressions & Series
				var s = {};
				context.expressions = {}
				for (var k in data) {
					var d = data[k];
					if (d["leo:analytics"]) {
						var analytics = d["leo:analytics"].analytics;
						for (var a in analytics) {
							context.expressions[a] = {};
							s[a] = s[a] || {};
							for (var b in analytics[a]) {
								s[a][b] = 1;
							}
						}
					}
				};
				context.series = s;

				// Build select list & add Change handler

				//var select = $(".chart-title select", chart);
				var select = $(chart).prev('header').find('select')

				if (!context.configured) {
					select.empty();
					context.options = {};
					select.off().change((e) => {
						context.expression = select.val();
						var config = this.props.config
						config.context = context
						this.updateChart(config)
					});
				}

				var expressions = Object.keys(context.expressions).sort();
				for (var index in expressions) {
					var key = expressions[index];
					if (!context.options[key]) {
						select.append(`<option value="${key}">${key}</option>`);
						context.options[key] = true;
					}
				}
				context.expression = context.expression || select.val();
				context.configured = true;
			},
			series: function (data, context) {
				var series = [];
				for (var key in context.series[context.expression]) {
					series.push(key);
				}
				return series;
			},
			value: function (item, context) {
				var expression = context.expression; //"$.data";
				var result = [];

				for (var b in context.series[expression]) {
					var value = null;
					if (item["leo:analytics"]) {
						var analytics = item["leo:analytics"].analytics;
						if (expression in analytics) {
							value = analytics[expression][b];
						}
					}
					result.push(value || 0);
				}
				return result;
			}
		}
	}

}
