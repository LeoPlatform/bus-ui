import React, { Component } from 'react'
import {observer, inject} from 'mobx-react'

@inject('dataStore')
@observer
class Webhooks extends React.Component {


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			webhooks: []
		}
	}


	componentWillMount() {
		this.refresh()
	}


	componentWillUnmount() {
		clearTimeout(this.refreshTimeout)
	}


	refresh() {
		this.setState({ webhooks: (this.dataStore.nodes[this.props.nodeData.id] || []).webhooks || [] }, () => {
			this.refreshTimeout = setTimeout(this.refresh.bind(this), 1000)
		})
	}


	addWebhook() {
		window.createBot({
			source: null,
			onSave: this.onSave.bind(this),
			group: 'webhook',
			system: {
				id: this.props.nodeData.id,
				label: this.props.nodeData.label,
				type: 'webhook'
			}
		})
	}


	onSave(response) {
		var webhooks = this.state.webhooks
		webhooks.push(response.refId)
		$.post(window.api + '/system/' + ((this.props.nodeData || {}).id || ''), JSON.stringify({ webhooks: webhooks}), (response) => {
			//console.log('System response', response)
			this.setState({ webhooks: webhooks })
			window.fetchData()
		})
	}


	runNow(webhookId) {
		$.post(window.api + '/system/' + webhookId, JSON.stringify({ executeNow: true }), (response) => {
			window.messageLogNotify('Webhook run triggered on ' + this.dataStore.nodes[webhookId].label)
		}).fail((result) => {
			window.messageLogModal('Failure triggering webhook run on bot ' + this.dataStore.nodes[botId].label, 'error', result)
		})
	}


	render() {

		return (<div>

			<div className="theme-table-fixed-header">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Frequency</th>
							<th>Last Run</th>
							<th>Last Log</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{
							this.state.webhooks.length
							? this.state.webhooks.map((webhookId, index) => {
								var webhook = this.dataStore.nodes[webhookId] || {}
								//console.log('webhooks', webhooks, webhookId)
								return (<tr key={webhookId}>
									<td>
										<a onClick={() => {
											window.subNodeSettings({
												id: webhookId,
												label: webhook.label,
												type: webhook.type,
												server_id: webhook.id
											}, true)
										}}>{webhook.label}</a>
									</td>
									<td>{webhook.frequency}</td>
									<td>{webhook.last_run && webhook.last_run.end ? moment(webhook.last_run.end).format() : ' - '}</td>
									<td>{((webhook.logs || {}).errors || '').toString()}</td>
									<td className="text-center">
										<button type="button" className="theme-button" onClick={this.runNow.bind(this, webhook.id)}>Run Now</button>
									</td>
								</tr>)
							})
							: false
						}
						<tr>
							<td colSpan="5">
								<button type="button" className="theme-button" onClick={this.addWebhook.bind(this)}>
									<i className="icon-plus"></i> Add Webhook
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

		</div>)
	}

}

export default Webhooks
