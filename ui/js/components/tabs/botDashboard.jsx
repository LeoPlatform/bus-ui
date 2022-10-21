import React, { Component } from 'react'
import { connect } from 'react-redux'
import { inject, observer } from 'mobx-react'

import NodeChart from '../elements/nodeChart.jsx'
import NodeCharts from '../elements/nodeCharts.jsx'
import TimePicker from '../elements/timePicker.jsx'

let reloadTimeout;
let currentRequest;

let timePeriods = { 'minute_15': '15m', 'hour': '1h', 'hour_6': '6h', 'day': '1d', 'week': '1w' };

@inject('dataStore')
@observer
class BotDashboard extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			interval: 'minute_15',
			isPaused: (this.props.nodeData.settings || {}).paused
		}
		this.refreshData = this.refreshData.bind(this);
		this.refreshData();
	}


	refreshData() {
		if (currentRequest) {
			currentRequest.abort();
		}
		var range_count = this.state.interval.split('_')
		currentRequest = $.get(`api/dashboard/${encodeURIComponent(this.props.nodeData.id)}?range=${range_count[0]}&count=${range_count[1] || 1}&timestamp=${encodeURIComponent(moment().format())}`, (result) => {
			this.setState({
				data: result
			});
		}).always((xhr, status) => {
			currentRequest = null;
			if (status !== "abort" && status != "canceled") {
				clearTimeout(reloadTimeout);
				reloadTimeout = setTimeout(this.refreshData, 10000);
			}
		});
	}

	componentWillUnmount() {
		clearTimeout(reloadTimeout);
		if (currentRequest) {
			currentRequest.abort();
		}
	}


	changeInterval(interval, event) {
		if (event) {
			event.preventDefault()
		}
		interval = Object.keys(timePeriods).filter(tp => (timePeriods[tp] == interval))[0]
		this.setState({ interval: interval }, this.refreshData)
	}

	render() {

		let nodeData = this.props.nodeData;
		let botId = nodeData.id;
		let periodOfEvents = '';
		switch (this.state.interval) {
			case 'minute_15':
				periodOfEvents = '(45 Minutes)';
				break;

			case 'hour':
				periodOfEvents = '(3 Hours)';
				break;

			case 'hour_6':
				periodOfEvents = '(18 Hours)';
				break;

			case 'day':
				periodOfEvents = '(3 Days)';
				break;

			case 'week':
				periodOfEvents = '(3 Weeks)';
				break;
		}

		return (<div className="node-dashboard">
			<div className="flex-column height-1-1">

				<div className="flex-row flex-wrap flex-spread">
					<div className="flex-grow"></div>
					<TimePicker active={timePeriods[this.state.interval]} onClick={this.changeInterval.bind(this)} />
				</div>

				<div className="flex-row overflow-auto flex-grow flex-wrap flex-shrink position-relative" style={{ maxHeight: 'calc(100% - 210px)' }}>

					<div className="flex-grow">
						<table className="theme-table width-1-1 mobile-flex-table">
							<caption>Events Read by Bot</caption>
							<thead>
								{
									Object.keys(((this.state.data || {}).queues || {}).read || {}).length == 0
										? <tr><td></td></tr>
										: (<tr>
											<th>Queues</th>
											<th></th>
											<th></th>
											<th>Events Read</th>
											<th>Last Read</th>
											<th>Lag Time</th>
											<th>Lag Events</th>
										</tr>)
								}
							</thead>
							<tbody>
								{
									!this.state.data || Object.keys((this.state.data.queues || {}).read || {}).length == 0
										? (<tr>
											<td colSpan="8" className="text-center">No Sources</td>
										</tr>)
										: Object.keys(this.state.data.queues.read).filter(c => !!c && c !== 'undefined' && c !== 'queue:undefined').map((queueId) => {
											var queue = this.state.data.queues.read[queueId];
											var node = this.dataStore.nodes[queue.id];
											if (!node || node.status === 'archived' || node.archived) {
												return false
											}
											var eventsRead = queue.reads.reduce(function(total, read) {
												return total + (read.value || 0)
											}, 0)

											var lastReadLag = queue.last_read_lag ? (moment.duration(queue.last_read_lag).humanize() + " ago").replace("a few ", "") : ''
											var lagTime = queue.last_event_source_timestamp_lag ? (moment.duration(queue.last_event_source_timestamp_lag).humanize() + " ago").replace("a few ", "") : ''

											return (<tr key={queueId} className="theme-tool-tip-wrapper">
												<td className="no-wrap">
													<img src={window.leostaticcdn + 'images/nodes/queue.png'} />
													<a onClick={() => {
														this.props.onClose && this.props.onClose()
														window.nodeSettings({
															id: queue.id,
															label: this.dataStore.nodes[queue.id].label,
															server_id: queueId,
															type: 'queue'
														})
													}}>{this.dataStore.nodes[queue.id].label}</a>
												</td>
												<td onClick={window.jumpToNode.bind(this, queue.id, this.props.onClose)}>
													<a><i className="icon-flow-branch"></i></a>
												</td>
												<td className="position-relative">

													<div className="theme-tool-tip">
														<span>{this.dataStore.nodes[queue.id].label}</span>
														<div>
															<label>Events Read</label>
															<span>{eventsRead}</span>
														</div>
														<div>
															<label>Last Read</label>
															<span>{lastReadLag}</span>
														</div>
														<div>
															<label>Lag Time</label>
															<span>{lagTime}</span>
														</div>
														<div>
															<label>Lag Events</label>
															<span>{queue.lagEvents}</span>
														</div>
													</div>

													<NodeChart data={queue.values} chartKey="Events In Queue" interval={this.state.interval} className="width-1-1" lastRead={queue.last_read_event_timestamp || 0} />
												</td>
												<td>{eventsRead}</td>
												<td>{lastReadLag}</td>
												<td>{lagTime}</td>
												<td>{queue.lagEvents}</td>
											</tr>)
										})
								}
							</tbody>
						</table>
					</div>

					{
						!this.state.data
							? <div className="theme-spinner-large"></div>
							: <div className="margin-10 mobile-hide">&nbsp;</div>
					}

					<div className="flex-grow">
						<div>
							<table className="theme-table width-1-1 mobile-flex-table">
								<caption>Events Written by Bot</caption>
								<thead>
									{
										Object.keys(((this.state.data || {}).queues || {}).write || {}).length == 0
											? (<tr><td></td></tr>)
											: (<tr>
												<th>Queues</th>
												<th></th>
												<th></th>
												<th>{`Events Written ${periodOfEvents}`}</th>
											</tr>)
									}
								</thead>
								<tbody>
									{
										!this.state.data || Object.keys((this.state.data.queues || {}).write || {}).length == 0
											? (<tr>
												<td colSpan="5" className="text-center">No Destinations</td>
											</tr>)
											: Object.keys(this.state.data.queues.write).map((queueId) => {
												var queue = this.state.data.queues.write[queueId];
												var node = this.dataStore.nodes[queue.id];
												if (!node || node.status === 'archived' || node.archived) {
													return false
												}
												var eventsWritten = queue.values.reduce(function(total, value) {
													return total + (value.value || 0)
												}, 0)

												return (<tr key={queueId} className="theme-tool-tip-wrapper">
													<td className="no-wrap">
														<img src={window.leostaticcdn + 'images/nodes/queue.png'} />
														<a onClick={() => {
															this.props.onClose && this.props.onClose()
															window.nodeSettings({
																id: queue.id,
																label: this.dataStore.nodes[queue.id].label,
																server_id: queueId,
																type: 'queue'
															})
														}}>{this.dataStore.nodes[queue.id].label}</a>
													</td>
													<td onClick={window.jumpToNode.bind(this, queue.id, this.props.onClose)}>
														<a><i className="icon-flow-branch"></i></a>
													</td>
													<td className="position-relative">

														<div className="theme-tool-tip">
															<span>{this.dataStore.nodes[queue.id].label}</span>
															<div>
																<label>Events Written</label>
																<span>{eventsWritten}</span>
															</div>
														</div>

														<NodeChart data={queue.values} chartKey="Events Written" interval={this.state.interval} className="width-1-1" />

													</td>
													<td>
														{eventsWritten}
													</td>
												</tr>)
											})
									}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{
					!this.state.data
						? false
						: <NodeCharts className="node-charts" data={this.state.data} nodeType="bot" interval={this.state.interval} showHeader="true" botId={botId} />
				}

			</div>

		</div>)

	}

}

export default connect(store => store)(BotDashboard)
