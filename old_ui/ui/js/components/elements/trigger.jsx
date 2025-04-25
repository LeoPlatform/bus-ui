import React, {Component} from 'react'

import NodeSearch from '../elements/nodeSearch.jsx'

class Trigger extends React.Component {

	triggerUnits = {
		minute: '^\\d+ \\*\\/\\d+(?: \\*){4}$',
		hour: '^(?:\\d+ ){2}\\*\\/\\d+(?: \\*){3}$',
		day: '^(?:\\d+ ){3}(?:\\*|\\d[\\d,]*)(?: \\*){2}$',
		month: '^(?:\\d+ ){4}[a-zA-Z, ]+\\*$',
		week: '^(?:\\d+ ){3}(?:\\* ){2}[a-zA-Z, ]+$',
	}


	constructor(props) {
		super(props)

		this.state = {
			value: props.value
		}
	}


	componentWillMount() {

		this.parseTime()

	}


	componentWillReceiveProps(props) {

		if ((props.value != this.props.value) || (props.values != this.props.values) || (this.state.value != this.props.value)) {
			this.setState({ value: props.value }, () => {
				this.parseTime()
			})
		}

	}


	parseTime() {
		var value = this.state.value
			, triggerUnit = 'custom'
			, triggerScalar = 1
			, triggerAt = ''
			, triggerDates = []

		if (JSON.stringify(this.props.values || []) == '["none"]' || value == null) {

				triggerUnit = 'null'

		} else if ( (typeof value == 'string' && !value.match(/^([\d*][\d*\,\/-]* ){3}/)) || (value && value.constructor == Array) ) {

				triggerUnit = 'eventStream'

		} else {

			Object.keys(this.triggerUnits).forEach((triggerUnitName) => {
				var regex = this.triggerUnits[triggerUnitName]
				if (new RegExp(regex).test(value.trim())) {
					triggerUnit = triggerUnitName
				}
			})

			if (value.trim() == '0 0 0 1 * *') {
				triggerUnit = 'month'
			}

			var parts = value.trim().split(/\s+/)

			switch(triggerUnit) {
				case 'minute':
					triggerScalar = parts[1].split('/')[1]
					triggerAt = parts[0]
				break

				case 'hour':
					triggerScalar = parts[2].split('/')[1]
					triggerAt = parts[1] + ':' + parts[0]
				break

				case 'day':
					triggerDates = (parts[3] == '*' ? [] : parts[3].split(','))
					triggerAt = parts[2] + ':' + parts[1] + ':' + parts[0]
				break

				case 'week':
					triggerDates = parts[5].split(',')
					triggerAt = parts[2] + ':' + parts[1] + ':' + parts[0]
				break

				case 'month':
					triggerDates = parts[4] == '*' ? [] : parts[4].split(',')
					triggerAt = parts[2] + ':' + parts[1] + ':' + parts[0]
				break
			}
		}

		if (triggerUnit == 'eventStream' && typeof this.props.values == 'object' && this.props.values.indexOf('stream') == -1) {
			triggerUnit = 'null'
		}

		this.setState({
			triggerUnit: triggerUnit,
			triggerScalar: triggerScalar,
			triggerAt: triggerAt,
			triggerDates: triggerDates,
			triggerCustom: ''
		}, () => {
			if (['eventStream', 'null'].indexOf(triggerUnit) == -1) {
				this.generateTime(false)
			}
		})
	}


	setTriggerUnit(event) {
		this.setState({ triggerUnit: event.currentTarget.value, triggerScalar: 1, triggerAt: '', triggerDates: [], value: '' }, () => {
			this.generateTime(true)
		})
	}


	setTriggerScalar(event) {
		this.setState({ triggerScalar: event.currentTarget.value }, () => {
			this.generateTime(true)
		})
	}


	setTriggerAt(event) {
		this.setState({ triggerAt: event.currentTarget.value }, () => {
			this.generateTime(true)
		})
	}


	setTriggerDate(date) {
		var triggerDates = this.state.triggerDates
		switch(date) {
			case 'all':
				triggerDates = []
			break

			case 'even':
				triggerDates = Array(15).fill().map((x,i) => (i+1)*2)
			break

			case 'odd':
				triggerDates = Array(16).fill().map((x,i) => (i*2)+1)
			break

			default:
				//toggle in array
				if (triggerDates.indexOf(date) == -1) {
					triggerDates.push(date)
				} else {
					triggerDates.splice(triggerDates.indexOf(date), 1)
				}
			break
		}
		this.setState({ triggerDates: triggerDates }, () => {
			this.generateTime(true)
		})
	}


