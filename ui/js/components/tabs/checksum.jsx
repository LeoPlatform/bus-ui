import React, { Component } from 'react'
import {observer, inject } from 'mobx-react'
import NodeIcon from '../elements/nodeIcon.jsx'
import _ from 'lodash';
let refUtil = require("leo-sdk/lib/reference.js");

@inject('dataStore')
@observer
class Checksum extends React.Component {

	systems = {};

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		for (let node in this.dataStore.nodes) {
			if (this.dataStore.nodes[node].type === 'system') {
				this.systems['s_' + this.dataStore.nodes[node].id] = this.dataStore.nodes[node].label;
			}
		}

		this.state = {
			checksums: {},
			sampleData: {}
		};
	}


	componentWillMount() {
        if(!this.refreshRequest) {
            this.dataStore.getChecksums(this.props.nodeData, this.dataStore.nodes);
            this.refreshRequest = setInterval(() => {this.dataStore.getChecksums(this.props.nodeData, this.dataStore.nodes)}, 1000 * 5);
        }
	}


	componentWillUnmount() {
		clearInterval(this.refreshRequest);
	}


	runNow(botId) {
		$.post(window.api + '/cron/save', JSON.stringify({ id: botId, executeNow: true }), (response) => {
            this.dataStore.runNow = botId;
			window.messageLogNotify('Checksum run triggered on ' + this.dataStore.nodes[botId].label)
		}).fail((result) => {
			window.messageLogModal('Failure triggering checksum run on ' + this.dataStore.nodes[botId].label, 'error', result)
		})
	}


	restartNow(botId) {
		$.post(window.api + '/cron/save', JSON.stringify({ id: botId, executeNow: true, checksumReset: true }), (response) => {
            this.dataStore.runNow = false;
            window.messageLogNotify('Checksum restart triggered on ' + this.dataStore.nodes[botId].label);
		}).fail((result) => {
			window.messageLogModal('Failure triggering checksum restart on ' + this.dataStore.nodes[botId].label, 'error', result)
		})
	}



	showSampleData(columnName, botId) {
		let data = this.dataStore.checksums[botId].sample[columnName];
			return (<div>
				{
					data.length
					? data.map((data, ndex) => {
						return (<div key={ndex}>
							<div>ID: {data.id || data}</div>

							{columnName === 'incorrect' ? (
                                <table>
								<thead>
									<tr>
										<td>column</td>
										{
											data.diff && Object.keys(data.diff).length > 0
											? Object.keys(data.diff).map((diffId, index) => {
												if (index > 0) {
													return false
												}
												return Object.keys(data.diff[diffId]).map((systemId) => {
													return (<th key={systemId}>{systemId}</th>)
												})
											})
											: false
										}
									</tr>
								</thead>
								<tbody>
									{
										data.diff && Object.keys(data.diff).length > 0
										? Object.keys(data.diff).map((diffId) => {
											return (<tr key={diffId}>
												<td>{diffId}</td>
												{
													Object.keys(data.diff[diffId]).map((systemId) => {
														return (<th key={systemId}>{data.diff[diffId][systemId] === null ? 'NULL' : data.diff[diffId][systemId]}</th>)
													})
												}
											</tr>)
										})
										: (<tr><td>No differences</td></tr>)
									}
								</tbody>
							</table>)
								: ''}
						</div>)
					})
					: (<div>No differences</div>)
				}
			</div>)
	}

	render() {

		return (<div className="height-1-1 flex-column">

			<div className="theme-table-fixed-header height-1-1">
				<table className="width-1-1">
					<thead>
						<tr>
							{this.props.nodeData.type === 'bot' ? false : <th>Sync'd System</th>}
							<th className="width-1-3">Status</th>
							<th>Last Run</th>
							<th>Correct</th>
							<th>Incorrect</th>
							<th>Missing</th>
							<th>Extra</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{
							Object.keys(this.dataStore.checksums).sort((a, b) => {
								return this.dataStore.checksums[a].label.localeCompare(this.dataStore.checksums[b].label)
							}).map((checksumId, index) => {

								let checksum = this.dataStore.checksums[checksumId];

                                let system = (this.dataStore.nodes[checksum.system] || {});

                                let startTime = moment(checksum.startTime)
								,   startTimeFormatted = startTime.calendar(null, {
										sameDay: 'h:mm a [Today]',
										nextDay: 'h:mm a MM-DD-YYYY',
										nextWeek: 'h:mm a MM-DD-YYYY',
										lastDay: 'h:mm a [Yesterday]',
										lastWeek: 'h:mm a MM-DD-YYYY',
										sameElse: 'h:mm a MM-DD-YYYY'
									});

								return (<tr key={index}>
                                    {this.props.nodeData.type === 'bot' ? false :
										<td>
											<a className="theme-link flex-row flex-wrap" onClick={() => {
                                                let bot = this.dataStore.nodes[checksum.bot_id];
                                                window.subNodeSettings({
                                                    id: checksum.bot_id,
                                                    label: bot.label,
                                                    type: bot.type,
                                                    server_id: bot.id
                                                }, true)
                                            }}>
												<NodeIcon className="theme-image-thumbnail margin-0-5" node={system}/>
												<div className="display-inline-block overflow-hidden"
													 style={{maxWidth: '10vw'}}>
                                                    {checksum.label}
													<small className="display-block">
														System: {system.label || ''}</small>
												</div>
											</a>
										</td>
                                    }
									<td className="width-1-3">
										{
											(() => {
												switch(checksum.status) {
													case 'running':
														return (<div>
															<span className="theme-color-success">{(checksum.status || '').capitalize()}: </span>
															{
																true
																? (<div className="theme-progress-bar display-inline-block width-1-2">
																	<span style={{ width: checksum.log.percent + '%' }}></span>
																	<span>{checksum.log.percent}%</span>
																</div>)
																: <progress className="theme-progress width-1-2" value={checksum.log.percent} max="100"></progress>
															}
															<small className="display-block">
																Correct: {(checksum.log.correct || {}).count || '-'},
																Incorrect: {(checksum.log.incorrect || {}).count || '-'},
																Missing: {(checksum.log.missing || {}).count || '-'},
																Extra: {(checksum.log.extra || {}).count || '-'}
															</small>
														</div>)
													break

													case 'starting':
													case 'initializing':
														return (<div>
															<span className="theme-color-success">{(checksum.status || '').capitalize()}: </span>
															<div className="theme-progress-bar display-inline-block width-1-2"></div>
															<small className="display-block">&nbsp;</small>
														</div>)
													break

													case 'error':
														return (<div>
															<span className="theme-color-primary">{(checksum.status || '').capitalize()}</span>
															<small className="display-block">{checksum.statusReason || ''}&nbsp;</small>
														</div>)
													break

													default:
														return (<div>
															<span className="theme-color-primary">{(checksum.status || '').capitalize()}</span>
															<small className="display-block">&nbsp;</small>
														</div>)
													break
												}

											})()
										}
									</td>
									<td>
										{checksum.startTime ? startTime.fromNow() : 'never'}
										<small className="display-block">{checksum.startTime ? startTimeFormatted : '-'}</small>
										<small className="display-block">Duration: {humanize(moment.duration((checksum.endTime || moment.now()) - checksum.startTime))}</small>
									</td>
									<td>
										{checksum.totals.correct || '-'}
										<small className="display-block">{checksum.total ? Math.round(checksum.totals.correct / checksum.total * 10000)/100 + '%' : '-'}</small>
									</td>
									<td className="hover-tool-tip">
										{checksum.totals.incorrect || '-'}
										<small className="display-block">{checksum.total ? Math.round(checksum.totals.incorrect / checksum.total * 10000)/100 + '%' : '-'}</small>
										<dd>{this.showSampleData('incorrect', checksum.bot_id)}</dd>
									</td>
									<td className="hover-tool-tip">
										{checksum.totals.missing || '-'}
										<small className="display-block">{checksum.total ? Math.round(checksum.totals.missing / checksum.total * 10000)/100 + '%' : '-'}</small>
										<dd>{this.showSampleData('missing', checksum.bot_id)}</dd>
									</td>
									<td className="hover-tool-tip">
										{checksum.totals.extra || '-'}
										<small className="display-block">{checksum.total ? Math.round(checksum.totals.extra / checksum.total * 10000)/100 + '%' : '-'}</small>
										<dd>{this.showSampleData('extra', checksum.bot_id)}</dd>
									</td>
									<td className="text-center">
										{
											checksum.status && checksum.status != 'complete'
											? (<button type="button" className="theme-button-tiny margin-2" onClick={this.restartNow.bind(this, checksum.bot_id)}>
												<i className="icon-refresh" /> Restart
											</button>)
											: (<button type="button" className="theme-button-tiny margin-2" onClick={this.runNow.bind(this, checksum.bot_id)}>
												<i className="icon-play" /> Run Now
											</button>)
										}
									</td>
								</tr>)
							})
						}
					</tbody>
				</table>
			</div>
			{
				this.state.showSettings || this.state.showSettings == 0
				? <ChecksumSettings checksum={this.dataStore.checksums[this.state.showSettings || 0]} systems={this.systems} />
				: false
			}

		</div>)
	}

}

export default Checksum
