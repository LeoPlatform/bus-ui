import React, { Component } from 'react'
import { connect } from 'react-redux'
import {inject, observer} from 'mobx-react'
import {toJS} from 'mobx'
import { saveSettings } from '../../actions'
import moment from 'moment';
import NodeIcon from '../elements/nodeIcon.jsx'
import MuteButton from '../elements/muteButton.jsx'
import TimePeriod from '../elements/timePeriod.jsx'
import NodeSearch from '../elements/nodeSearch.jsx'

@inject('dataStore')
@observer
class DashboardView extends React.Component {

	alarmedColumns = {
		readLag: 'Source Lag',
		writeLag: 'Write Lag',
		errorCount: 'Errors',
	};

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		if (!this.dataStore.hasData) {
			this.dataStore.getStats();
		}

		this.state = {
            showSearchBox: false,
        }

        $(window).keydown((event) => {
            if (event.target.tagName != 'INPUT' && event.target.tagName != 'TEXTAREA' && $('.theme-modal, .theme-dialog').length == 0) {
                if (
                    (65 <= event.keyCode && event.keyCode <= 90 && !event.ctrlKey) //letters
                    || (48 <= event.keyCode && event.keyCode <= 57 && !event.shiftKey) //numbers
                ) {
                    this.toggleSearchBox(true)
                }
            }
        })