	setTriggerCustom(event) {
		this.setState({ triggerUnit: 'custom', value: event.currentTarget.value }, this.setDirty.bind(this) )
	}


	generateTime(setDirty) {
		var triggerUnit = this.state.triggerUnit
			, triggerScalar = this.state.triggerScalar || 1
			, triggerAt = this.state.triggerAt || ''
			, triggerDates = this.state.triggerDates || []
			, time = ''

		triggerAt = triggerAt.split(/[^\d]/)

		triggerAt[0] = (parseInt(triggerAt[0]) || 0)
		triggerAt[1] = (parseInt(triggerAt[1]) || 0)
		triggerAt[2] = (parseInt(triggerAt[2]) || 0)
		triggerAt[3] = (parseInt(triggerAt[3]) || 0)

		switch(triggerUnit) {
			case 'minute':
				time = (triggerAt[0] % 60) + ' */' + triggerScalar + ' * * * * '
			break

			case 'hour':
				time = (triggerAt[1] % 60) + ' ' + (triggerAt[0] % 60) + ' */' + triggerScalar + ' * * * '
			break

			case 'day':
				time = (triggerAt[2] % 60) + ' ' + (triggerAt[1] % 60) + ' ' + (triggerAt[0] % 24) + (triggerDates.length == 0 ? ' *' : ' '+triggerDates.join(',')) + ' * * '
			break

			case 'week':
				time = (triggerAt[2] % 60) + ' ' + (triggerAt[1] % 60) + ' ' + (triggerAt[0] % 24) + ' * * ' + (triggerDates.length == 0 ? ' Sun' : ' '+triggerDates.join(','))
			break

			case 'month':
				time = (triggerAt[3] % 60) + ' ' + (triggerAt[2] % 60) + ' ' + (triggerAt[1] % 24) + ' ' + Math.max(Math.min(triggerAt[0], 31), 1) + (triggerDates.length == 0 ? ' *' : ' '+triggerDates.join(',')) + ' * '
			break

			case 'eventStream':
				time = ['']
			break

			case 'custom':
				time = (triggerAt[0] % 60) + ' 0 * * * * '
			break

			case 'null':
				time = null
			break
		}

		var propsTime = (typeof this.state.value == 'string' ? this.state.value.trim() : '')
		switch(propsTime) {
			case '0 */1 * * * ?':
				propsTime = '0 */1 * * * *'
			break

			case '0 */5 * * * ?':
				propsTime = '0 */5 * * * *'
			break
		}

		if (triggerUnit != 'eventStream' && !setDirty && (time || '').trim() != propsTime) {
			this.setState({ triggerUnit: 'custom', value: propsTime })
		} else {
			this.setState({ value: time }, () => {
				setDirty && this.setDirty()
			})
		}
	}


	setEventStream(stream) {
		if (stream) {
			if (typeof stream == 'object') {
				stream = stream.label
			}
			this.setState({ value: [stream] }, () => {
				this.setDirty()
			})
		}
	}


	setDirty() {
		this.props.onChange && this.props.onChange(this.state.triggerUnit == 'eventStream' ? [this.state.value] : this.state.value)
	}


