import React, {Component} from 'react';


export default class TimePicker extends React.Component {

	constructor(props) {
		super(props)
		this.state = {}
	}


	componentDidMount() {

		//https://eonasdan.github.io/bootstrap-datetimepicker/
		$('#dateTimePicker').datetimepicker({
			sideBySide: true,
			maxDate: moment().endOf('d'),
			defaultDate: this.props.customTimeFrame || moment()
		})

	}


	componentDidUpdate(props, state) {

		if (props.customTimeFrame !== this.props.customTimeFrame) {
			$('#dateTimePicker').data('DateTimePicker') && $('#dateTimePicker').data('DateTimePicker').destroy()

			$('#dateTimePicker').datetimepicker({
				sideBySide: true,
				maxDate: moment().endOf('d'),
				date: moment(this.props.customTimeFrame)
			})
		}

	}


	componentWillUnmount() {

		$('#dateTimePicker').data('DateTimePicker') && $('#dateTimePicker').data('DateTimePicker').destroy()

	}


	onClick(timePeriod) {
		timePeriod = timePeriod.replace('hr', 'h')
		this.props.onClick && this.props.onClick(timePeriod)
	}


	customTimeFrame() {
		$('#dateTimePicker').data("DateTimePicker").hide()
		this.props.datePicker && this.props.datePicker($('#dateTimePicker [name=customTimeFrame]').val() || moment())
	}


	render() {

		var active = (this.props.active || '').replace('h', 'hr')

		return (<div className={'theme-time-picker' + (this.props.datePicker ? ' has-date-picker' : '')}>

			<div className="wrapper">
				{
					( this.props.timeFrames || ['15m', '1hr', '6hr', '1d', '1w'] ).map((timePeriod) => {
						return (<span key={timePeriod} className={'time' + (active === timePeriod ? ' active' : '')} onClick={this.onClick.bind(this, timePeriod)}>{timePeriod}</span>)
					})
				}
			</div>

			{
				this.props.datePicker
				? (<span className="input-group time position-relative" id="dateTimePicker">
					<input type="hidden" name="customTimeFrame" value={this.props.customTimeFrame || ''} />
					<i className={'icon-calendar-empty datepickerbutton ' + (active ? '' : ' active')} />
					<div className="mask" onClick={this.customTimeFrame.bind(this)}></div>
				</span>
				)
				: false
			}

			{
				this.props.now
				? <div>Now</div>
				: false
			}

			{
				this.props.onRefresh
				? <i className="icon-refresh" onClick={this.props.onRefresh} />
				: false
			}

		</div>)
	}

}
