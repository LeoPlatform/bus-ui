import React, {Component} from 'react'

import Slider from '../elements/slider.jsx'

export default class TimeSlider extends React.Component {

	constructor(props) {
		super(props)

		this.state = {

			left: 4,
			right: 5
		}

	}


	onChange(values, dropped) {

		this.setState({ left: values.left, right: values.right })

		if (dropped) {

			this.props.onChange && this.props.onChange({
				count: (values.right - values.left) * window.timePeriod.range.step,
				offset: (5 - values.right) * window.timePeriod.range.step * 3
			})

		}

	}


	render() {

		var range = window.timePeriod.range
		var count = (range.step * 3) * (this.state.right - this.state.left)
		var format = { m: 'M/D HH:mm', h: 'M/D HH:mm', d: 'M/D HH:mm' }[range.unit]
		var base = moment(window.timePeriod.end)
		var offset = moment(window.timePeriod.end).subtract((5 - this.state.left) * range.step * 3, range.unit)

		if (range.unit === 'm') {
			//truncate to minute
			base.startOf('minute')
			offset.startOf('minute')
		} else if (range.unit === 'h' && (this.state.right - this.state.left) === 1) {
			//truncate to 15 min
			base.subtract(base.minute() % 15, 'm')
			offset.subtract(offset.minute() % 15, 'm')
		} else if (range.unit === 'h' || range.unit === 'd') {
			//truncate to hour
			base.startOf('hour')
			offset.startOf('hour')
		}

		var minText = moment(base).subtract((range.step * 15), range.unit).format(format)
		var maxText = moment(base).format(format)

		var leftTitle = moment(offset).format(format)
		var rightTitle = moment(offset).add(((this.state.right - this.state.left) * range.step * 3), range.unit).format(format)

		return (<Slider

			min={0}
			max={5}
			step={1}

			left={this.state.left}
			right={this.state.right}

			minText={minText}
			maxText={maxText}

			leftTitle={leftTitle}
			selectionText={count + ' ' + range.unit}
			rightTitle={rightTitle}

			onChange={this.onChange.bind(this)}

		/>)

	}

}
