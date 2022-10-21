import React, { Component } from 'react'
import { connect } from 'react-redux'
import { observer, inject } from 'mobx-react'
import { saveSettings } from '../../actions'
import TimePeriod from '../elements/timePeriod.jsx'
import TimeSlider from '../elements/timeSlider.jsx'

import NodeCharts from '../elements/nodeCharts.jsx'


var currentRequest
	, loadTimeout
	, reloadTimeout

@inject('dataStore')
@observer
class DetailsPane extends React.Component {
	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			tabs: [],
			tabIndex: undefined
		}
	}

	componentDidMount() {
		this.init()
	}


	init() {

		if (!this.dataStore.nodes || Object.keys(this.dataStore.nodes).length == 0) {
			setTimeout(this.init.bind(this), 100)
			return
		}

		var [range, count] = window.timePeriod.interval.split('_')

		this.setState({
			end: window.timePeriod.end,
			interval: window.timePeriod.interval,
			range: range,
			count: parseInt(count),
			offset: 0,
			tabIndex: undefined
		}, () => {

			this.botId = undefined
			this.queueId = undefined

				//which one is a bot?
				; (this.props.userSettings.selected || []).map((selected) => {

					var node = this.dataStore.nodes[selected] || {}

					if (node.type == 'bot') {
						this.botId = selected
						this.bot = node
					} else if (node.type == 'system') {
						this.queueId = "e_" + node.queue;
						this.queue = node;
					}
					else {
						this.queueId = selected
						this.queue = node
					}

				})

			this.node = (this.botId ? this.bot : this.queue)

			this.refreshData()
		})

	}


	refreshData() {
		currentRequest && currentRequest.abort()
		if ((this.botId || this.queueId) && !document.hidden && !this.props.displayPaused) {
			var endTime = moment(window.timePeriod.end).subtract(this.state.offset, window.timePeriod.range.unit).format('YYYY-MM-DD HH:mm:ssZ')
			currentRequest = $.get(`api/dashboard/${encodeURIComponent(this.botId || this.queueId)}?range=${this.state.range}&count=${this.state.count || 1}&timestamp=${encodeURIComponent(endTime)}`, (result) => {
				this.setState({
					data: result
				})
			}).always((xhr, status) => {
				currentRequest = null;
				if (status !== "abort" && status != "canceled") {
					clearTimeout(reloadTimeout)
					reloadTimeout = setTimeout(this.refreshData.bind(this), 10000)
				}
			})
		} else {
			clearTimeout(reloadTimeout)
			reloadTimeout = setTimeout(this.refreshData.bind(this), 10000)
		}
	}


	componentDidUpdate(props) {

		if (
			JSON.stringify(this.props.userSettings.selected) != JSON.stringify(props.userSettings.selected)
			|| (this.state.interval && this.state.interval !== window.timePeriod.interval)
			|| this.state.end !== window.timePeriod.end
		) {
			this.init()
		}

	}


	componentWillUnmount() {

		if (currentRequest) {
			currentRequest.abort();
		}
		clearTimeout(reloadTimeout);

	}


	toggleDetails() {
		this.props.dispatch(saveSettings({ details: false }))
		this.dataStore.changeDetailsBool(false);
	}


	toggleTabs(index) {
		this.setState({ tabIndex: index })
	}


	viewEvents(checkpointData) {
		window.nodeSettings(checkpointData)
	}


	onChange(values) {
		this.setState({ count: values.count, offset: values.offset }, () => {
			this.refreshData()
		})
	}


	render() {

		if (!this.state.data && (this.botId || this.queueId)) {
			return <div className="theme-spinner"></div>
		}

		if (!this.node) {
			return (<div className="theme-color-warning">
				<div className="theme-icon-close" onClick={this.toggleDetails.bind(this)}></div>
				Please make a selection to see details
			</div>)
		}

		var tabIndex = (this.state.tabIndex || 0)
		var tabs = [{
			botId: this.botId,
			label: this.node.label,
			//icon: 'icon-' + ({ event: 'buffer', queue: 'buffer', system: 'database' }[this.node.type] || this.node.type),
			icon: ({ event: 'queue', queue: 'queue', system: 'system' }[this.node.type] || this.node.type),
			type: this.node.type,
			data: this.state.data,
			checkpoint: this.state.data.checkpoint
		}]

		var inOuts = (this.node.type === 'queue'
			? ['write', 'read']
			: ['read', 'write']
		)

			;['bots', 'queues'].forEach((nodeType) => {
				inOuts.forEach((eventType) => {
					if (this.state.data[nodeType] && this.state.data[nodeType][eventType]) {
						Object.keys(this.state.data[nodeType][eventType]).forEach((eventId) => {
							var event = this.state.data[nodeType][eventType][eventId]

							/*
							var writes = {}
							for(var writeId in this.state.data[nodeType]['write']) {
								writes = this.state.data[nodeType]['write'][writeId]
							}
							*/

							if (this.state.tabIndex == undefined && event.id == this.queueId) {
								tabIndex = tabs.length
							}

							var node = this.dataStore.nodes[event.id]
							if (node && node.status !== 'archived' && !node.archived) {

								tabs.push({
									botId: (this.node.type == 'bot' ? this.botId : event.id),
									queueId: (this.node.type !== 'bot' ? this.botId : event.id),
									label: (this.dataStore.nodes[event.id] || {}).label || '',
									//icon: event.type === 'read' ? 'icon-logout' : 'icon-login',
									icon: event.type,
									type: 'queue_' + event.type,
									data: {
										writes: event.values,
										reads: (nodeType === 'queues' ? event.reads : event.values),
										[eventType + '_lag']: event.lags || [],
										compare: event.compare
									},
									lastRead: event.last_read_event_timestamp || 0,
									checkpoint: event.checkpoint,
									checkpointData: {
										id: (this.node.type === 'queue' ? this.queueId : eventId),
										type: 'queue',
										checkpoint: event.checkpoint,
										openTab: 'Events'
									}
								})

							}

						})
					}
				})
			})

		return (<div className="flex-column">
			<div className="details-pane-bottom">
				<div className="theme-icon-close" onClick={this.toggleDetails.bind(this)}></div>
				<div className="theme-tabs">
					<ul>
						{
							tabs.map((tab, index) => {
								return (<li key={index} className={tabIndex == index ? 'active' : ''} onClick={this.toggleTabs.bind(this, index)} title={(tab.type || '').replace('_', ' ').capitalize() + ': ' + tab.label}>
									{/*<i className={tab.icon}></i>*/}
									<img src={window.leostaticcdn + 'images/nodes/' + tab.icon + '.png'} />
									<span>{tab.label}</span>
								</li>)
							})
						}
					</ul>
					<div>
						{
							tabs.map((tab, index) => {
								return (
									tabIndex === index
										? (<div key={index} className="active">
											<div style={{ marginTop: '-1em', height: 20 }}>

												{<TimeSlider onChange={this.onChange.bind(this)} />}

												{
													tab.checkpoint
														? (<div className="event-timestamp pull-right text-ellipsis">
															<label>Event ID</label>
															<a onClick={this.viewEvents.bind(this, tab.checkpointData)}>{tab.checkpoint || ''}</a>
														</div>)
														: false
												}
											</div>
											{
												tabIndex == index
													? <NodeCharts className="node-charts" data={tab.data} nodeType={tab.type} interval={this.state.interval} showHeader="true" lastRead={tab.lastRead} botId={tab.botId} queueId={tab.queueId} />
													: false
											}
										</div>)
										: false
								)
							})
						}
					</div>
				</div>
			</div>
		</div>)

	}

}

export default connect(store => store)(DetailsPane)
