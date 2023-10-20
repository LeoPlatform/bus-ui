import React, { Component } from 'react'
import { connect } from 'react-redux'
import { saveSettings } from '../actions'

import EventTrace from './dialogs/eventTrace.jsx'
import Header from './main/header.jsx';
import LeftNav from './main/leftNav.jsx'
import Content from './main/content.jsx';
import MessageCenter from './main/messageCenter.jsx'
import DataSourceConnect from './dialogs/dataSourceConnect.jsx'

import ApiData from './main/apiData.jsx'

// This will be moved later when redux stuff is taken out of index.js along with Provider in render()
import { Provider } from 'mobx-react'
import DataStore from '../../../stores/dataStore.js'
const dataStore = new DataStore();


String.prototype.capitalize = function(lower) {
	return (lower ? this.toLowerCase() : this).replace(/(?:^|\s|\.)\S/g, f => f.toUpperCase())
}

	;['round', 'floor', 'ceil'].forEach(function(funcName) {
		if (!Math['_' + funcName]) {
			Math['_' + funcName] = Math[funcName]
			Math[funcName] = function(number, precision) {
				precision = Math.abs(parseInt(precision)) || 0
				var coefficient = Math.pow(10, precision)
				return Math['_' + funcName](number * coefficient) / coefficient
			}
		}
	})

String.prototype.htmlEncode = function() {
	return $('<div/>').text(this).html()
}


window.responsiveFont = function() {
	if (!document.hidden) {
		$('.responsive-font').css({ overflow: 'auto', fontSize: '' })
		$('.responsive-font').each(function(a, b) {
			while (this.scrollWidth > $(this).parent().width()) {
				$(this).css({ fontSize: parseInt($(this).css('fontSize')) - 1 })
			}
		})
		$('.responsive-font').css({ overflow: '' })
	}
}

window.addEventListener('resize', window.responsiveFont)

window.enableBetaFeatures = function(enableBetaFeatures) {
	if (enableBetaFeatures) {
		localStorage.setItem('enableBetaFeatures', enableBetaFeatures)
	} else {
		localStorage.removeItem('enableBetaFeatures')
	}
	return `Refresh the page to ${enableBetaFeatures ? 'show' : 'hide'} Beta Features`
}

window.enableAdminFeatures = function(enableFeatures) {
	if (enableFeatures) {
		localStorage.setItem('enableAdminFeatures', enableFeatures)
	} else {
		localStorage.removeItem('enableAdminFeatures')
	}
	return `Refresh the page to ${enableFeatures ? 'show' : 'hide'} Admin Features`
}


class App extends React.Component {

	constructor(props) {
		super(props);

		window.nodeTree = {
			left: { collapsed: [] },
			right: { collapsed: [] }
		}

		window.fetchTimeout = false

		window.jumpToNode = function(nodeId, onClose) {
			onClose && onClose()
			dataStore.changeNode(nodeId, 'node', [0, 0]);
			this.props.dispatch(saveSettings({ node: nodeId, selected: [nodeId], view: 'node', offset: [0, 0] }))
		}

		window.startTrace = (trace) => {
			$('.eventTrace').closest('.theme-modal-full').remove()
			this.setState({ trace: undefined }, () => {
				this.setState({ trace: trace })
			})
		}

		this.state = this.loadSettings()
	}


