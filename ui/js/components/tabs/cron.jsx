import React, { Component } from 'react'
import {inject, observer} from 'mobx-react'

@inject('dataStore')
@observer
class Cron extends React.Component {


	constructor(props) {
		super(props);
		this.

		this.state = {
			crons: []
		}
	}


	componentWillMount() {
		this.refresh()
	}


	componentWillUnmount() {
		clearTimeout(this.refreshTimeout)
	}


	refresh() {
		var crons = (this.dataStore.nodes[this.props.nodeData.id] || []).crons || []
		if (crons.constructor == Object) {
			crons = []
		}
		this.setState({ crons: crons }, () => {
			this.refreshTimeout = setTimeout(this.refresh.bind(this), 1000)
		})
	}


	addCron() {
		window.createBot({
			source: null,
			onSave: this.onSave.bind(this),
			group: 'cron',
			system: {
				id: this.props.nodeData.id,
				label: this.props.nodeData.label,
				type: 'cron'
			}
		})
	}


	onSave(response) {
		var crons = this.state.crons
		crons.push(response.refId)
		$.post(window.api + '/system/' + ((this.props.nodeData || {}).id || ''), JSON.stringify({ crons: crons}), (response) => {
			//console.log('System response', response)
			this.setState({ crons: crons })
			window.fetchData()
		})
	}


	runNow(cronId) {
		$.post(window.api + '/system/' + cronId, JSON.stringify({ executeNow: true }), (response) => {
			window.messageLogNotify('Cron run triggered on ' + this.dataStore.nodes[cronId].label)
		}).fail((result) => {
			window.messageLogModal('Failure triggering cron run on bot ' + this.dataStore.nodes[botId].label, 'error', result)
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
							this.state.crons.length
							? this.state.crons.map((cronId, index) => {
								var cron = this.dataStore.nodes[cronId] || {}
								//console.log('cron', cron, cronId)
								return (<tr key={cronId}>
									<td>
										<a onClick={() => {
											window.subNodeSettings({
												id: cronId,
												label: cron.label,
												type: cron.type,
												server_id: cron.id
											}, true)
										}}>{cron.label}</a>
									</td>
									<td>{cron.frequency}</td>
									<td>{cron.last_run && cron.last_run.end ? moment(cron.last_run.end).format() : ' - '}</td>
									<td>{((cron.logs || {}).errors || '').toString()}</td>
									<td className="text-center">
										<button type="button" className="theme-button" onClick={this.runNow.bind(this, cron.id)}>Run Now</button>
									</td>
								</tr>)
							})
							: false
						}
						<tr>
							<td colSpan="5">
								<button type="button" className="theme-button" onClick={this.addCron.bind(this)}>
									<i className="icon-plus"></i> Add Cron
								</button>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

		</div>)
	}

}

export default Cron
