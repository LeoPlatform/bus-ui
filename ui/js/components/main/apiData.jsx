import React, { Component } from 'react'
import { connect } from 'react-redux'
import { inject, observer } from 'mobx-react'

@inject('dataStore')
@observer
class ApiData extends React.Component {

	api = window.api
	currentRequest = undefined

	constructor(props) {
		super(props)
		this.dataStore = this.props.dataStore;

		this.state = {}

		window.getSettings = this.getSettings.bind(this)
		window.fetchData = this.fetchData.bind(this)
	}


	getSettings() {

		this.props.dispatch({ type: 'SET_IS_AUTHENTICATED' })

		$.get(this.api + "/settings/", (data) => {
			window.templates = data.lambda_templates || {};
			for (var template_id in data.lambda_templates) {
				var template = data.lambda_templates[template_id] || {};
				if (template.validator) {
					(function wrap() {
						var module = {
							exports: {}
						};
						eval(template.validator);
						template.validator = module.exports;
					})();
				}
			}
			this.fetchData()
		}).fail((result) => {
			if (result.statusText != 'canceled') {
				result.call = this.api + "/settings/"
				window.messageLogNotify('Failure retrieving settings', 'warning', result)
				this.fetchData()
			}
		})
	}


	fetchData() {
		this.dataStore.getStats();
	}


	render() {
		return false
	}

}

export default connect(store => store)(ApiData)