	loadSettings() {
		var hash = decodeURI(document.location.hash.slice(1)) || ''

		if (hash == '') {
			var viewId = localStorage.getItem('default-view')
			if (viewId) {
				document.location.hash = JSON.parse(localStorage.getItem(viewId)) || '{}'
				return
			}
		}

		try {
			var values = JSON.parse(decodeURI(hash || '') || '{}')
		} catch (e) {
			var msg = 'Invalid Request'
			window.messageLogNotify ? window.messageLogNotify(msg, 'warning', e) : LeoKit.alert(msg, 'warning')
			var values = {}
		}

		var me = window.nodeTree

		me.selected = values.selected || []

		dataStore.changeAllStateValues(values.selected, values.timePeriod, values.view, values.offset, values.node, me.zoom, values.details);
		this.props.dispatch(saveSettings(values))

		me.toggle_stats = values.stats || { all: true }

		me.zoom = values.zoom || 1

		$('.zoom-out, .zoom-in').removeClass('active')
		if (me.zoom > 1) {
			$('.zoom-in').addClass('active')
		} else if (me.zoom < 1) {
			$('.zoom-out').addClass('active')
		}

		me.offsetDistance = values.offset || [0, 0]
		me.left.collapsed = values.collapsed ? values.collapsed.left || [] : []
		me.right.collapsed = values.collapsed ? values.collapsed.right || [] : []

		if (!me.root) {
			me.root = values.node
		}

		if (values.timePeriod && values.timePeriod.begin && !values.timePeriod.end) {
			var interval = (values.timePeriod.interval || 'hour_6').split('_')
			values.timePeriod.end = moment(values.timePeriod.begin).add(parseInt(interval[1]) || 1, interval[0]).format('Y-MM-DD h:mm:ss')
		}

		return {
			details: (values.details && values.selected && values.selected.length > 0),
			//detailsPeriod: values.detailsPeriod,
			view: values.view || 'dashboard',
			list: values.list || 'bots',
			sort: values.sort || {
				index: 0,
				direction: 'asc'
			},
			selected: values.selected || [],
			node: values.node || '',
			stats: values.stats || {
				all: true
			},
			timePeriod: values.timePeriod || { interval: 'hour_6' }, /*  default interval */
			//save: this.saveSetting,

			messageCount: JSON.parse(sessionStorage.getItem('messageQueue') || '[]').length
		}
	}


	componentWillMount() {

		this.setState({
			savedWorkflows: this.workflows.views,
			savedSearches: this.searches.views
		})

		$(window).bind('hashchange', () => {
			this.setState(this.loadSettings() || {}, () => {
				if (this.state.view === 'node') {
					window.nodeTree.updateDiagram(this.state.node || null, true)
				}
			})
		}).trigger('hashchange')


		window.setDetailsPaneNodes = (nodes) => {
			if (typeof nodes == 'string') {
				nodes = [nodes]
			}

			if (nodes[0] === 'add') {
				this.setState({ addDataSource: true })
			} else if (nodes[0] !== 'infinite') {
				this.props.dispatch(saveSettings({ selected: nodes }))
			}
		}

		window.setDetailsPaneNodes(window.nodeTree.selected)
	}


	workflows = {
		order: (order) => {
			if (order) {
				localStorage.setItem('saved-views-order', JSON.stringify(order))
			}
			return JSON.parse(localStorage.getItem('saved-views-order')) || Object.keys(JSON.parse(localStorage.getItem('saved-views')) || {}).sort()
		},
		views: JSON.parse(localStorage.getItem('saved-views', '{}')) || {},
		restore: (view) => {
			var viewId = this.workflows.views[view]
			document.location.hash = JSON.parse(localStorage.getItem(viewId))
			window.fetchData()
		},
		delete: (view) => {
			LeoKit.confirm(('Delete view "' + view + '"?').htmlEncode(), () => {
				var savedViews = this.workflows.views
				var viewId = savedViews[view]
				localStorage.removeItem(viewId)
				delete savedViews[view]
				localStorage.setItem('saved-views', JSON.stringify(savedViews))
				this.workflows.views = savedViews
				var order = this.workflows.order()
				order.splice(order.indexOf(view), 1)
				this.workflows.order(order)
				this.setState({ savedWorkflows: this.workflows.views })
			})
		},
		save: () => {
			var defaultValue = (dataStore.nodes[this.props.userSettings.node] || {}).label || ''
			LeoKit.prompt('Save Workflow', 'Enter workflow name', defaultValue, (form) => {
				if (form.prompt_value == '') {
					window.messageModal('Name is required', 'warning')
					return false
				}
				var savedViews = this.workflows.views
				var viewId = 'saved-view-' + Date.now() + Math.random()
				localStorage.setItem(viewId, JSON.stringify(document.location.hash))
				savedViews[form.prompt_value] = viewId
				localStorage.setItem('saved-views', JSON.stringify(savedViews))
				this.workflows.views = savedViews
				var order = this.workflows.order()
				order.push(form.prompt_value)
				this.workflows.order(order)
				this.setState({ savedWorkflows: this.workflows.views })
				window.messageLogNotify('Saved View "' + form.prompt_value + '"')
			})
		}
	}


