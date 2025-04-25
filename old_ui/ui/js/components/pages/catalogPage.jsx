import React, { Component } from 'react'
import { connect } from 'react-redux'
import { inject, observer } from 'mobx-react'
import { saveSettings } from '../../actions'

import NodeSearch from '../elements/nodeSearch.jsx'
import NodeIcon from '../elements/nodeIcon.jsx'
import NoSource from '../elements/noSource.jsx'
import TimePeriod from '../elements/timePeriod.jsx'
const humanize = require("../../../../lib/humanize.js");


@inject('dataStore')
@observer
class ListView extends React.Component {

	index = -1;
	rowHeight = 57;
	visibleRowCount = 100;


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = props.searches.current || { show: ['queue', 'bot', 'system'], bot: [], system: [], statuses: ['!archived'] };

		this.state.startRow = 0;
		this.state.archive = false;

		if (!this.dataStore.hasData) {
			this.dataStore.getStats();
		}
	}

	componentWillUpdate(props) {

		this.tableData = this.getFilteredTableData({ show: this.state.show });
	}


	componentDidUpdate() {

		this.adjustScrollFiller()

	}


	adjustScrollFiller() {
		var startRow = this.state.startRow
			, $element = $('.bot-list')
		this.rowHeight = ($element.find('.filler-top').next().height() || 55)
		$element.find('.filler-top').css({ height: this.rowHeight * startRow })
		$element.find('.filler-bottom').css({ height: this.rowHeight * ((this.tableData || []).length - startRow - this.visibleRowCount) })
	}


	handleScroll() {
		var scrollTop = $('.bot-list table').scrollTop()
			, startRow = Math.floor((scrollTop / (this.rowHeight * (this.visibleRowCount / 3))) * (this.visibleRowCount / 3)) || 0
		if (startRow !== this.state.startRow && !this.movingUpAndDown) {
			this.setState({ startRow: startRow }, () => {
				this.adjustScrollFiller()
			})
		} else {
			this.adjustScrollFiller()
		}
	}


	selectSort(index) {
		//var settings = this.props.userSettings
		this.index = -1

		this.props.searches.current.sort = {
			direction: (this.props.searches.current.sort.index === index && this.props.searches.current.sort.direction === 'asc') ? 'desc' : 'asc',
			index: index
		}

		this.tableData = this.getFilteredTableData({ show: this.state.show });
		setTimeout(() => {
			this.setState({ scrolled: true })
		})
	}


	getFilteredTableData(filters, filteredIds) {
		if (this.dataStore.hasData) {

			filteredIds = filteredIds || this.state.searchResults

			var columns = (node) => {
				let source_lag = (node.queues && node.queues.read && node.queues.read.last_source_lag) || 0;
				let write_lag = (node.queues && node.queues.write && node.queues.write.last_write_lag) || 0;
				return [
					node.label,
					node.tags,
					'',
					node.description,
					{
						bot: node => node.last_run.start,
						queue: node => node.latest_write,
						system: node => node.last_in_time
					}[node.type](node),
					node.errors,
					{
						bot: node => node.queues.read.events,
						queue: node => node.bots.read.events,
						system: node => node.bots.read.events
					}[node.type](node),
					{
						bot: node => node.queues.write.events,
						queue: node => node.bots.write.events,
						system: node => node.bots.write.events
					}[node.type](node),
					node.details.executions,
					source_lag,
					write_lag
				]
			};

			var tableData = Object.keys(this.dataStore.nodes).filter((id) => {
				var node = this.dataStore.nodes[id] || {}

				if (
					(node
						&& (
							((node.status === 'archived' || node.archived) && !this.state.archive)
							|| (node.type === 'system' && this.state.system.length !== 0 && this.state.system.indexOf((node.settings || {}).system) === -1)
							|| (node.type === 'bot' && this.state.bot.length !== 0 && this.state.bot.indexOf(((window.templates || [])[node.templateId] || {}).name || '') == -1)
						)
					)
					|| (filteredIds && filteredIds.indexOf(id) == -1)
				) {
					return false
				}

				return filters.show.indexOf(node.type) != -1
			}).map((id) => {
				var node = this.dataStore.nodes[id]
				return {
					id: id,
					type: node.type,
					label: node.label,
					status: node.status,
					system: node.system,
					templateId: node.templateId,
					columns: columns(node)
				}
			})

			tableData.sort((a, b) => {

				if (this.props.searches.current.sort.direction == 'asc') {
					var first = a.columns[this.props.searches.current.sort.index],
						second = b.columns[this.props.searches.current.sort.index]
				} else {
					var first = b.columns[this.props.searches.current.sort.index],
						second = a.columns[this.props.searches.current.sort.index]
				}

				switch (typeof (first || second)) {
					default:
					case 'number':
						if (first === undefined) {
							first = -1;
						}
						return ((first || 0) - (second || 0));
						break;

					case 'string':
						return (first || '').localeCompare(second || '');
						break;
				}
			});

			if (this.index === -1) {
				tableData.forEach((tableRow, index) => {
					if ((this.props.userSettings.selected || [])[0] === tableRow.id) {
						this.index = index
					}
				})
			}

			return tableData
		}
	}


	toggleNodeFilter(type, subtype, event) {
		event.stopPropagation()

		this.index = -1
		var show = this.state.show
		var subtypes = []
		var newState = {}

		if (!type) {
			show = (show.length === 3 ? [] : ['queue', 'bot', 'system'])
			newState = { system: [], bot: [] }
		} else if (!subtype) {
			if (!(this.state[type] || []).length) {
				if (show.length == 3) {
					show = [type]
				} else {
					if (show.indexOf(type) != -1) {
						show.splice(show.indexOf(type), 1)
					} else {
						show.push(type)
					}
				}
			} else {

			}
		} else {
			if (show.length === 3) {
				show = [type]
			} else if (show.indexOf(type) == -1) {
				show.push(type)
			}
			subtypes = this.state[type] || []
			if (subtypes.indexOf(subtype) != -1) {
				subtypes.splice(subtypes.indexOf(subtype), 1)
			} else {
				subtypes.push(subtype)
			}
			if (
				(type == 'system' && subtypes.length == Object.keys(this.props.systemTypes).length)
				|| (type == 'system' && subtypes.length == Object.keys(window.templates || []).length)
			) {
				subtypes = []
			}
		}

		if (show.length === 0) {
			show = ['queue', 'bot', 'system']
		}

		newState.show = show
		this.props.searches.current.show = show
		if (type) {
			newState[type] = subtypes
			this.props.searches.current[type] = subtypes
		}

		this.setState(newState, () => {
			this.upAndDown(0)
		})
	}


	toggleArchived() {
		this.index = -1
		this.setState({ archive: !this.state.archive }, () => {
			this.props.searches.current.archive = this.state.archive
		})
		this.props.searches.current.archive = !this.state.archive
	}


	searchResults(results, searchText) {
		this.index = -1
		this.setState({
			text: searchText,
			searchResults: results
		}, this.upAndDown.bind(this, 0))
		this.props.searches.current.text = searchText
	}


	upAndDown(direction) {
		if (this.tableData) {
			this.index = (direction == 0) ? 0 : Math.min(this.tableData.length - 1, Math.max(0, this.index + direction))
			if (this.tableData[this.index]) {
				this.dataStore.changeSelected(this.tableData[this.index].id);
				this.props.dispatch(saveSettings({ selected: [this.tableData[this.index].id] }))

				var startRow = this.state.startRow
				if (
					(this.index > (startRow + this.visibleRowCount))
					|| (this.index < startRow)
				) {
					startRow = this.index - this.visibleRowCount / 2
				}

				this.movingUpAndDown = true

				this.setState({ startRow: startRow }, () => {

					setTimeout(() => {
						this.movingUpAndDown = undefined
						var table = $('.bot-list table')
						if (table.length && table.find('tr.active').length) {
							table.stop(true).animate({
								scrollTop: (table.find('tr.active').position().top + table[0].scrollTop - table.find('thead').height() - table.height() / 2 + table.find('tr.active').height() / 2)
							}, 'fast')
						}
					}, 0)

				})

			}
		}
	}


	selectNode(nodeId) {
		this.dataStore.changeAllStateValues([nodeId], this.dataStore.urlObj.timePeriod, 'node', [0, 0], nodeId, this.dataStore.zoom, this.dataStore.details);
		this.props.dispatch(saveSettings({ node: nodeId, selected: [nodeId], view: 'node', offset: [0, 0] }))
	}

	filterByStatus(status) {
		var statuses = this.state.statuses || []
		if (statuses.indexOf(status) !== -1) {
			statuses.splice(statuses.indexOf(status), 1, '!' + status)
		} else if (statuses.indexOf('!' + status) !== -1) {
			statuses.splice(statuses.indexOf('!' + status), 1)
		} else {
			statuses.push(status)
		}
		this.props.searches.current.archive = true
		this.setState({ statuses: statuses, archive: true });
	}


	render() {
		let tableData = this.tableData || [];

		let allNodes = (this.state.show.length == 3);

		let index = 0;
		let settings = this.props.userSettings;
		let statuses = this.state.statuses || [];

		this.formats = [];

		return (<div className="list-view">

			<div className="top-controls button-group">

				<NodeSearch className="control" searchResults={this.searchResults.bind(this)} upAndDown={this.upAndDown.bind(this)} showArchived={this.state.archive} placeholder="filter..." searchText={this.state.text} />

				<div className={'control dropdown-checkboxes' + (this.state.show.indexOf('queue') != -1 ? ' active ' : '')}>
					<span onClick={this.toggleNodeFilter.bind(this, 'queue', false)}>
						<input type="checkbox" checked={this.state.show.indexOf('queue') != -1} readOnly disabled={allNodes} />
						<img className="theme-image-tiny theme-white-out" src={window.leostaticcdn + 'images/nodes/queue.png'} />
						<span className="node-type-name">Queues</span>
					</span>
				</div>

				<div className={"control dropdown-checkboxes theme-dropdown-left " + (this.state.show.indexOf('bot') != -1 ? (!this.state.bot.length ? ' active' : ' partly') : '')}>

					<span onClick={this.toggleNodeFilter.bind(this, 'bot', false)}>
						<input type="checkbox" checked={this.state.show.indexOf('bot') != -1 || this.state.bot.length} readOnly disabled={this.state.bot.length} />
						<img className="theme-image-tiny theme-white-out" src={window.leostaticcdn + 'images/nodes/bot.png'} />
						<span className="node-type-name">Bots</span>
						<i className="icon-down-dir" />
					</span>

					<ul>
						<li className={this.state.bot.length ? '' : 'active'} onClick={this.toggleNodeFilter.bind(this, 'bot', false)}>
							<input type="checkbox" checked={this.state.show.indexOf('bot') != -1 && !this.state.bot.length} disabled={allNodes} readOnly /> All
						</li>
						{
							window.templates
								? Object.keys(window.templates).map((template, key) => {
									var templateName = window.templates[template].name
									return (<li key={key} className={this.state.bot.indexOf(templateName) !== -1 ? 'active' : ''} >
										<label> <input type="checkbox" checked={this.state.show.indexOf('bot') != -1 && (!this.state.bot.length || this.state.bot.indexOf(templateName) != -1)} onChange={this.toggleNodeFilter.bind(this, 'bot', templateName)} /> {templateName} </label>
									</li>)
								})
								: false
						}
					</ul>

				</div>

				<div className={"control dropdown-checkboxes theme-dropdown-left " + (this.state.show.indexOf('system') != -1 ? (!this.state.system.length ? ' active' : ' partly') : '')}>

					<span onClick={this.toggleNodeFilter.bind(this, 'system', false)}>
						<input type="checkbox" checked={this.state.show.indexOf('system') != -1 || this.state.system.length} readOnly disabled={this.state.system.length || allNodes} />
						<img className="theme-image-tiny theme-white-out" src={window.leostaticcdn + 'images/nodes/system.png'} />
						<span className="node-type-name">Systems</span>
						<i className="icon-down-dir" />
					</span>

					<ul>
						<li className={this.state.system.length ? '' : 'active'} onClick={this.toggleNodeFilter.bind(this, 'system', false)}>
							<input type="checkbox" checked={this.state.show.indexOf('system') != -1 && !this.state.system.length} disabled={allNodes} readOnly /> All
						</li>
						{
							this.props.systemTypes
								? Object.keys(this.props.systemTypes).map((system, key) => {
									return (<li key={key} className={this.state.system.indexOf(system) !== -1 ? 'active' : ''} >
										<label> <input type="checkbox" checked={this.state.show.indexOf('system') != -1 && (!this.state.system.length || this.state.system.indexOf(system) != -1)} onChange={this.toggleNodeFilter.bind(this, 'system', system)} /> {system} </label>
									</li>)
								})
								: false
						}
					</ul>

				</div>

				{
					localStorage.getItem('enableBetaFeatures') === 'alpha'

						? (<div className={"control dropdown-checkboxes theme-dropdown-left " + (statuses.length ? (statuses.length === 4 ? ' active' : ' partly') : '')}>

							<span>
								<i className="icon-cogs" />
								<span className="node-type-name">{(statuses.join(', ').replace(/^!archived$/, 'Default').replace(/!/g, 'Not ') || 'All')}</span>
								<i className="icon-down-dir" />
							</span>

							<ul>

								<li key="0" className={(statuses.includes('archived') || statuses.includes('!archived') ? 'active' : '')} >
									<label onClick={this.filterByStatus.bind(this, 'archived')}>
										<i className="icon-archive" /> {statuses.includes('!archived') ? 'Not Archived' : 'Archived'}
									</label>
								</li>

								<li key="1" className={(statuses.includes('errored') || statuses.includes('!errored') ? 'active' : '')} >
									<label onClick={this.filterByStatus.bind(this, 'errored')}>
										<i className="icon-bug" /> {statuses.includes('!errored') ? 'Not In Error' : 'In Error'}
									</label>
								</li>

								<li key="2" className={(statuses.includes('alarmed') || statuses.includes('!alarmed') ? 'active' : '')} >
									<label onClick={this.filterByStatus.bind(this, 'alarmed')}>
										<i className="icon-exclamation" /> {statuses.includes('!alarmed') ? 'Not Alarmed' : 'Alarmed'}
									</label>
								</li>

								<li key="3" className={(statuses.includes('paused') || statuses.includes('!paused') ? 'active' : '')} >
									<label onClick={this.filterByStatus.bind(this, 'paused')}>
										<i className="icon-pause" /> {statuses.includes('!paused') ? 'Not Paused' : 'Paused'}
									</label>
								</li>

							</ul>

						</div>)

						: (<div className={'control dropdown-checkboxes' + (this.state.archive ? ' active ' : '')}>
							<label>
								<input className="display-none" type="checkbox" checked={!!this.state.archive} onChange={this.toggleArchived.bind(this)} />
								<i className="icon-archive" />
								<span className="node-type-name">Archived</span>
							</label>
						</div>)

				}

				<div className="theme-icon-group control pill mobile-hide" title="Save this search">
					<i className="icon-bookmark" onClick={this.props.searches.save.bind(this, this.state)}></i>
				</div>


				<div className="no-wrap push-right">

					<TimePeriod
						className="control"
						defaults={this.dataStore.urlObj.timePeriod}
						intervals={['minute_15', 'hour', 'hour_6', 'day']}
						onChange={this.dateRangeChanged}
						singleField="true"
						spread="false"
						pauseButton="true"
					/>

					{
						localStorage.getItem('enableBetaFeatures')
							? <div className="theme-icon-group control">
								<i className="icon-plus" onClick={window.createNode} />
							</div>
							: false
					}
				</div>

			</div>

			{
				this.dataStore.hasData
					? (<div className="bot-list theme-table-fixed-header hide-columns-2-3-4-5-7-8">
						<table className="theme-table-overflow-hidden" onScroll={this.handleScroll.bind(this, undefined)}>
							<thead className={"active " + settings.list}>
								<tr>

									{
										['Name', 'Actions', 'Last Action', '# Errors', '# Reads', '# Writes', '# Executions', 'Source Lag', 'Write Lag'].map((columnHeader, i) => {
											if (columnHeader === 'Actions' || columnHeader === 'Last Action') {
												index++;
											}
											let className = (columnHeader !== 'Actions' ? 'sortable ' : '') + (this.props.searches.current.sort.index === index++ ? this.props.searches.current.sort.direction : '') + ((columnHeader[0] === '#' || columnHeader[0] === 'S' || columnHeader[0] === 'W') ? ' text-right' : '');
											return (<th key={i} className={className} onClick={columnHeader !== 'Actions' ? this.selectSort.bind(this, index - 1) : false} title={columnHeader}>
												{columnHeader}
											</th>)
										})
									}

								</tr>
							</thead>
							<tbody>
								<tr className="filler-top">
									<td /><td /><td /><td /><td /><td /><td /><td /><td />
								</tr>
								{
									tableData.slice(this.state.startRow, this.state.startRow + this.visibleRowCount).map((tableRow, key) => {
										let nodeId = tableRow.id,
											node = this.dataStore.nodes[nodeId] || {};

										return (<tr key={nodeId} className={((settings.selected || []).indexOf(nodeId) !== -1 ? 'active' : '') + ((node && node.status === 'paused') ? ' opacity-6' : '')}>
											<td onClick={() => {
												this.props.dispatch(saveSettings({ selected: [nodeId] }));
												this.dataStore.changeSelected(nodeId);
												let node = this.dataStore.nodes[nodeId];
												window.nodeSettings({
													id: nodeId,
													label: node.label,
													server_id: node.id,
													type: node.type,
													logs: node.logs
												})
											}}>
												<NodeIcon node={nodeId} />
												<span>{tableRow.columns[0]}</span>
												<div className="theme-tags left-padding-40">
													{
														(tableRow.columns[1] || '').toString().split(',').filter(t => !t.match(/(^repo:)/)).map((tag, index) => {
															let leoClass = node.owner === 'leo' ? 'leoOwned' : '';
															return <span key={index} className={leoClass}>{tag}</span>
														})
													}
												</div>
											</td>
											<td onClick={this.selectNode.bind(this, nodeId)}>
												<a><i className="icon-flow-branch" /></a>
											</td>
											<td onClick={this.selectNode.bind(this, nodeId)}>
												{tableRow.columns[4] ? moment(tableRow.columns[4]).fromNow() : ''}
											</td>
											<td className="text-right" onClick={this.selectNode.bind(this, nodeId)}>
												<a className="pull-left mobile-show"><i className="icon-flow-branch" /></a>
												{tableRow.columns[5] || tableRow.columns[5] === 0 ? '' + numeral(tableRow.columns[5]).format('0,0') : '-'}
											</td>
											<td className="text-right" onClick={this.selectNode.bind(this, nodeId)}>
												{tableRow.columns[6] || tableRow.columns[6] === 0 ? '' + numeral(tableRow.columns[6]).format('0,0') : ''}
											</td>
											<td className="text-right" onClick={this.selectNode.bind(this, nodeId)}>
												{tableRow.columns[7] || tableRow.columns[7] === 0 ? '' + numeral(tableRow.columns[7]).format('0,0') : ''}
											</td>
											<td className="text-right" onClick={this.selectNode.bind(this, nodeId)}>
												{tableRow.columns[8] || tableRow.columns[8] === 0 ? '' + numeral(tableRow.columns[8]).format('0,0') : '-'}
											</td>
											<td className="text-right" onClick={this.selectNode.bind(this, nodeId)}>
												{(humanize(tableRow.columns[9]) !== 'NaNd' && humanize(tableRow.columns[9]) !== '0s') ? '' + humanize(tableRow.columns[9]) : '-'}
											</td>
											<td className="text-right" onClick={this.selectNode.bind(this, nodeId)}>
												{(humanize(tableRow.columns[10]) !== 'NaNd' && humanize(tableRow.columns[10]) !== '0s') ? '' + humanize(tableRow.columns[10]) : '-'}
											</td>

										</tr>)
									})
								}
								<tr className="filler-bottom">
									<td /><td /><td /><td /><td /><td /><td /><td /><td />
								</tr>
							</tbody>
						</table>
					</div>)
					: (
						tableData
							? (<div style={{ width: 550, height: 250, margin: '30vh auto' }}>
								<svg width="550" height="250" style={{ maxWidth: 'none', maxHeight: 'none' }}>
									<NoSource root={this.props.userSettings.node} transform="translate(275, 250)" />
								</svg>
							</div>)
							: <div className="theme-spinner-large"></div>
					)
			}

		</div>)
	}

}

export default connect(store => store)(ListView)
