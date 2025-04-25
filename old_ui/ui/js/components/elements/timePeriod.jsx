import React, { Component } from 'react'
import { connect } from 'react-redux'
import {observer, inject} from 'mobx-react'
import { saveSettings } from '../../actions'

import moment from 'moment'

@inject('dataStore')
@observer
class TimePeriod extends React.Component {
	constructor(props) {
		super(props);
        this.dataStore = this.props.dataStore;

        this.apiFormat = props.apiFormat || 'YYYY-MM-DD HH:mm:ssZ'
		this.displayFormat = props.displayFormat || 'M/DD/YYYY h:mm A'

		this.state = {
			begin: (props.defaults && props.defaults.begin) ? props.defaults.begin : undefined,
			end: (props.defaults && props.defaults.end) ? props.defaults.end : undefined,
			interval: (props.defaults && props.defaults.interval) ? props.defaults.interval : 'minute_15'
		}

		//if interval list passed, limit to those
		if (props.intervals) {
			var filtered_intervals = {}
			props.intervals.forEach((interval) => {
				filtered_intervals[interval] = this.intervals[interval]
			})
			this.intervals = filtered_intervals
		}

		this.updateInterval = setInterval(() => {
			if (!this.state.end) {
				this.setState({ updated: Date.now() })
			}
		}, 60000)

	}


	dateParse(date) {
		var parsed = moment(Date.parse(date))
		if (!parsed.isValid()) {
			parsed = moment()
		}
		return parsed
	}


	componentWillReceiveProps(props) {

		if (JSON.stringify(props.defaults) != JSON.stringify(this.props.defaults)) {
			this.setState({
					begin: (props.defaults && props.defaults.begin) ? props.defaults.begin : undefined,
					end: (props.defaults && props.defaults.end) ? props.defaults.end : undefined,
					interval: (props.defaults && props.defaults.interval) ? props.defaults.interval : 'minute_15'
				}
        );
		}

	}


	triggerOnChange() {

		if ($('#mainDateTimePicker').data("DateTimePicker")) {
			$('#mainDateTimePicker').data('DateTimePicker').defaultDate(this.state.end || moment())
		}

		var data = {
			interval: this.state.interval,
			begin: this.state.begin,
			end: this.state.end,
			range: this.intervals[this.state.interval],
			endFormatted: () => {
				return this.dateParse(this.state.end).endOf(this.intervals[this.state.interval].unit).format(this.apiFormat)
			}
		}

		window.timePeriod = data

		this.props.dispatch(saveSettings({
			timePeriod: {
				begin: data.begin,
				end: data.end,
				interval: data.interval
			}
		}))
		this.dataStore.changeTimePeriod(data.begin, data.end, data.interval);
		this.dataStore.getStats();
	}


	intervals = {
		"minute_1": {
			step: 1,
			unit: "m",
			label: '1m',
			subunit: 's'
		},
		"minute_5": {
			step: 5,
			unit: "m",
			label: '5m',
			subunit: 'm'
		},
		"minute_15": {
			step: 15,
			unit: 'm',
			label: '15m',
			substep: 1,
			subunit: 'm'
		},
		"hour": {
			step: 1,
			unit: "h",
			label: '1hr',
			substep: 15,
			subunit: 'm'
		},
		"hour_6": {
			step: 6,
			unit: "h",
			label: '6hr',
			substep: 1,
			subunit: 'm'
		},
		"day": {
			step: 1,
			unit: "d",
			label: '1d',
			substep: 1,
			subunit: 'h'
		},
		"week": {
			step: 1,
			unit: "w",
			label: '1w',
			subunit: 'd'
		},
	}


	componentDidMount() {

		window.timePeriod = window.timePeriod || {
			interval: 'minute_15',
			begin: undefined,
			end: undefined,
			range: this.intervals['minute_15']
		}

		this.triggerOnChange()

		$('#mainDateTimePicker').datetimepicker({
			sideBySide: true,
			maxDate: moment().endOf('d'),
			//format: this.apiFormat,
			extraFormats: [ this.apiFormat ],
			defaultDate: moment()
		})

	}


	componentWillUnmount() {

		if (this.updateInterval) {
			clearInterval(this.updateInterval)
		}

		$('#mainDateTimePicker').data('DateTimePicker') && $('#mainDateTimePicker').data('DateTimePicker').destroy()

	}


	setField(field, event) {
		var value = (typeof event === 'object' ? event.currentTarget.value : event)
		var begin = this.state.begin

		if (this.props.singleField === "true") {
			if (field === 'interval' && begin) {
				var interval = this.intervals[value]
				begin = this.dateParse(this.state.end).subtract(interval.step, interval.unit).format(this.apiFormat)
			}
			if (field === 'end') {
				var interval = this.intervals[this.state.interval]
				begin = this.dateParse(value).subtract(interval.step, interval.unit).format(this.apiFormat)
				value = this.dateParse(value).format(this.apiFormat)
			}
		}

		this.setState({
			begin: begin,
			[field]: value,
			editField: false
		}, () => {
			this.triggerOnChange()
		})
	}


	editField(field) {
		this.setState({ editField: field }, () => {
			$('.'+field+'-time-input').focus()
		})
	}


	goToNow() {
		this.setState({
			begin: undefined,
			end: undefined
		}, () => {
			this.triggerOnChange();
		})
	}


