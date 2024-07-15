import React, { Component } from 'react'
import { connect } from 'react-redux';
import { inject, observer } from 'mobx-react'
import { saveSettings } from '../../actions'

import NodeSearch from '../elements/nodeSearch.jsx'
import Tree from '../elements/tree.jsx'
import TimePeriod from '../elements/timePeriod.jsx'
import Dialog from '../dialogs/dialog.jsx'
import Footer from '../main/footer.jsx';

@inject('dataStore')
@observer
class NodeView extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;
		this.state = {
			viewEvent: false,
			showSearchBox: false,

			source: {}
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

		this.dataStore.setupURL();
		if (!this.dataStore.hasData) {
			this.dataStore.getStats();
		}
		window.dataStore = Object.assign({}, this.dataStore);
		window.keepTrackRight = {};
		window.keepTrackLeft = {};
		window.collapsedStart = [];
	}


	componentWillMount() {

		window.nodeTree.updateDiagram = (root, force) => {
			window.nodeTree.root = root || window.nodeTree.root
			this.setState({
				root: window.nodeTree.root,
				force: force
			})
		}

	}


	getData(root) {
		if (!root || !(root in this.dataStore.nodes)) {
			return {}
		}

		let node = basicNode(this.dataStore.nodes[root]);

		//Is it in danger?
		function basicNode(node) {
			if (!node) {
				return false
			}

			if (node.icon) {
				icon = node.icon;
			} else {
				var icon = node.type
				switch (node.status) {
					case 'paused':
					case 'archived':
					case 'danger':
					case 'blocked':
						icon += '-' + node.status
					case 'rogue':
						icon += '-' + node.status
						break
				}
				icon += '.png'
			}

			return {
				id: node.id,
				type: node.type,
				system: node.system,
				label: node.label,
				server_id: node.id,
				icon: icon,
				status: node.status,
				above: node.display.above,
				below: node.display.below,
				details: node.details || {},
				message: node.message,
				logs: node.logs,
				kids: [],
				parents: [],
				archived: node.archived,
				paused: node.paused
			};
		}

		function getParents(n, foundNodeList, dataStore, level = 0) {
			var parents = []
			var nId = n.id
			foundNodeList = foundNodeList || { [n.id]: 1 }
			let numberOfParents = Object.keys(n.link_to.parent).length;
			if (numberOfParents > 10) {					
				let basicNodeThing = basicNode({
					id: n.id +'-TooManyParents',
					type: 'infinite',
					label: 'Too many parents refine by searching',
					status: undefined,
					display: {
						above: ['test_above'],
							below: ['test_below'],
					},
					message: undefined,
					archived: false,
					paused: false,
				});
				basicNodeThing.relation = {
					type: 'TooManyParents',
						line: 'dashed_gray',
						above: ['test_relation_above'],
						below: ['test_relation_below'],
				};
				basicNodeThing.kids = [n];
				basicNodeThing.iconOverrides = {
					type: 'icon',
					icon: window.leostaticcdn + (n.type == 'bot' ? 'images/nodes/queue.png' : 'images/nodes/bot.png'),
				};
				parents = [
					basicNodeThing
				]
			} else {
				for (var id in n.link_to.parent) {
					if (n.type === "bot") {
						var bot_id = nId
						var queue_id = id
					} else {
						var bot_id = id
						var queue_id = nId
					}
	
					var parent = basicNode(dataStore.nodes[id])
	
					if (parent && parent.status !== 'archived' && !parent.archived) {
						var link = n.link_to.parent[id]
						//Is it in danger?
						parent.relation = {
							type: link.type,
							line: link.display.line,
							above: link.display.above,
							below: link.display.below
						}
	
						if (!foundNodeList[id]) {
							foundNodeList[id] = 1
							parent.parents = getParents(dataStore.nodes[id], Object.assign({}, foundNodeList), dataStore, ++level)
						} else {
							parent.parents = [{
								id: 'infinite',
								icon: window.leostaticcdn + 'images/icons/infinite.png',
								type: 'infinite',
								kids: [n],
								relation: {
									line: 'dashed_gray'
								}
							}]
						}
						parent.leftCollapsed = (level >= 1 && parent.parents.length > 1);
						parents.push(parent);
					}
				}

			}
			return parents.sort((a, b) => {
				return a.label.localeCompare(b.label)
			})

		}

		function getKids(n, foundNodeList, dataStore, level = 0) {
			var kids = []
			var nId = n.id
			foundNodeList = foundNodeList || { [n.id]: 1 }

			// Limit the number of children that we are rendering
			let numberOfChildren = Object.keys(n.link_to.children).length;
			if (numberOfChildren > 10) {					
				let basicNodeThing = basicNode({
					id: n.id +'-TooManyKids',
					type: 'infinite',
					label: 'Too many children refine by searching',
					status: undefined,
					display: {
						above: ['test_above'],
							below: ['test_below'],
					},
					message: undefined,
					archived: false,
					paused: false,
				});
				basicNodeThing.relation = {
					type: 'TooManyKids',
					line: 'dashed_gray',
					above: ['test_relation_above'],
					below: ['test_relation_below'],
				};
				basicNodeThing.parents = [n];
				basicNodeThing.iconOverrides = {
					type: 'icon',
					icon: window.leostaticcdn + (n.type == 'bot' ? 'images/nodes/queue.png' : 'images/nodes/bot.png'),
				};
				kids = [
					basicNodeThing
				]
			} else {
				for (var id in n.link_to.children) {
					if (n.type === "bot") {
						var bot_id = nId
						var queue_id = id
					} else {
						var bot_id = id
						var queue_id = nId
					}
	
					var child = basicNode(dataStore.nodes[id])
	
					if (child && child.status !== 'archived' && !child.archived) {
						var link = n.link_to.children[id];
						//Is it in danger?
						child.relation = {
							type: link.type,
							line: link.display.line,
							above: link.display.above,
							below: link.display.below
						};
						if (!foundNodeList[id]) {
							foundNodeList[id] = 1;
							child.kids = getKids(dataStore.nodes[id], Object.assign({}, foundNodeList), dataStore, ++level)
						} else {
							child.kids = [{
								id: 'infinite',
								icon: window.leostaticcdn + 'images/icons/infinite.png',
								type: 'infinite',
								parents: [n],
								relation: {
									line: 'dashed_gray'
								}
							}]
						}
						child.rightCollapsed = (level >= 1 && child.kids.length > 1);
						kids.push(child);
					}
				}
			}
			return kids.sort((a, b) => {
				return a.label.localeCompare(b.label)
			})
		}

		node.parents = getParents(this.dataStore.nodes[root], {}, this.dataStore)
		node.kids = getKids(this.dataStore.nodes[root], {}, this.dataStore)
		return node
	}


	toggleStat(stat) {
		this.props.dispatch(saveSettings({ stats: (this.props.userSettings.stats === false) }))
	}


	toggleDetails() {
		this.dataStore.changeDetailsBool(!this.dataStore.details);
		this.props.dispatch(saveSettings({ details: !this.props.userSettings.details }))
	}


	toggleSearchBox(show) {
		this.setState({ showSearchBox: show }, () => {
			$('.searchBox').focus()
		})
	}


	render() {
		var thisComponent = this

		var rotators = [

			function(data, which, me) {
				return ({
					'icon-target': function(data, which, me) {
						return function() {
							me.clickedSide = which.name
							me.selected = [data.id]
							thisComponent.props.dispatch(saveSettings({
								node: data.id,
								selected: me.selected,
								offset: [0, 0]
							}))
						}
					}(data, which, me)
				})
			},

			function(data, which, me) {
				return ({
					'icon-cog': function(data) {
						return function() {
							window.nodeSettings(data)
						}
					}(data)
				})
			},

			'tree-collapse-right',

			false, 	//for future additional button
			false, 	//for future additional button

			'tree-collapse-left',

			(
				localStorage.getItem('enableBetaFeatures')
					? function(data, which, me) {
						return (
							(data.type !== 'bot')
								? {
									'icon-plus': function(data) {
										return function() {
											data.group = 'bot',
												window.createBot(data)
										}
									}(data)
								}
								: false
						)
					}
					: false
			),

			function(data, which, me) {
				return (
					(data.message)
						? {
							'icon-exclamation': function(data) {
								return function() {

									var html = $('<div/>').append(
										Object.keys(data.message).map((item) => {
											var itemValue = data.message[item]
											if (typeof itemValue == 'object') {
												item = Object.keys(itemValue)[0]
												itemValue = itemValue[item]
											}
											switch (item) {
												case 'title':
													return ''
													break

												case 'progress':
													var progress = itemValue * 100
													return '<div class="theme-progress-bar display-block width-1-1"><span style="width:' + progress + '%;"></span><span>' + progress + '%</span></div>'
													break

												default:
													return '<p>' + JSON.stringify(itemValue, null, 4) + '</p>'
													break
											}
										})
									).html()

									LeoKit.modal(html, { close: false }, data.message.title || '')

								}
							}(data)
						}
						: false
				)
			}

		]


		var nodeSearch = <div className="theme-icon-group pull-left control">
			{
				this.state.showSearchBox
					? <NodeSearch settings={'true'} searchText={this.state.searchText} toggleSearchBox={this.toggleSearchBox.bind(this)} className="black left-icon" placeholder="Search..." />
					: (<div className="theme-autocomplete black left-icon">
						<input type="search" name="undefined" className="searchBox theme-form-input" placeholder="Search..." value="" autoComplete="off" onClick={this.toggleSearchBox.bind(this, true)} onKeyDown={this.toggleSearchBox.bind(this, true)} />
						<i className="search-icon icon-search" />
					</div>)
			}
			{/* <i className="icon-search" onClick={this.toggleSearchBox.bind(this, true)}></i> */}
		</div>


		var treeButtons = [
			<div key={0} className="theme-icon-group control pill">
				<i className={"icon-hourglass" + (!(this.props.userSettings.stats && !this.props.userSettings.stats.all) ? ' active' : '')} title="all stats" onClick={this.toggleStat.bind(this, 'all')}></i>
			</div>,

			<div key={1} className="theme-icon-group control pill" title="Save this workflow">
				<i className="icon-bookmark" onClick={this.props.workflows.save.bind(this)}></i>
			</div>,

			<div key={2} className="theme-icon-group control pill" title="View Share Link">
				<i className="icon-share" onClick={() => { this.setState({ dialog: 'ShareLink' }) }}></i>
			</div>,

			(
				this.props.userSettings.node && !this.props.userSettings.details
					? (<div key={3} className={'theme-icon-group show-charts' + (this.props.userSettings.details ? ' active' : '')} onClick={this.toggleDetails.bind(this)}>
						<i className="icon-chart" title="show charts" /> Show Charts
					</div>)
					: false
			)

		]

		var treeButtonsRight = <div className="theme-icon-group push-right">
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
					? (<div className="theme-icon-group control">
						<i className="icon-plus" onClick={window.createNode}></i>
					</div>)
					: false
			}
		</div>

		return (
			<div className={'node-view ' + (this.props.userSettings.details ? 'show-details-pane ' : '') + this.props.className}>
				{
					this.dataStore.hasData
						? <Tree
							id="mainTree"
							ref={(child) => { this.nodeTree = child }}
							settings={this.props.userSettings}
							saveSetting="true"
							root={this.props.userSettings.node}
							force={this.state.force}
							source={this.getData(this.state.root)}
							rotators={rotators}
							hideLinkBelow={this.props.userSettings.stats === false}
							onCollapse={(data, expanded) => {
								this.dataStore.changeCollapsed(data, expanded);
								this.props.dispatch(saveSettings({ collapsed: data, expanded: expanded }))
							}}
							onNodeClick={(data) => {
								window.setDetailsPaneNodes([data.id])
							}}
							onLinkClick={window.setDetailsPaneNodes}
							onNodeDblClick={(data, which, me) => {
								d3.event.stopPropagation()
								me.clickedSide = which.name
								me.selected = [data.id]
								this.dataStore.changeAllStateValues(me.selected, this.dataStore.urlObj.timePeriod, this.dataStore.view, [0, 0], data.id, this.dataStore.zoom, this.dataStore.details);
								this.props.dispatch(saveSettings({ node: data.id, selected: me.selected, offset: [0, 0] }))
							}}
							nodeSearch={nodeSearch}
							treeButtons={treeButtons}
							treeButtonsRight={treeButtonsRight}
						/>
						: <div className="theme-spinner-large"></div>
				}

				{
					this.state.dialog === 'ShareLink'
						? (<Dialog title="Share Report" onClose={() => this.setState({ dialog: undefined })} buttons={{ close: false }}>
							<textarea className="theme-monospace" style={{ width: '50vw', height: '25vh' }} defaultValue={document.location}></textarea>
						</Dialog>)
						: false
				}

				{
					this.props.userSettings.details
						? <Footer settings={this.props.userSettings} />
						: false
				}

			</div>
		)
	}

}

export default connect(store => store)(NodeView)
