import React, { Component } from 'react'
import { connect } from 'react-redux'
import { inject, observer } from 'mobx-react'

import EventReplay from '../dialogs/eventReplay.jsx'
import PayloadSearch from '../elements/payloadSearch.jsx'
import NoSource from '../elements/noSource.jsx'
import NodeSearch from '../elements/nodeSearch.jsx'

var timeFormat = '/YYYY/MM/DD/HH/mm/'

@inject('dataStore')
@observer
class EventViewer extends React.Component {
	rowHeight = 55
	visibleRowCount = 100

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			eventIndex: 0,
			node: {},
			startRow: 0
		}
	}


	setNode(props) {

		if (Object.keys(this.dataStore.nodes).length === 0) {
			setTimeout(this.setNode.bind(this, props), 100)
		} else {
			let node = this.dataStore.nodes[(props.nodeData || {}).id]
			if (node) {
				this.setState({ node: node })
			}
		}

	}


	componentDidMount() {

		this.setNode(this.props)

	}


	componentWillReceiveProps(props) {

		this.setNode(props)

	}


	componentDidUpdate() {

		//https://clipboardjs.com/
		if (this.clipboard) {
			this.clipboard.destroy()
		}
		this.clipboard = new Clipboard('.copy-button', {
			text: function (trigger) {
				return $('pre#data-to-copy').text()
			}
		}).on('success', function (e) {
			window.messageLogNotify('Payload copied')
		}).on('error', function (e) {
			window.messageLogNotify('Error copying payload', 'error')
		})

		if ($(document.activeElement).hasClass('theme-dialog')) {
			$('.event-viewer input').focus()
		}

		this.adjustScrollFiller()

	}


	componentWillUnmount() {

		if (this.currentRequest) {
			this.currentRequest.abort()
		}

		if (this.clipboard) {
			this.clipboard.destroy()
		}

		this.payloadSearch = undefined

	}


	toggleDetail(index) {
		$('tr.current-payload div').slideUp(400)
		setTimeout(() => {
			this.setState({ eventIndex: (this.state.eventIndex === index ? 0 : index) }, () => {
				$('tr.current-payload div').slideDown()
			})
		}, $('tr.current-payload div').length > 0 ? 400 : 0)
	}


	startReplay(detail, index) {
		this.setState({ replay: detail })
	}


	startTrace(source, start, index, event) {
		event.stopPropagation()
		this.setState({ eventIndex: index })
		$('.event-viewer > div').addClass('theme-spinner-large')
		this.currentRequest = $.get(window.api + '/trace/' + encodeURIComponent(source) + '/' + encodeURIComponent(start), (response) => {
			window.startTrace({
				source: source,
				start: start,
				response: response
			})
			$('.event-viewer > div').removeClass('theme-spinner-large')
		}).fail((result) => {
			result.call = window.api + '/trace/' + encodeURIComponent(source) + '/' + encodeURIComponent(start)
			var nodeId = (Object.keys(this.dataStore.nodes).filter(node => this.dataStore.nodes[node].id === (this.dataStore.nodes[node].type + ':' + source)) || [])[0]
			window.messageLogModal('Failure starting trace on ' + (this.dataStore.nodes[nodeId] || {}).type + ' "' + (this.dataStore.nodes[nodeId] || {}).label + '"', 'error', result)
			$('.event-viewer > div').removeClass('theme-spinner-large')
		})
	}


	continueSearch(event) {
		var scrollTop = $(event.currentTarget).scrollTop()
			, startRow = Math.floor((scrollTop / (this.rowHeight * (this.visibleRowCount / 3))) * (this.visibleRowCount / 3)) || 0
		if (startRow !== this.state.startRow) {
			this.adjustScrollFiller(startRow)
			this.setState({ startRow: startRow }, () => {
				if ($('.infiniteScroll').scrollTop() == $('.infiniteScroll')[0].scrollHeight - $('.infiniteScroll').height()) {
					this.payloadSearch.wrappedInstance.continueSearch()
				}
			})
		}
	}


	returnEvents(events, status) {
		if (events) {
			this.setState({ events: events, status: status })
		} else {
			this.setState({ status: status })
		}
	}


	onKeyDown(event) {

		switch (event.keyCode) {
			case 38: //up
				this.upAndDown(Math.max(0, --this.state.eventIndex))
				break

			case 40: //down
				if (this.state.events && this.state.events.length) {
					this.upAndDown(Math.min(this.state.events.length - 1, ++this.state.eventIndex))
				}
				break
		}

	}


	upAndDown(eventIndex) {

		this.setState({ eventIndex: eventIndex }, () => {

			setTimeout(() => {
				this.movingUpAndDown = undefined
				var table = $('.event-viewer table')
				if (table.length && table.find('tr.active').length) {
					table.stop(true).animate({
						scrollTop: (table.find('tr.active').position().top + table[0].scrollTop - table.find('thead').height() - table.height() / 2 + table.find('tr.active').height() / 2)
					}, 'fast')
				}
			}, 0)

		})

	}


	showEvents(queue) {
		this.setState({ node: queue }, () => {
			$('.event-viewer input').focus()
		})
	}


	adjustScrollFiller(startRow) {
		startRow = startRow || this.state.startRow
		var $element = $('.infiniteScroll')
		this.rowHeight = ($element.find('.filler-top').next().height() || 55)
		$element.find('.filler-top').css({ height: this.rowHeight * startRow })
		$element.find('.filler-bottom').css({ height: this.rowHeight * ((this.state.events || []).length - startRow - this.visibleRowCount) })
	}


	render() {

		let calendarFormats = {
			sameDay: 'h:mm:ss a',
			lastDay: '[Yesterday,] h:mm:ss a',
			sameElse: 'MMM D, h:mm:ss a'
		};

		let node = this.state.node;
		let serverId = (node.type === 'system') ? node.queue : node.id;

		if (this.props.trace && node && node.id) {
			node = this.dataStore.nodes[node.id];
		}

		return (<div className="event-viewer">

			<div className="flex-column height-1-1" onKeyDown={this.onKeyDown.bind(this)} tabIndex="-3">
				<div className="flex-row mobile-flex-wrap" style={{ margin: '10px 0 20px 0', alignItems: 'flex-start' }}>
					{
						this.props.tracePage
							? (<div className="no-wrap" style={{ marginRight: 20 }}>
								<label className="theme-title">Selected Queue</label>
								<NodeSearch value={this.state.queueId} icon="icon-down-dir" className="black down-arrow display-inline-block margin-0-5 align-middle" placeholder="Search..." nodeType="queues" onChange={this.showEvents.bind(this)} />
							</div>)
							: false
					}
					<PayloadSearch ref={(me) => { this.payloadSearch = me }} hideSearch={!node.id} eventId={this.props.nodeData.checkpoint} serverId={serverId} returnEvents={this.returnEvents.bind(this)} lastWrite={node.latest_write} timeFrames={['30s', '1m', '5m', '1hr', '6hr', '1d', '1w']} />
				</div>

				{
					!node.id

						? (<div style={{ width: 550, height: 250, margin: '30vh auto', maxWidth: '100%' }}>
							<svg width="550" height="250" style={{ maxWidth: '100%', maxHeight: 'none' }}>
								<NoSource root={this.props.userSettings.node} transform={'translate(' + Math.min(window.innerWidth / 2, 275) + ',' + Math.min(window.innerHeight / 2, 250) + ')'} />
							</svg>
						</div>)

						: (<div className="flex-row height-1-1 flex-wrap overflow-auto">

							<div className="flex-auto width-1-2 mobile-height-1-2">

								<div className="theme-table-fixed-header theme-table-overflow-hidden">
									<table className="infiniteScroll" onScroll={this.continueSearch.bind(this)}>
										<thead>
											<tr>
												<th className="text-left width-1-2">Event Id</th>
												<th>Event Created</th>
												<th>Source Time</th>
												<th className="two-icons">&nbsp;</th>
											</tr>
										</thead>
										<tbody>
											<tr className="filler-top">
												<td className="width-1-2" />
												<td colSpan="3" />
											</tr>
											{
												this.state.events
													? this.state.events.slice(this.state.startRow, this.state.startRow + this.visibleRowCount).map((detail, index) => {
														index += this.state.startRow

														return (<tr key={index} onClick={this.toggleDetail.bind(this, index)} className={(this.state.eventIndex === index ? 'active' : 'cursor-pointer')}>
															<td className="width-1-2 user-selectable">{detail.eid || 'Unspecified'}</td>
															<td>{detail.timestamp ? moment(detail.timestamp).calendar(null, calendarFormats) : 'Unspecified'}</td>
															<td>{detail.event_source_timestamp ? moment(detail.event_source_timestamp).calendar(null, calendarFormats) : 'Unspecified'}</td>
															<td className="two-icons">
																<div>
																	{
																		detail.correlation_id
																			? (<a onClick={this.startTrace.bind(this, detail.event, detail.eid, index)} className="event-viewer-action-button" title="trace">
																				<i className="icon-flash" style={{ fontSize: '1.25em' }}></i>
																			</a>)
																			: <span></span>
																	}
																	{
																		!this.props.hideReply
																			? <a onClick={this.startReplay.bind(this, detail, index)} className="event-viewer-action-button" title="replay">
																				<i className="icon-ccw" style={{ fontSize: '1.25em' }} />
																			</a>
																			: false
																	}
																</div>
															</td>
														</tr>)
													})
													: false
											}

											<tr className="filler-bottom">
												<td className="width-1-2" />
												<td colSpan="3" />
											</tr>

											{
												this.state.status
													? (<tr>
														<td colSpan="4">
															<div className="text-center" style={{ lineHeight: '2.125em' }}>{this.state.status}</div>
														</td>
													</tr>)
													: false
											}

										</tbody>
									</table>

								</div>

							</div>

							<div className="width-1-2 flex-column position-relative mobile-height-1-2">

								<div className="theme-table-column-header width-1-1">
									Payload
							</div>

								<div className="flex-auto">
									{
										this.state.events
											? this.state.events.map((detail, index) => {
												if (this.state.eventIndex === index) {

													detail = $('<div/>').text(JSON.stringify(detail, null, 4)).html()

													var detailSearch = detail
													var detailString = detail

														;[
															's3:\/\/(.*?)\/(.*?\/z\/.*)',
															'"[bB]ucket":\\s*"(.*?)",\\s*"[kK]ey":\\s*"(.*?\/z\/.*?)"'
														].forEach((re) => {

															var linkRegEx = new RegExp(re, 'g')
																, matches
																, link
															while ((matches = linkRegEx.exec(detailSearch)) !== null) {
																link = encodeURI('https://console.aws.amazon.com/s3/buckets/' + matches[1] + '/' + matches[2] + '/details?region=us-west-2&tab=overview')
																detailString = detailString.replace(matches[0], '<a href="' + link + '" target="_blank">' + matches[0] + '</a>')
															}
														})

													return (<div key="index" className="current-payload">
														<button type="button" id="copy-button" data-clipboard-target="#data-to-copy" className="copy-button theme-button">Copy to Clipboard</button>
														<pre id="data-to-copy" className="user-selectable pre-wrap" dangerouslySetInnerHTML={{ __html: detailString }}></pre>
													</div>)
												}
											})
											: false
									}
								</div>
							</div>

						</div>)
				}

			</div>
			}

			{
				this.state.replay
					? <EventReplay detail={this.state.replay} onClose={() => { this.setState({ replay: undefined }) }} />
					: false
			}

		</div>)

	}

}

export default connect(store => store)(EventViewer)
