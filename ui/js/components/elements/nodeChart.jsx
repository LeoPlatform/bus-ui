import React, { Component } from 'react'
import { connect } from 'react-redux'

let TIME_FORMAT = "YYYY-MM-DD HH:mm"
let moment = require("moment");

class NodeChart extends React.Component {

	alarmStatus = 'Add'

	xAxisFormats = {
		"minute_1": function(value) { return moment(moment(value).valueOf()).format("HH:mm") },
		"minute_5": function(value) { return moment(moment(value).valueOf()).format("HH:mm") },
		"minute_15": function(value) { return moment(moment(value).valueOf()).format("HH:mm") },
		"hour": function(value) { return moment(moment(value).valueOf()).format("HH:mm") },
		"hour_6": function(value) { return moment(moment(value).valueOf()).format("HH:mm") },
		"day": function(value) { return moment(value).format("YYYY-MM-DD HH:mm") },
		"week": function(value ){ return moment(value).format("YYYY-MM-DD") },
	}


	selectedTime = {
		minute_15: {
			step: 1,
			unit: 'm',
			interval: 'minute_1'
		},
		hour: {
			step: 15,
			unit: 'm',
			interval: 'minute_15'
		},
		hour_6: {
			step: 15,
			unit: 'm',
			interval: 'minute_15'
		},
		day: {
			step: 1,
			unit: 'h',
			interval: 'hour'
		},
		week: {
			step: 1,
			unit: 'd',
			interval: 'day'
		}
	}


	idSuffix = '_' + Math.floor(Math.random()*Math.pow(10,10)) + Date.now()

	constructor(props) {
		super(props);

		this.state = {
			chartId: 'chart_' + this.props.chartKey.replace(/ /g, '-') + this.idSuffix
		}
	}


	componentDidMount() {

		this.addChart()

		window.responsiveFont()

	}


	componentDidUpdate(props) {

		if (props.interval !== this.props.interval) {
			this.chartFormatter = this.xAxisFormats[this.props.interval]
			if (this.chart) {
				this.chart.internal.loadConfig({ transition: { duration: 0 } })
				this.chart && this.chart.destroy()
				delete this.chart
			}
			this.addChart()
		}

		if (!document.hidden) {
			this.updateChart()
			window.responsiveFont()
		}

	}


	componentWillUnmount() {

		if (this.chart) {
			this.chart.internal.loadConfig({ transition: { duration: 0 } })
			setTimeout(() => {
				this.chart && this.chart.destroy()
				delete this.chart
			}, 500)
		}

	}


	addChart() {

		this.chartFormatter = this.xAxisFormats[this.props.interval]

		var chartSettings = this.props.chartSettings[this.props.chartKey]
			, showAxis = !!this.props.showHeader && (window.innerWidth > 700)

		this.chart = c3.generate({
			bindto: '#' + this.state.chartId,
			data: {
				x: 'x',
				xFormat: '%Y-%m-%d %H:%M',
				columns: [],
				type: 'line'
			},
			transition: {
				duration: 500
			},
			axis: {
				x: {
					show: showAxis,
					type: 'timeseries',
					tick: {
						format: (x) => {
							return this.chartFormatter(x)
						},
						culling: {
							max: Math.max(Math.floor(window.innerWidth / (4*90)), 2)
						},
						outer: false
					}
				},
				y: {
					//min: 0.0,
					show: showAxis,
					tick: {
						format: (chartSettings.format) || d3.format(",.2"),
						culling: {
							max: Math.max(Math.floor(window.innerWidth / (4*90)), 2)
						},
						outer: false
					}
				}
			},
			tooltip: {
				position: function(dataToShow, tWidth, tHeight, element) {
					var svgLeft = this.getSvgLeft(true)
						, tooltipRight = svgLeft + this.getCurrentPaddingLeft(true) + this.x(dataToShow[0].x) - 20
						, tooltipLeft = Math.max(tooltipRight - tWidth, 20) // 20 is needed for Firefox to keep tooltip width
						, mouse = this.d3.mouse(element)
						, tooltipTop = Math.max(mouse[1] + 15, 0)
					if (tooltipTop + tHeight > this.currentHeight) {
						tooltipTop -= tHeight + 15
					}
					return {top: tooltipTop, left: tooltipLeft}
				}
			},
			legend: {
				show: false
			},
			point: {
				show: false
			}
		})

		this.updateChart()
	}