	searches = {
		current: {
			archive: false,
			bot: [],
			show: ['queue', 'bot', 'system'],
			sort: {
				direction: 'asc',
				index: 0
			},
			statuses: ['!archived'],
			system: [],
			text: ''
		},
		order: (order) => {
			if (order) {
				localStorage.setItem('saved-searches-order', JSON.stringify(order))
			}
			return JSON.parse(localStorage.getItem('saved-searches-order')) || Object.keys(JSON.parse(localStorage.getItem('saved-searches')) || {}).sort()
		},
		views: JSON.parse(localStorage.getItem('saved-searches')) || {},
		restore: (view) => {
			dataStore.changeView('dashboard');
			this.props.dispatch(saveSettings({ view: 'dashboard' }))
			var viewId = this.searches.views[view]
			this.searches.current = JSON.parse(localStorage.getItem(viewId))
			this.setState({ currentSearch: this.searches.current })
		},
		delete: (view) => {
			LeoKit.confirm(('Delete search "' + view + '"?').htmlEncode(), () => {
				var savedViews = this.searches.views
				var viewId = savedViews[view]
				localStorage.removeItem(viewId)
				delete savedViews[view]
				localStorage.setItem('saved-searches', JSON.stringify(savedViews))
				this.searches.views = savedViews
				var order = this.searches.order()
				order.splice(order.indexOf(view), 1)
				this.searches.order(order)
				this.setState({ savedSearches: this.searches.views })
			})
		},
		save: () => {
			LeoKit.prompt('Save Search', 'Enter search name', (form) => {
				if (form.prompt_value == '') {
					window.messageModal('Name is required', 'warning')
					return false
				}
				var savedViews = this.searches.views
				var viewId = 'saved-search-' + Date.now() + Math.random()
				localStorage.setItem(viewId, JSON.stringify(this.searches.current))
				savedViews[form.prompt_value] = viewId
				localStorage.setItem('saved-searches', JSON.stringify(savedViews))
				this.searches.views = savedViews
				var order = this.searches.order()
				order.push(form.prompt_value)
				this.searches.order(order)
				this.setState({ savedSearches: this.searches.views })
				window.messageLogNotify('Saved Search "' + form.prompt_value + '"')
			})
		}
	}


	messageLogged(messageCount) {
		this.setState({ messageCount: messageCount })
	}


	render() {
		return (
			<Provider dataStore={dataStore}>
				<main id="main">

					<ApiData />

					<MessageCenter messageLogged={this.messageLogged.bind(this)} />

					{
						this.state.trace
							? <EventTrace data={this.state.trace} onClose={() => { this.setState({ trace: undefined }) }} />
							: false
					}

					<Header settings={this.state} messageCount={this.state.messageCount} />

					<LeftNav workflows={this.workflows} searches={this.searches} />

					<Content settings={this.state} workflows={this.workflows} searches={this.searches} currentSearch={this.state.currentSearch} />

					{
						this.state.addDataSource
							? <DataSourceConnect onClose={() => { this.setState({ addDataSource: undefined }) }} />
							: false
					}

				</main>
			</Provider>
		)
	}
}

export default connect(store => store)(App)
