import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
import Tree from '../elements/tree.jsx'

@inject('dataStore')
@observer
export default class EventTrace extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;
		this.state = {
			source: {},
			settings: {
				collapsed: {
					left: [],
					right: []
				}
			}
		}
	}


	componentWillMount() {
		if (this.props.data) {
			this.parseData(this.props.data.response)
		}
	}


	componentDidMount() {

		this.modal = LeoKit.modalFull($('.eventTrace'),
			{},
			'Event Trace',
			this.props.onClose
		)

	}


	parseData(data) {

		this.nodeData = []

		var collapsed = {
			left: [],
			right: []
		}

		this.nodeData[data.event.id] = data.event

		var source = {
			//above: [],
			below: [moment(data.event.timestamp).format('MM/DD/YY h:mm:ss a')],
			checkpoint: data.event.checkpoint || data.event.kinesis_number,
			icon: 'queue.png',
			id: data.event.id,
			is_root: true,
			label: (this.dataStore.nodes[data.event.id] || {}).label,
			payload: data.event.payload,
			server_id: data.event.server_id,
			//status: '',
			type: data.event.type
		}

		var lags = []

		//get lags
		data.parents.forEach((parent) => {
			lags.push(parent.lag || '')
		})
		lags.push(data.event.lag || '')
		lags.shift() //throw the first away

		var parents = []

		data.parents.forEach((parent) => {

			this.nodeData[parent.id] = parent

			var lag = lags.shift()

			var node = {
				//above: [],
				below: parent.type == 'queue' ? [moment(parent.timestamp).format('h:mm:ss a')] : [],
				checkpoint: parent.checkpoint || parent.kinesis_number,
				icon: parent.type + '.png',
				id: parent.id,
				kids: [],
				label: (this.dataStore.nodes[parent.id] || {}).label,
				parents: parents,
				payload: parent.payload,
				server_id: parent.server_id,
				status: '',
				type: parent.type,
				relation: {
					//above: [],
					below: lag || lag === 0 ? [this.formatTime(lag)] : [],
					status: '',
					type: 'read'
				}
			}

			parents = [node]

		})

		source.parents = parents
		source.kids = this.parseChildren(data.children, collapsed, true)

		this.setState({ source: source, settings: { collapsed: collapsed } })
	}


	parseChildren(children, collapsed, parentProcessed) {

		let kids = [];

		Object.keys(children).forEach((childId) => {
			let child = children[childId]
				, node = this.dataStore.nodes[childId];

			if (node && node.status !== 'archived' && !node.archived) {

				child.missingData = true
				this.nodeData[child.id] = child

				kids.push({
					//above: [],
					below: child.type == 'queue' ? [moment(child.timestamp).format('h:mm:ss a')] : [child.has_processed ? 'Processed' : { errors: 'Not Processed' }],
					checkpoint: child.checkpoint || child.kinesis_number,
					icon: child.type + '.png',
					id: child.id,
					kids: this.parseChildren(child.children, collapsed, !!child.has_processed),
					label: node.label,
					parents: [],
					payload: child.payload,
					server_id: child.server_id,
					status: '',
					type: child.type,
					relation: {
						//above: [],
						below: (child.type == 'queue' && parentProcessed) ? ['click to trace'] : [],
						fill: 'gray',
						status: '',
						type: 'write'
					}
				})

				if (child.type == 'bot' && !child.has_processed && child.id && Object.keys(child.children).length) {
					collapsed.right.push(child.id)
				}

			}

		})

		return kids
	}


	linkClicked(selection, data) {

		if (this.nodeData[data.target.id].missingData) {

			var lookups = []
			var parent = data.source
			lookups.unshift(data.target.id)
			while (!parent.checkpoint || typeof parent.checkpoint !== "string" || (this.dataStore.nodes[parent.id] || {}).type === 'bot') { //must be queue
				lookups.unshift(parent.id)
				parent = parent.parent
			}

			var showProcessing = (source) => {
				if (source.kids) {
					source.kids = source.kids.map((kid) => {
						if (lookups.indexOf(kid.id) != -1) {
							if (kid.type == 'queue') {
								kid.relation.below = ['tracing...']
							}
							kid.relation.fill = 'working'
							//delete kid.missingData
						}
						kid = showProcessing(kid)
						return kid
					})
				}
				return source
			}
			this.setState({ source: showProcessing(this.state.source) })

			var href = window.api + '/trace/' + encodeURIComponent(parent.id) + '/' + encodeURIComponent(parent.checkpoint)
			$.get(href, { children: lookups.join(',') }, (newData) => {
				var source = JSON.parse(JSON.stringify(this.state.source))
				var updateKids = (source) => {
					if (source.kids) {
						source.kids = source.kids.map((kid) => {
							if (kid.id in newData) {
								kid.payload = newData[kid.id].payload
								kid.lag = newData[kid.id].lag
								kid.checkpoint = newData[kid.id].checkpoint
								delete kid.missingData
								kid.relation.below = [(kid.type === 'queue' ? (kid.lag || kid.lag === 0 ? this.formatTime(kid.lag) : 'n/a') : '')]
								delete kid.relation.fill
								this.nodeData[kid.id] = kid
							}
							kid = updateKids(kid)
							return kid
						})
					}
					return source
				}
				source = updateKids(source)
				this.setState({ source: source })
			}).fail((result) => {
				result.call = href;
				window.messageLogModal('Failure calling trace on ' + (this.dataStore.nodes[parent.id] || {}).label, 'error', result);
			})

		} else {

			var settings = this.state.settings
			settings.selection = selection

			this.setState({ settings: settings })

		}

	}


	formatTime(milliseconds) {
		return (numeral(Math.floor(milliseconds / 1000)).format('00:00:00') + numeral((milliseconds / 1000) % 1).format('.0')).replace(/^0:/, '').replace(/^00:/g, '').replace(/^00\./g, '.') + 's'
	}


	render() {

		var rotators = [

			false, 	//for future additional button

			function(data, which, me) {
				return ({
					'icon-cog': function(data) {
						return function() {
							data.openTab = (data.type == 'bot' ? 'Mapping' : 'Events')
							window.traceSettings(data)
						}
					}(data)
				})
			},

			'tree-collapse-right',

			false, 	//for future additional button
			false, 	//for future additional button

			'tree-collapse-left',

			false, 	//for future additional button
			false 	//for future additional button

		]

		return (<div>
			<div className="event-trace eventTrace">
				<Tree id="traceTree" root={this.state.source.id} source={this.state.source} settings={this.state.settings} collapsed={this.state.collapsed} rotators={rotators} onLinkClick={this.linkClicked.bind(this)} force="true" />
			</div>
		</div>)

	}

}