	updateChart(config) {

		if (document.hidden) {
			//console.log('hidden')
			return
		}

		config = config || this.props.config || {}

		var seriesData = this.props.data

		if (!seriesData || !seriesData.length || !seriesData[0]) {
			return
		}

		var xAxisFormat = function(timestamp){ return timestamp; }; //function(timestamp) { return moment(timestamp).format(TIME_FORMAT) }

		var chartSettings = this.props.chartSettings[this.props.chartKey]

		var columns = [["x"]],
			seriesName = chartSettings.series,
			context = config.context || {},
			lineValue = ''

		if (chartSettings.configure) {
			chartSettings.configure($('#' + this.state.chartId), seriesData, context)
		}

		if (typeof seriesName == "function") {
			seriesName = seriesName(seriesData, context)
		}

		if (typeof (seriesName || '') == 'string') {
			columns.push([seriesName || 'Count'])
		} else{
			for (var key in seriesName) {
				columns.push([seriesName[key]])
			}
		}

		if (seriesData && seriesData[0] && !seriesData[0].length) {
			seriesData = [seriesData]
		}

		seriesData.map((serieData, serieIndex) => {

			serieData.map((datum) => {

				if (serieIndex == 0) {
					columns[0].push(xAxisFormat(datum.time)) //date
				}

				var point = chartSettings.value(datum, context)
				if (point && point.length) {
					for(var i = 0; i< point.length; i++){
						columns[i+1].push(point[i])
					}
				} else if (columns[serieIndex+1]) {
					columns[serieIndex+1].push(point)
				}

                if (typeof this.props.lastRead !== 'undefined' && (!lineValue || moment(datum.time).isSameOrBefore(this.props.lastRead)) && this.props.chartKey === 'Events In Queue') {
					lineValue = datum.time
				}
			})

		});

		var timestamp = moment()
			, selectedTime = this.selectedTime[this.props.interval]
			, size = selectedTime.step
			, unit = selectedTime.unit
			, offset = (timestamp.get(unit) + size) % size
			, incomplete = timestamp.subtract(offset, unit).startOf(unit)
			, region = this.chart.regions().filter(e=>e.class = "incomplete")[0]
			, colors = {}

		try {
			this.chart.load(
				{
					columns: columns
				}
			);
			this.chart.data.colors(colors)
		} catch(e) {
			console.log('columns', columns)
		}

		setTimeout(() => {

			if (this.chart) {

				if (!region) {
					this.chart.regions([{
						start: incomplete.format(TIME_FORMAT),
						class: 'incomplete',
						style: 'dashed'
					}])
				} else {
					region.start = incomplete.format(TIME_FORMAT)
				}

				if (lineValue) {
					this.chart.xgrids([{
						value: xAxisFormat(lineValue),
						class: 'read-cutoff',
						text: ''
					}])
				}

			}

		}, 10)

	}


	render() {

		var compare = (this.props.compare || [])[0]

		return (<div className={'node-chart flex-column ' + ' ' + (this.props.className || '')}>
			{
				this.props.showHeader
				? <header className="text-left">
					{
						this.props.chartSettings[this.props.chartKey].helpText
						? (<div className="pull-right position-relative">
							<i className="icon-help-circled" />
							<div className={'theme-hover-view ' + (this.props.isLast ? 'theme-popup-above-left' : 'theme-popup-above-right')} style={{ maxWidth: '50vw' }}>
								<header>Help</header>
								<p>{this.props.chartSettings[this.props.chartKey].helpText[this.props.nodeType]}</p>
								<a href={window.leoDocsLink + (this.props.chartSettings[this.props.chartKey].helpLink || 'workflows#section-show-charts')} target="documentation">Learn More</a>
							</div>
						</div>)
						: false
					}
					<span>{this.props.chartSettings[this.props.chartKey].title}</span>
					<div>
						{this.props.chartSettings[this.props.chartKey].multi ? <select className="theme-form-input"></select> : false}
					</div>
				</header>
				: false
			}
			<div className="flex-row flex-grow clear-both">
				{
					this.props.showHeader
					? (<div className="stats width-1-4">
						<div className="current no-wrap responsive-font">{
							compare
							? (
								this.props.chartSettings[this.props.chartKey].totalFormat
								? this.props.chartSettings[this.props.chartKey].totalFormat(compare.current)
								: Math.round(compare.current)
							)
							: '-'
						}</div>
						<div className="prev_change no-wrap responsive-font">
							<span>{
								compare
								? (
									this.props.chartSettings[this.props.chartKey].totalFormat
									? this.props.chartSettings[this.props.chartKey].totalFormat(compare.prev)
									: Math.round(compare.prev)
								)
								: '-'
							}</span>
							<span> / </span>
							<span>{compare ? compare.change || '-' : '-'}</span>
						</div>
					</div>)
					: false
				}
				<div className={(this.props.showHeader ? 'width-3-4' : 'width-1-1') + ' pull-center'}>
					<figure id={this.state.chartId}></figure>
				</div>
			</div>
		</div>)

	}

}

export default connect((store) => {
	return {
		chartSettings: store.chartSettings
	}
})(NodeChart)
