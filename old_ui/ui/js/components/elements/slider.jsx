import React, {Component} from 'react';

export default class Slider extends React.Component {

	constructor(props) {
		super(props)

		this.state = this.init(props)
	}


	componentWillReceiveProps(props) {

		this.setState(this.init(props))

	}


	init(props) {
		return {
			min: props.min,
			max: props.max,
			step: props.step,
			left: props.left,
			right: props.right
		}
	}


	onChange(clientX, dropped) {
		var position = clientX - $('.theme-slider .track').offset().left
		var trackWidth = $('.theme-slider .track').width()
		var left = this.state.left
		var right = this.state.right

		if ($(this.dragElement).hasClass('left-handle')) {
			left = (((position - this.dragOffset) / trackWidth) * (this.state.max - this.state.min)) + this.state.min
			left = Math.round(left / this.state.step) * this.state.step
			left = Math.max(left, this.state.min)
			left = Math.min(left, this.state.max - this.state.step, this.state.right - this.state.step)
		} else if ($(this.dragElement).hasClass('right-handle')) {
			right = (((position + this.dragOffset) / trackWidth) * (this.state.max - this.state.min)) + this.state.min
			right = Math.round(right / this.state.step) * this.state.step
			right = Math.max(right, this.state.min + this.state.step, this.state.left + this.state.step)
			right = Math.min(right, this.state.max)
		} else {
			var width = (this.state.right - this.state.left)
			left = (((position - this.dragOffset) / trackWidth) * (this.state.max - this.state.min)) + this.state.min
			left = Math.round(left / this.state.step) * this.state.step
			left = Math.max(left, this.state.min)
			left = Math.min(left, this.state.max - width)
			right = left + width
		}

		this.setState({ left: left, right: right }, () => {
			this.props.onChange && this.props.onChange({ left: this.state.left, right: this.state.right }, dropped)
		})
	}


	dragStart(event) {
		this.clientX = event.clientX || (event.touches && event.touches.length ? event.touches[0].clientX : undefined)
		this.dragElement = event.currentTarget
		this.dragOffset = (this.clientX - $(event.currentTarget).offset().left)
		if (event.dataTransfer) {
			event.dataTransfer.setData('text', '')
			event.dataTransfer.setDragImage(new Image(), 0, 0)
		}
	}


	dragOver(event) {
		if (this.dragElement) {
			this.clientX = event.clientX || (event.touches && event.touches.length ? event.touches[0].clientX : undefined)
			this.onChange(this.clientX, false)
		}
	}


	dragDrop(event) {
		this.onChange(event.clientX || this.clientX, true)
	}


	render() {

		var min = this.state.min
		var max = this.state.max

		var leftTitle = this.props.leftTitle || this.state.left
		var rightTitle = this.props.rightTitle || this.state.right
		var selectionTitle = this.props.selectionTitle || (leftTitle + ' - ' + rightTitle)

		var width = (this.state.right - this.state.left) / (this.state.max - this.state.min) * 100
		var right = 100 - ((this.state.right - this.state.min) / (this.state.max - this.state.min) * 100)

		var selectionText = this.props.selectionText || (this.state.right - this.state.left)

		return (<div className="theme-slider">

			<label>{this.props.minText}</label>

			<div className={'track ticks-' + this.state.step} onDragOver={this.dragOver.bind(this)} onTouchMove={this.dragOver.bind(this)}>

				<div className="selection" style={{ width: width + '%', right: right + '%' }}>
					<span className="left-handle" draggable="true" data-title={leftTitle}
						onTouchStart={this.dragStart.bind(this)} onTouchEnd={this.dragDrop.bind(this)}
						onDragStart={this.dragStart.bind(this)} onDragEnd={this.dragDrop.bind(this)}
					></span>
					<span className="text" draggable="true" data-title={selectionTitle}
						onTouchStart={this.dragStart.bind(this)} onTouchEnd={this.dragDrop.bind(this)}
						onDragStart={this.dragStart.bind(this)} onDragEnd={this.dragDrop.bind(this)}
					>{selectionText}</span>
					<span className="right-handle" draggable="true" data-title={rightTitle}
						onTouchStart={this.dragStart.bind(this)} onTouchEnd={this.dragDrop.bind(this)}
						onDragStart={this.dragStart.bind(this)} onDragEnd={this.dragDrop.bind(this)}
					></span>
				</div>

			</div>

			<label>{this.props.maxText}</label>

		</div>)
	}

}
