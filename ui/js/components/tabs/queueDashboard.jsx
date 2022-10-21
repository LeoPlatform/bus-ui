import React, { Component } from 'react'
import { connect } from 'react-redux'
import { inject, observer } from 'mobx-react'

import NodeCharts from '../elements/nodeCharts.jsx'
import NodeChart from '../elements/nodeChart.jsx'
import NodeIcon from '../elements/nodeIcon.jsx'
import TimePicker from '../elements/timePicker.jsx'

var reloadTimeout;
var currentRequest;

var timePeriods = { 'minute_15': '15m', 'hour': '1h', 'hour_6': '6h', 'day': '1d', 'week': '1w' }

@inject('dataStore')
@observer
class QueueDashboard extends React.Component {


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			interval: 'minute_15',
			lagEvents: {}
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


	lagEvents(refId, eventCount) {
		var lagEvents = this.state.lagEvents
		lagEvents[refId] = eventCount
		this.setState({ lagEvents: lagEvents })
	}


	render() {

		let nodeData = this.dataStore.nodes[this.props.nodeData.id] || this.props.nodeData || {}
			, queueId = nodeData.id;

		return (<div className="node-dashboard">
			<div className="flex-column height-1-1">

				<div className="clear-fix flex-row flex-spread">

					<div className="node-name">
						<small> Last event written {nodeData.latest_write ? moment(nodeData.latest_write).fromNow() : ': unknown'}</small>
					</div>

					<div className="flex-grow"></div>

					<TimePicker active={timePeriods[this.state.interval]} onClick={this.changeInterval.bind(this)} />

				</div>

				<div className="flex-row overflow-auto flex-grow flex-wrap flex-shrink position-relative" style={{ maxHeight: 'calc(100% - 210px)' }}>

					<div className="flex-grow">

						<table className="theme-table width-1-1 mobile-flex-table">
							<caption>Events Written by a Bot to this {nodeData.type}</caption>
							<thead>
								{
									!this.state.data || Object.keys(this.state.data.bots.write).length == 0
										? <tr><td /></tr>
										: (<tr>
											<th>Bots</th>
											<th></th>
											<th></th>
											<th>Events Written</th>
										</tr>)
								}
							</thead>
							<tbody>
								{
									!this.state.data || Object.keys(this.state.data.bots.write).length == 0
										? (<tr>
											<td colSpan="5" className="text-center">No Sources</td>
										</tr>)
										: Object.keys(this.state.data.bots.write).map((botId) => {
											var bot = this.state.data.bots.write[botId]

											if (!this.dataStore.nodes[bot.id] || this.dataStore.nodes[bot.id].status === 'archived' || this.dataStore.nodes[bot.id].archived) {
												return false
											}

											var eventsWritten = bot.values.reduce(function(total, value) {
												return total + (value.value || 0)
											}, 0)

											return (<tr key={botId} className="theme-tool-tip-wrapper">
												<td className="no-wrap">
													<NodeIcon node={bot.id} />
													<a onClick={() => {
														this.props.onClose && this.props.onClose()
														window.nodeSettings({
															id: bot.id,
															label: this.dataStore.nodes[bot.id].label,
															server_id: botId,
															type: 'bot'
														})
													}}>{this.dataStore.nodes[bot.id].label}</a>
												</td>
												<td onClick={window.jumpToNode.bind(this, bot.id, this.props.onClose)}>
													<a><i className="icon-flow-branch"></i></a>
												</td>
												<td className="position-relative">
													<div className="theme-tool-tip">
														<span>{this.dataStore.nodes[bot.id].label}</span>
														<div>
															<label>Events Written</label>
															<span>{eventsWritten}</span>
														</div>
													</div>
													<NodeChart data={bot.values} chartKey="Events Written" interval={this.state.interval} className="width-1-1" />
												</td>
												<td>{eventsWritten}</td>
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
						<table className="theme-table width-1-1 mobile-flex-table">
							<caption>Events Read by a Bot from this {nodeData.type}</caption>
							<thead>
								{
									!this.state.data || Object.keys(this.state.data.bots.read).length == 0
										? (<tr><td /></tr>)
										: (<tr>
											<th>Bots</th>
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
									!this.state.data || Object.keys(this.state.data.bots.read).length == 0
										? (<tr>
											<td colSpan="8" className="text-center">No Destinations</td>
										</tr>)
										: Object.keys(this.state.data.bots.read).map((botId) => {
											var bot = this.state.data.bots.read[botId]

											if (!this.dataStore.nodes[bot.id] || this.dataStore.nodes[bot.id].status == 'archived' || this.dataStore.nodes[bot.id].archived) {
												return false
											}

											var eventsRead = bot.values.reduce(function(total, value) {
												return total + (value.value || 0)
											}, 0)

											var lastReadLag = bot.last_read_lag ? (moment.duration(bot.last_read_lag).humanize() + " ago").replace("a few ", "") : ""

											var lagTime = bot.last_event_source_timestamp_lag ? (moment.duration(bot.last_event_source_timestamp_lag).humanize() + " ago").replace("a few ", "") : ""

											return (<tr key={botId}>
												<td className="no-wrap" className="theme-tool-tip-wrapper">
													<NodeIcon node={bot.id} />
													<a onClick={() => {
														this.props.onClose && this.props.onClose()
														window.nodeSettings({
															id: bot.id,
															label: this.dataStore.nodes[bot.id].label,
															server_id: botId,
															type: 'bot'
														})
													}}>{this.dataStore.nodes[bot.id].label}</a>
												</td>
												<td onClick={window.jumpToNode.bind(this, bot.id, this.props.onClose)}>
													<a><i className="icon-flow-branch"></i></a>
												</td>

												<td className="position-relative">

													<div className="theme-tool-tip">
														<span>{this.dataStore.nodes[bot.id].label}</span>
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
															<span>{bot.lagEvents}</span>
														</div>
													</div>

													<NodeChart data={bot.values} chartKey="Events In Queue" interval={this.state.interval} className="width-1-1" lastRead={bot.last_read || 0} />
												</td>
												<td>{eventsRead}</td>
												<td>{lastReadLag}</td>
												<td>{lagTime}</td>
												<td>{bot.lagEvents}</td>
											</tr>)
										})
								}
							</tbody>
						</table>
					</div>
				</div>

				{
					!this.state.data
						? false
						: <NodeCharts className="node-charts" data={this.state.data} nodeType="queue" interval={this.state.interval} showHeader="true" />
				}

			</div>

		</div>)

	}

}

export default connect(store => store)(QueueDashboard)