		$(window).on('resize', this.updateDonuts.bind(this))
	}


	componentDidMount() {
		this.updateDonuts()
	}


	componentDidUpdate() {
		this.updateDonuts()
	}


	componentWillUnmount() {
		$(window).off('resize', this.updateDonuts.bind(this))

	}


	updateDonuts() {

		$('.js-circle-chart').each(function() {
			var wrapper = $(this)
			,	canvas = wrapper.find('canvas')
			,	size = wrapper.width()
			,	borderWidth = Math.floor(size / 10)
			,	center = size / 2
			, 	radius = (center - borderWidth)
			,	pos = -Math.PI * .5
			,	parts = JSON.parse(wrapper.attr('data-parts'))
			,	gap = Object.keys(parts).length > 1 ? .025 : 0

			if (!canvas.length) {
				canvas = $('<canvas></canvas>').css({ position: 'absolute', left: 0, top: 0, })
				wrapper.prepend(canvas).css({ position: 'relative' })
			}
			canvas.attr({ width: size, height: size })

			var context = canvas[0].getContext('2d')
			context.clearRect(0, 0, size, size)
			context.lineWidth = borderWidth
			for(var color in parts) {
				if (parts[color]) {
					context.beginPath()
					context.strokeStyle = color
					context.arc(center, center, radius, pos, pos += (Math.PI * 2) * (parts[color] / 100) - gap)
					context.stroke()
					pos += gap
				}
			}
		})
    }

	showDialog(dialogName) {

		switch(dialogName) {
			case 'addCard':

				LeoKit.prompt('Add Card', 'Select tag', this.dataStore.availableTags, {
					OK: (formData) => {
						let tagName = formData.prompt_value
						,	tagCards = this.dataStore.tagCards;
						if (!(tagName in tagCards)) {
							tagCards[tagName] = {};
							localStorage.setItem('tagCards', JSON.stringify(tagCards));
							this.dataStore.tagCards = tagCards;
						}
					},
					Cancel: false
				});

			break
		}

	}

    toggleSearchBox(show) {
        this.setState({ showSearchBox: show }, () => {
            $('.searchBox').focus()
        })
    }


	deleteCard(tagName, event) {
		event.stopPropagation();
		LeoKit.confirm('Delete "' + tagName + '"?', () => {
			let tagCards = this.dataStore.tagCards;
			delete tagCards[tagName];
			localStorage.setItem('tagCards', JSON.stringify(tagCards));
            this.dataStore.tagCards = tagCards;
		})
	}


	sorting(sortBy) {
		this.dataStore.sortBy = sortBy;
		this.dataStore.sortDir = (sortBy === this.dataStore.sortBy && this.dataStore.sortDir !== 'asc' ? 'asc' : 'desc');
		this.dataStore.alarmed = this.dataStore.sortAlarmed();
	}


	filterByTag(tagName) {
		this.dataStore.filterByTag = (this.dataStore.filterByTag === tagName ? undefined : tagName);
	}


	refreshData(event) {
		let button = event.currentTarget;
		$(button).css({ opacity: .25 }).attr('disabled', true);
		this.dataStore.getStats();
		setTimeout(() => {
			$(button).css({ opacity: 1 }).removeAttr('disabled')
		}, 500)
	}

	render() {
        let alarmedPercent = (this.dataStore.alarmedCount / this.dataStore.activeBotCount * 100) || 0;
		let activePercent = (100 - alarmedPercent);
        let alarmedBots = (this.dataStore.filterByTag
			? this.dataStore.alarmed.filter((node, index) => {
				return !((node.tags || '').toString().toUpperCase().split(/,\s*/).filter(tag => tag).indexOf(this.dataStore.filterByTag) === -1)
			})
			: this.dataStore.alarmed
		);

        var nodeSearch = <div className="theme-icon-group pull-left control searchDisappear">
            {
                this.state.showSearchBox
					? <NodeSearch settings={'true'} toggleSearchBox={this.toggleSearchBox.bind(this)} className="black left-icon" placeholder="Search..." />
                    : (<div className="theme-autocomplete black left-icon">
						<input type="search" name="undefined" className="searchBox theme-form-input" placeholder="Search..." value="" autoComplete="off" onClick={this.toggleSearchBox.bind(this, true)} onKeyDown={this.toggleSearchBox.bind(this, true)} />
						<i className="search-icon icon-search" />
					</div>)
            }
		</div>

		return (
            this.dataStore.totalEvents === null
            ? <div className="theme-spinner-large" />
            :
		    <div className="dashboard-view">

			<div className="width82 order-1">
				<div className="theme-panel" style={{ margin: '0 20px 20px 0' }}>

					<div>
                        {
                            nodeSearch
                        }
						<button type="button" className="theme-button-small pull-right" onClick={this.refreshData.bind(this)}>
							<i className="icon-refresh" /> Refresh
						</button>
						<TimePeriod
							className="control pull-right timePickerDisappear"
							defaults={this.dataStore.urlObj.timePeriod}
							intervals={['minute_15', 'hour', 'hour_6', 'day']}
							onChange={this.dateRangeChanged}
							singleField="true"
							spread="false"
							pauseButton="true"
						/>
					</div>

					<div className="current-status">
						<div>
							<div className="theme-card">
								<div className="theme-card-title">Total Events</div>
								<div className="big-number green">{this.dataStore.totalEvents ? numeral(this.dataStore.totalEvents).format('0,0') : ''}</div>
							</div>

							<div className="theme-card">
								<div className="theme-card-title">Bots</div>
								<div className="js-circle-chart" data-parts={JSON.stringify( alarmedPercent ? { '#EF6374': alarmedPercent, '#71AA30': activePercent } : { '#71AA30': activePercent })}>
									{
										this.dataStore.alarmedCount
										? (<div>
											<span className="big-number red">{this.dataStore.alarmedCount || ''}</span>
											<span className="text-sub"> / {this.dataStore.activeBotCount || '0'}</span>
											<div className="theme-big-label">alarmed</div>
										</div>)
										: <span className="big-number green">{this.dataStore.activeBotCount || ''}</span>
									}
								</div>
							</div>
						</div>
					</div>

				</div>
			</div>



			<div className="width18 height-1-2-dash order-3">
				<div className="theme-panel height-1-1 border-box flex-column">

					<div className="flex-row space-between">
						<span className="theme-title green">Tagged Bots</span>
						<div className="theme-icon-group control position-relative">
							<i className="icon-plus" onClick={this.showDialog.bind(this, 'addCard')} />
						</div>
					</div>

					<div className="flex-row flex-wrap height-1-1 overflow-auto padding-2" style={{ placeItems: 'start center', placeContent: 'start center', margin: '20px -10px 0 -10px' }}>

					{

						Object.keys(this.dataStore.tagCards).map((tagName) => {

							var tagCard = this.dataStore.tagCards[tagName]
							,	alarmedPercent = (tagCard.alarmed / tagCard.active) * 100
							,	activePercent = (100 - alarmedPercent)

							return (<div className={'theme-card cursor-pointer' + (tagName === this.dataStore.filterByTag ? ' active' : '')} key={tagName} onClick={this.filterByTag.bind(this, tagName)}>

								<div className="flex-row space-between theme-card-title small">
									<div className="text-ellipsis">{tagName}</div>
									<i className="icon-cog force-right" onClick={this.deleteCard.bind(this, tagName)} />
								</div>

								<div className="js-circle-chart tiny" data-parts={JSON.stringify( alarmedPercent ? { '#EF6374': alarmedPercent, '#71AA30': activePercent } : { '#71AA30': 100 })}>
								{
									tagCard.alarmed
									? (<div>
										<span className="small-number red">{tagCard.alarmed || ''}</span>
										<span className="text-small text-sub"> / {tagCard.active || '0'}</span>
										<div className="theme-small-label">alarmed</div>
										</div>)
										: <span className="small-number green">{tagCard.active || ''}</span>
									}
								</div>

							</div>)

						})

					}

					</div>

				</div>

			</div>

			<div className="width18 height-1-2-dash order-3">
				<div className="theme-panel height-1-1 border-box flex-column">

					<div className="flex-row space-between" style={{cursor: "pointer"}} onClick={() => {
                        this.props.dispatch(saveSettings({ selected: ["queue:BotChangeLog"] }));
                        this.dataStore.changeSelected("queue:BotChangeLog");
                        let node = this.dataStore.nodes["queue:BotChangeLog"];
                        window.nodeSettings({
                            id: "queue:BotChangeLog",
                            label: node.label,
                            server_id: node.id,
                            type: node.type,
                            logs: node.logs
                        })
                    }}>
						<span className="theme-title green">Recent Change Log</span>
						<NodeIcon node={"queue:BotChangeLog"} size={'32px'}/>
					</div>

					<div className="change-log-table">
						<table>
							<thead>
							{
                                this.dataStore.changeLog ?
									<tr>
										<th>Bot Name</th>
										<th>Date</th>
									</tr>
									:false
							}
							</thead>
							<tbody>
                            {
                                this.dataStore.changeLog && this.dataStore.changeLog.map((row, i) => {
                                	let botName = (row.payload && row.payload.new && row.payload.new.name !== '' && row.payload.new.name !== null && row.payload.new.name !== undefined)? row.payload.new.name : row.payload.new.id;
                                    let timeStamp = row.timestamp;
                                    let formattedTime = moment(timeStamp).format("hh:mm:ss A");
                                    let formattedTime2 = moment(timeStamp).format("MM/DD/YYYY");
                                    let today = moment(moment.now()).format("MM/DD/YYYY");
									if (today !== formattedTime2) {
                                        formattedTime = formattedTime + " " + formattedTime2;
                                    }
                                    return (
										<tr key={i}>
											<td>{botName}</td>
											<td>{formattedTime}</td>
											<div className="theme-tool-tip2">
												<table className="change-log-tableHover">
													<thead>
														<tr>
															<th>Field</th>
															<th>Old</th>
															<th></th>
															<th>New</th>
														</tr>
													</thead>
													<tbody>
														{
															row.payload && row.payload.diff && row.payload.diff.map((change, i) => {
																let objKey = Object.keys(toJS(change))[0];
																let oldChange = change[objKey].old === '' ? 'NULL' : change[objKey].old;
																let newChange = change[objKey].new === '' ? 'NULL' : change[objKey].new;
																return (
																	<tr key={i}>
																		<td>{objKey}</td>
																		<td>{oldChange}</td>
																		<td>=></td>
																		<td>{newChange}</td>
																	</tr>
																)
															})
														}
													</tbody>
												</table>
											</div>
										</tr>
                                    )
                                })
                            }
							</tbody>
						</table>

					</div>

				</div>

			</div>

			<div className="width82 dashboard-table-wrapper order-2">
				<div className="theme-panel overflow-hidden flex-column height-1-1 border-box">

					<div style={{ paddingBottom: 20 }}>
						<span className="theme-title red">
							Muted & Alarmed Bots
						{
							this.dataStore.filterByTag
							? ' Filtered by "' + this.dataStore.filterByTag + '"'
							: false
						}
						</span>
						<span className="theme-red-bubble" data-count={alarmedBots.length}></span>
					</div>

					<div className="theme-table-fixed-header-wrap">

						<table>
							<thead>
								<tr>
									<th className={'text-left sortable wide-column ' + (this.dataStore.sortBy === 'name' ? this.dataStore.sortDir : '')} onClick={this.sorting.bind(this, 'name')}>Bot Name</th>
									<th className="two-icons"></th>
									{
										Object.keys(this.alarmedColumns).map((key) => {
											return (<th key={key} className={'text-center sortable ' + (this.dataStore.sortBy === key ? this.dataStore.sortDir : '')} onClick={this.sorting.bind(this, key)}>{this.alarmedColumns[key]}</th>)
										})
									}
								</tr>
							</thead>
							<tbody>
								{
									alarmedBots.map((node, index) => {
										let nodeId = node.id;
										let muted = false;
                                        if(this.dataStore.nodes && this.dataStore.nodes[nodeId] && this.dataStore.nodes[nodeId].health && this.dataStore.nodes[nodeId].health.mute) {
                                            if(this.dataStore.nodes[nodeId].health.mute !== true && this.dataStore.nodes[nodeId].health.mute !== false) {
                                                if(this.dataStore.nodes[nodeId].health.mute <= moment.now()) {
                                                    muted = false;
                                                } else {
                                                    muted = this.dataStore.nodes[nodeId].health.mute;
                                                }
                                            } else {
                                                muted = this.dataStore.nodes[nodeId].health.mute;
                                            }
                                        }
										return (<tr key={node.id || index}>
											<td className="wide-column position-relative pointer" title={node.label}
												onClick={() => {
                                                    this.props.dispatch(saveSettings({ selected: [nodeId] }));
                                                    this.dataStore.changeSelected(nodeId);
                                                    let node = this.dataStore.nodes[nodeId];
                                                    window.nodeSettings({
                                                        id: node.id,
                                                        label: node.label,
                                                        server_id: node.id,
                                                        type: node.type,
                                                        logs: node.logs
                                                    })
                                                }}>
												<NodeIcon node={node.id} size={'32px'} className='dashBotImg'/>

												<div className="flex-row space-between">

													<span className="text-ellipsis overflow-hidden display-inline-block">{node.label}</span>
												</div>

												<div className="no-tags theme-tags left-padding-40">
													{
														node.tags.map((tag, index) => {
                                                            let leoClass = this.dataStore.nodes[node.id].owner === 'leo' ? 'leoOwned' : '';
                                                            return (<span key={index} className={leoClass}>{tag}</span>)
														})
													}
												</div>

												<div className="theme-tool-tip">
													<span>{node.label}</span>
													{
														Object.keys(this.alarmedColumns).map((key) => {
															return (<div key={key} className="position-relative">
																<label>{this.alarmedColumns[key]}</label>
																<div className="health-state display-table-cell">
																{
																	node[key]
																	? (<div>
																		<div>{node[key].red}</div>
																		<div className="gray-text">{node[key].gray}</div>
																	</div>)
																	: ''
																}
																</div>
															</div>)
														})
													}
												</div>

											</td>
											<td className="two-icons">
												<a onClick={() => {
													this.props.dispatch(saveSettings({ node: node.id, selected: [node.id], view: 'node', offset: [0,0] }))
												}}>
													<i className="icon-flow-branch"/>
												</a>
												<MuteButton mute={muted} id={nodeId} onUpdate={() => {this.setState({ updated: Date.now() }); }} />
											</td>

											{/*<td className="one-icon">*/}
												{/*{node.hasSLA ? <i className="icon-exclamation theme-color-warning" /> : ''}*/}
											{/*</td>*/}

											{/*<td>{node.events || ''}</td>*/}

											{
												Object.keys(this.alarmedColumns).map((key) => {
													return (<td key={key} className="position-relative">

														<div className="health-state">
															{
																(node[key] && node[key].gray)
																? (
																	(key === 'errorCount') ?
																		(
																			<div>
																			<div>{node[key].red} <span className="gray-text">/{node.executions}</span></div>
																				<div className="gray-text">{node[key].gray}</div>
																			</div>
																		)
																		:
																		<div>
																			<div>{node[key].red}</div>
																			<div className="gray-text">{node[key].gray}</div>
																		</div>
																	)
																: false
															}
														</div>
													</td>)
												})
											}

										</tr>)
									})
								}
							</tbody>
						</table>

					</div>
				</div>
			</div>

		</div>)


	}


}

export default connect(store => store)(DashboardView)