	render() {

		return (<div className="triggerComponent">

			<select name="triggerUnit" value={this.state.triggerUnit || ''} onChange={this.setTriggerUnit.bind(this)} style={{ marginBottom: 5 }}>
				{
					typeof this.props.values != 'object' || this.props.values.indexOf('stream') != -1
					? <option value="eventStream">Event Stream</option>
					: false
				}
				{
					typeof this.props.values != 'object' || this.props.values.indexOf('time') != -1
					? [
						<option key="0" value="minute">Run Minutely</option>,
						<option key="1" value="hour">Run Hourly</option>,
						<option key="2" value="day">Run Daily</option>,
						<option key="3" value="week">Run Weekly</option>,
						<option key="4" value="month">Run Monthly</option>,
						<option key="5" value="custom">Run Custom</option>
					]
					: false
				}
				{
					typeof this.props.values != 'object' || this.props.values.indexOf('none') != -1
					? <option value="null">not scheduled</option>
					: false
				}
			</select>

			{
				((state) => {

					switch(state.triggerUnit) {
						case 'minute':
						case 'hour':
							return (<div className="theme-form-row no-wrap">
								<span className="no-wrap text-middle padding-4">Run every</span>
								<input type="number" min="1" value={this.state.triggerScalar || 1} onChange={this.setTriggerScalar.bind(this)} style={{ marginBottom: 5 }} />
								<span className="no-wrap text-middle">{(state.triggerUnit + (state.triggerScalar == 1 ? '' : 's'))}, at</span>
								<input type="text" value={this.state.triggerAt} placeholder={state.triggerUnit == 'hour' ? 'minutes:seconds' : 'seconds'} onChange={this.setTriggerAt.bind(this)} style={{ width: '5em', marginBottom: 5 }} />
								<span className="no-wrap text-middle">{state.triggerUnit == 'minute' ? 'seconds past the minute' : 'minutes and seconds past the hour'}</span>
							</div>)
						break

						case 'day':
							var dateArray = Array(31).fill()
							return [
								(<div key="0" className="theme-form-row">
									<label style={{whiteSpace: 'nowrap'}}>Pick Days</label>
									<div className="date-picker">
										{
											dateArray.map((date, i) => {
												date = (i+1).toString()
												return (<u key={date} className={(this.state.triggerDates.length == 0 || this.state.triggerDates.indexOf(date) !== -1) ? 'active' : ''} onClick={this.setTriggerDate.bind(this, date)}>{date}</u>)
											})
										}
										<u onClick={this.setTriggerDate.bind(this, 'all')}>All</u>
										<u onClick={this.setTriggerDate.bind(this, 'even')}>Even</u>
										<u onClick={this.setTriggerDate.bind(this, 'odd')}>Odd</u>
									</div>
								</div>),
								(<div key="1" className="theme-form-row">
									<label>@</label>
									<input type="text" value={this.state.triggerAt} placeholder={'hour:minutes:seconds'} onChange={this.setTriggerAt.bind(this)} />
								</div>)
							]
						break

						case 'week':
							var dateArray = ['Sun', 'Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat']
							return [
								(<div key="0" className="theme-form-row">
									<label style={{whiteSpace: 'nowrap'}}>Pick Days</label>
									<div className="date-picker">
										{
											dateArray.map((date, i) => {
												return (<u key={date} className={((this.state.triggerDates.length == 0 && i == 0) || this.state.triggerDates.indexOf(date) !== -1) ? 'active' : ''} onClick={this.setTriggerDate.bind(this, date)}>{date[0]}</u>)
											})
										}
									</div>
								</div>),
								(<div key="1" className="theme-form-row">
									<label>@</label>
									<input type="text" value={this.state.triggerAt} placeholder={'hour:minutes:seconds'} onChange={this.setTriggerAt.bind(this)} />
								</div>)
							]
						break

						case 'month':
							var dateArray = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
							return [
								(<div key="0" className="theme-form-row">
									<label style={{whiteSpace: 'nowrap'}}>Pick Months</label>
									<div className="date-picker">
										{
											dateArray.map((date, i) => {
												return (<u key={date} className={(this.state.triggerDates.length == 0 || this.state.triggerDates.indexOf(date) !== -1) ? 'active' : ''} onClick={this.setTriggerDate.bind(this, date)}>{date}</u>)
											})
										}
									</div>
								</div>),
								(<div key="1" className="theme-form-row">
									<label>@</label>
									<input type="text" value={this.state.triggerAt} placeholder={'day hour:minutes:seconds'} onChange={this.setTriggerAt.bind(this)} />
								</div>)
							]
						break

					}

				})(this.state)

			}

			{
				this.state.triggerUnit && this.state.triggerUnit !== 'null' && this.state.triggerUnit !== 'none'
				? (<div>
					{
						this.state.triggerUnit == 'eventStream'
						? <NodeSearch key="0" name="triggers" value={(this.state.value && this.state.value.constructor === Array) ? this.state.value[0] : this.state.value || ''} className="display-inline-block" nodeType={'queues|systems'} onChange={this.setEventStream.bind(this)} />
						: <input key="1" id="time" name="time" type="text" value={this.state.value || ''} className="triggerTime" placeholder="* * * * * *" onChange={this.setTriggerCustom.bind(this)} />
					}
				</div>)
				: false
			}

		</div>)

	}

}

export default Trigger
