import React, {Component} from 'react';

export default class ComboBox extends React.Component {

	constructor(props) {
		super(props)

		this.state = {
			text: ''
		}
	}


	onFocus() {
		this.setState({ active: true })
		console.log('focus')
	}


	onBlur() {
		setTimeout(() => {
			this.setState({ active: false })
			console.log('blur')
		}, 100)
	}


	onChange(event) {
		this.setState({ text: event.currentTarget.value })
	}


	onSelect() {

	}


	render() {

		return (<div className="theme-form-row theme-required">
			<label>{this.props.label}</label>
			<input placeholder={this.props.placeholder || ''} className={'theme-combo-box' + (this.state.active ? ' active' : '')} value={this.state.text || ''} onClick={this.onFocus.bind(this)} onBlur={this.onBlur.bind(this)} onChange={this.onChange.bind(this)} />
			<ul>
				<li onClick={this.onSelect.bind(this)}>
					<label>Add New</label>
					<div>
						<img src={this.props.icon} />
						{
							this.state.text
							? <span>
								{this.state.text}
								<img className="pull-right" src={window.leostaticcdn + 'images/icons/enter.png'} />
							</span>
							: <span>Type to name a new {this.props.name}...</span>
						}
					</div>
				</li>
				<li onClick={this.onSelect.bind(this)}>
					<label>Select Existing</label>
					<div>
						<img src={this.props.icon} /> No matches
					</div>
				</li>
			</ul>
		</div>)
	}

}