	goBackward() {
		var interval = this.intervals[this.state.interval]
		if (this.props.spread == "true") {
			interval = interval.spread
		}
		var begin = this.dateParse(this.state.begin).subtract(interval.step, interval.unit)
		var end = this.dateParse(this.state.end).subtract(interval.step, interval.unit)

		if (interval.unit == 'm' && !this.state.end) {
			begin = moment(begin).add(interval.step - begin.get(interval.unit) % interval.step, interval.unit).startOf(interval.unit)
			end = moment(end).add((interval.step-1) - end.get(interval.unit) % interval.step, interval.unit).startOf(interval.unit)
		}

		if (!this.state.begin) {
			begin = begin.subtract(interval.step, interval.unit)
		}
		this.setState({
			begin: begin.format(this.apiFormat),
			end: end.format(this.apiFormat)
		}, () => {
			this.triggerOnChange()
		})
	}


	goForward() {
		var interval = this.intervals[this.state.interval]
		if (this.props.spread == "true") {
			interval = interval.spread
		}
		var begin = this.dateParse(this.state.begin).add(interval.step, interval.unit)
		var end = this.dateParse(this.state.end).add(interval.step, interval.unit)

		if (begin.isSameOrAfter(moment(), interval.unit) || end.isSameOrAfter(moment(), interval.unit)) {
			begin = undefined
			end = undefined
		}

		this.setState({
			begin: begin ? begin.format(this.apiFormat) : undefined,
			end: end ? end.format(this.apiFormat) : undefined
		}, () => {
			this.triggerOnChange()
		})
	}


	customTimeFrame() {
		$('#mainDateTimePicker').data('DateTimePicker').hide()
		this.setState({
			end: $('#mainDateTimePicker').data('date')
		}, () => {
			this.triggerOnChange()
		})
	}


	render() {

		if (this.props.singleField == 'true') {

			var beginMoment = this.dateParse(this.state.end).startOf(this.intervals[this.state.interval].unit)
			var endMoment = this.dateParse(this.state.end).endOf(this.intervals[this.state.interval].unit)

			switch(this.state.interval) {
				case 'week':
					var endFormatted = beginMoment.format("M/DD/YYYY") + ' - ' + endMoment.format("M/DD/YYYY")
				break;

				case 'day':
					if (endMoment.isSame(moment().subtract(1, 'day'), 'day')) {
						var endFormatted = 'Yesterday'
					} else if (endMoment.isSame(moment(), 'day')) {
						var endFormatted = 'Today'
					} else {
						var endFormatted = endMoment.format("M/DD/YYYY")
					}
				break

				case 'hour':
					if (endMoment.isSame(moment().subtract(1, 'day'), 'day')) {
						var endFormatted = 'Yesterday ' + endMoment.format('h:00 - h:59 A')
					} else if (endMoment.isSame(moment(), 'day')) {
						var endFormatted = 'Today ' + endMoment.format('h:00 - h:59 A')
					} else {
						var endFormatted = endMoment.format('M/DD/YYYY h:00 - h:59 A')
					}
				break;

				case 'minute_15':
					var offset = (endMoment.minute() + 15) % 15
					if (offset == 0) {
						offset = 15
					}
					if (endMoment.isSame(moment().subtract(1, 'day'), 'day')) {
						var endFormatted = 'Yesterday'
					} else if (endMoment.isSame(moment(), 'day')) {
						var endFormatted = 'Today'
					} else {
						var endFormatted = endMoment.format('M/DD/YYYY')
					}
					endFormatted += ' ' + beginMoment.add((-offset), 'minutes').format('h:mm') + endMoment.add((14 - offset), 'minutes').format(' - h:mm A')
				break;

				default:
					endFormatted = endMoment.format('MMMM D, YYYY h:mm A')
				break;
			}

		} else {
			var endFormatted = (this.state.end ? this.dateParse(this.state.end).format(this.displayFormat) : 'Now')
		}

		return (<div className={"theme-time-picker has-date-picker " + (this.props.className || '')}>
            {
                !this.props.vertical
                    ? <i className="icon-left-open" onClick={this.goBackward.bind(this)} />
                    : false
            }
            {
                this.state.editField === 'end'
                    ? <input className="end-time-input theme-form-input" onBlur={this.setField.bind(this, "end")} onKeyDown={(event) => { if (event.keyCode == 13) this.setField('end', event) }} placeholder="End Time" defaultValue={this.dateParse(this.state.end).format(this.displayFormat)} />
                    : <span className="date-interval-date" title="click to change" onClick={this.editField.bind(this, 'end')}>{endFormatted}</span>
            }

			<span className="input-group time" id="mainDateTimePicker">
				<input type="hidden" name="customTimeFrame" value={this.state.end || ''} />
				<i className="icon-calendar-empty datepickerbutton" />
				<div className="mask" onClick={this.customTimeFrame.bind(this)}></div>
			</span>

			<i className="icon-right-open" disabled={!this.state.end} onClick={this.goForward.bind(this)} />
			<div className="wrapper">
				{
					Object.keys(this.intervals).map((key) => {
						return <span key={key} className={'time' + (this.state.interval === key ? ' active' : '')} onClick={this.setField.bind(this, 'interval', key)}>{this.intervals[key].label}</span>
					})
				}
			</div>
			<span className="now-button" disabled={!this.state.end} onClick={this.goToNow.bind(this)}>Now</span>
		</div>)

	}
}

export default connect(store => store)(TimePeriod)
