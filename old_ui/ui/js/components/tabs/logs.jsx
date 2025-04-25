import React, { Component } from 'react';
import moment from 'moment';
import refUtil from "leo-sdk/lib/reference.js";
import { inject, observer } from 'mobx-react'

import TimePicker from '../elements/timePicker.jsx'

var reloadTimeout;
var currentRequest;

@inject('dataStore')
@observer
class Logs extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			logs: false,
			active: -1,
			timeFrame: '5m'
		};

		if (this.dataStore.cronInfo === null) {
			this.dataStore.getCron(props.nodeData.id);
		}
		currentRequest = this.dataStore.getLogs(props.nodeData.id, this.dataStore.cronInfo);
	}


	componentDidMount() {

		$('#logsDateTimePicker').datetimepicker({
			sideBySide: true,
			maxDate: moment().endOf('d'),
			defaultDate: moment()
		})

	}


	refreshData() {
		if (currentRequest) {
			currentRequest.abort()
		}

		this.setState({ logs: false })
		let queryString = this.state.customTimeFrame
			? this.state.customTimeFrame
			: moment().subtract(this.state.timeFrame.slice(0, 1), this.state.timeFrame.slice(-1)).valueOf();
		this.dataStore.logId = this.dataStore.cronInfo.lambdaName || (this.dataStore.cronInfo.templateId !== 'Leo_core_custom_lambda_bot' ? this.dataStore.cronInfo.templateId : null) || refUtil.botRef(this.dataStore.cronInfo.id).id;
		this.dataStore.getLogs(this.dataStore.logId, this.dataStore.cronInfo, queryString);
	}


	componentWillUnmount() {
		clearTimeout(reloadTimeout)
		if (currentRequest) {
			currentRequest.abort()
		}
	}


	formatTime(timestamp, baseTime) {
		var milliseconds = (baseTime
			? moment(timestamp).diff(baseTime)
			: moment().diff(timestamp)
		)

		return [
			(milliseconds >= 1000 ? window.humanize(milliseconds) : numeral((milliseconds / 1000) % 1).format('.0') + 's'),
			''
		]

		return [
			(numeral(Math.floor(milliseconds / 1000)).format('00:00:00') + (milliseconds >= 1000 ? '' : numeral((milliseconds / 1000) % 1).format('.0'))).replace(/^0:/, '').replace(/^00:/g, '').replace(/^00\./g, '.'),
			(milliseconds >= 60000 ? '' : 'seconds')
		]
	}


	toggleMessage(key, event) {
		event.stopPropagation()
		this.setState({ activeMessage: key })
	}


	showDetails(index, log) {
		this.dataStore.active = index;
		this.dataStore.logDetails = (log.details || false);
		if (!log.details) {
			if (currentRequest) {
				currentRequest.abort()
			}
			currentRequest = $.get(`api/logs/${(this.dataStore.logId)}/${this.dataStore.logSettings.isTemplated ? encodeURIComponent(this.dataStore.logSettings.id) : 'all'}`, log, (details) => {
				details.logs.forEach((detail) => {
					detail.timeAgo = this.formatTime(detail.timestamp, log.timestamp)
				})
				let logs = this.dataStore.logs;
				logs[index].details = details;
				this.dataStore.logDetails = details;
				this.dataStore.logs = logs;
			}).fail((result) => {
				result.call = `api/logs/${(this.dataStore.logId)}/${this.dataStore.logSettings.isTemplated ? encodeURIComponent(this.dataStore.logSettings.id) : 'all'}`
				window.messageLogModal('Failure retrieving details ' + this.props.nodeData.label, 'warning', result)
			}).always(() => {
				currentRequest = null;
			})
		}
	}


	selectTimeFrame(timeFrame, event) {
		timeFrame = timeFrame.replace('hr', 'h')
		this.setState({ customTimeFrame: undefined, timeFrame: timeFrame }, () => {
			this.refreshData()
		})
	}


	customTimeFrame(event) {
		this.setState({ customTimeFrame: moment($('[name=customTimeFrame]').val(), 'MM/DD/YYYY h:mm A').valueOf() }, () => {
			this.refreshData()
		})
		$('#logsDateTimePicker').data("DateTimePicker").hide()
	}


	datePicker(date) {
		this.setState({ timeFrame: undefined, customTimeFrame: moment(date, 'MM/DD/YYYY h:mm A').valueOf() }, () => {
			this.refreshData()
		})
	}


	render() {

		if (!this.dataStore.logSettings) {
			return <div>No Logs Available</div>
		}

		return (<div className="height-1-1 flex-column position-relative">

			<div>
				{
					((this.props.nodeData.logs || {}).notices || []).map((notice, i) => {
						return (
							notice.msg
								? <div key={i} className={"notice-message" + (i === this.state.activeMessage ? ' active' : '')} onClick={this.toggleMessage.bind(this, i)}>
									<span className="theme-badge-warning">Notice:</span>
									{
										i === this.state.activeMessage
											? <i className="icon-cancel pull-right padding-10 theme-color-danger cursor-pointer" title="close" onClick={this.toggleMessage.bind(this, -1)}></i>
											: false
									}
									<pre>{notice.msg}</pre>
								</div>
								: false
						)
					})
				}
			</div>

			<div className="timeframe-search-bar text-right padding-10-0">
				<TimePicker onRefresh={this.refreshData.bind(this)} datePicker={this.datePicker.bind(this)} customTimeFrame={this.state.customTimeFrame} timeFrames={['30s', '1m', '5m', '1hr', '6hr', '1d', '1w']} active={this.state.timeFrame} onClick={this.selectTimeFrame.bind(this)} />
			</div>

			<div className="log-results flex-row flex-shrink height-1-1 border-box">
				{
					this.dataStore.logs && this.dataStore.logs.length
						? <div className="height-1-1 border-box">
							<div className="theme-table-fixed-header theme-table-dark theme-table-auto">
								<table>
									<thead>
										<tr>
											<th className="text-left">Run time</th>
										</tr>
									</thead>
									<tbody>
										{
											this.dataStore.logs.length > 0
												? this.dataStore.logs.map((log, index) => {
													return (<tr key={index} className={this.dataStore.active == index ? 'active' : ''} onClick={this.showDetails.bind(this, index, log)}>
														<td className={this.dataStore.active == index ? 'xarrow-inset-right' : 'cursor-pointer'}>
															<strong className="font-11em">{log.timeAgo[0]}</strong> <span className="font-dim">{log.timeAgo[1]} ago</span>
															<div className="font-dim">{moment(log.timestamp).format()}</div>
														</td>
													</tr>)
												})
												: false
										}
									</tbody>
								</table>
							</div>
						</div>
						: false
				}

				<div className="width-1-1">
					{
						this.dataStore.logs && this.dataStore.logs.length
							? (<div className="theme-table-fixed-header">
								<table>
									<thead>
										<tr>
											<th className="detail-timestamp">Timestamp</th>
											<th>Message</th>
										</tr>
									</thead>
									<tbody>
										{
											this.dataStore.logDetails && this.dataStore.logDetails.logs
												? (this.dataStore.logDetails.logs || []).map((detail, key) => {
													return (<tr key={key}>
														<td className="detail-timestamp text-top">
															<strong className="font-11em">{detail.timeAgo[0]}</strong> <span className="font-dim">{detail.timeAgo[1]} after</span>
															<div className="font-dim">{moment(detail.timestamp).format()}</div>
														</td>
														<td className="text-top user-selectable">{detail.message}</td>
													</tr>)
												})
												: <tr><td><div className="theme-spinner" /></td></tr>
										}
									</tbody>
								</table>
							</div>)
							: (
								this.dataStore.logs
									? <strong>No Logs Found</strong>
									: <div className="theme-spinner-large" />
							)
					}
				</div>
			</div>
		</div>)
	}

}
export default Logs
