import React, { Component } from 'react'

export default class List extends React.Component {

	constructor(props) {
		super(props)
		this.state = {
			values: (this.props.value || '').split(','),
			addItem: ''
		}
	}


	addItem(event) {
		if (event.currentTarget.value) {
			var inputBox = $(event.currentTarget)
			var values = this.state.values
			values.push(event.currentTarget.value)
			this.setState({ values: values, addItem: '' }, () => {
				inputBox.focus()
			})
		}
	}


	onKeyPress(event) {
		if (event.key === 'Enter') {
			event.currentTarget.blur()
		}
	}


	removeItem(value) {
		var values = this.state.values
		values.splice(values.indexOf(value), 1)
		this.setState({ values: values })
	}


	render() {

		var field = this.props
		,   values = this.state.values

		return (<div className="flex-column list-input">
			<div className="theme-form-input" title={field.title}>
			{
				values.map((value) => {
					return (<div key={value} value={value} className="flex-row space-between">
						<span>{value}</span>
						<i className="icon-cancel theme-color-disabled" onClick={this.removeItem.bind(this, value)} />
					</div>)
				})
			}
			</div>
			<input value={this.state.addItem || ''} placeholder={field.placeholder} onChange={(event) => { this.setState({ addItem: event.currentTarget.value }) }} onBlur={this.addItem.bind(this)} onKeyPress={this.onKeyPress.bind(this)} />

			<select multiple="true" name={field.name} value={values} onChange={field.onChange} style={{ display: 'none' }}>
			{
				values.map((value) => {
					return (<option key={value} value={value}>{value}</option>)
				})
			}
			</select>

		</div>)

	}


}
