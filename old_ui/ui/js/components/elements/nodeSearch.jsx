import React, { Component } from 'react'
import { connect } from 'react-redux'
import { observer, inject } from 'mobx-react'
import { saveSettings } from '../../actions'

import NodeIcon from '../elements/nodeIcon.jsx'

@inject('dataStore')
@observer
class NodeSearch extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		let searchText = ''
			, searchId;
		if (props.value) {
			Object.keys(this.dataStore.nodes).filter((nodeId) => {
				let node = this.dataStore.nodes[nodeId];
				if (node.id === props.value.replace(/^system\./, '')) {
					searchText = node.id
					searchId = nodeId
				}
			})
		}

		this.state = {
			viewEvent: false,
			showDropdown: false,
			searchId: searchId,
			searchText: searchText,
			old_searchText: searchText,
			searchIndex: 0,

			showNew: ((this.props.nodeType || '').split('|').indexOf('new') != -1)
		}

		this.toggleSearchBox.bind(this)

		$(window).keydown((event) => {
			if (event.target.tagName != 'INPUT' && event.target.tagName != 'TEXTAREA' && $('.theme-modal, .theme-dialog').length == 0) {
				if (
					(65 <= event.keyCode && event.keyCode <= 90 && !event.ctrlKey) //letters
					|| (48 <= event.keyCode && event.keyCode <= 57 && !event.shiftKey) //numbers
					//messes up event scrolling: || ([38, 40, 13].indexOf(event.keyCode) != -1) //up down, enter
				) {
					$('.searchBox').focus()
					this.handleKeyDown(event)
				}
			}
		})

	}


	componentWillReceiveProps() {
		try {
			if (!this.dataStore.nodes[this.props.value] || this.state.old_searchText !== this.dataStore.nodes[this.props.value].id) {
				if (typeof this.props.searchText !== 'undefined' && this.props.searchText !== this.state.searchText) {

					this.setState({ searchText: this.props.searchText }, () => {
						this.findNodes()
						this.props.searchResults && this.props.searchResults(this.foundNodeIds, this.props.searchText)
					})

				} else {

					var searchText = ''
						, searchId
					if (this.props.value) {
						Object.keys(this.dataStore.nodes).filter((nodeId) => {
							var node = this.dataStore.nodes[nodeId]
							if (node.id === this.props.value.replace(/^system\./, '')) {
								searchText = node.id
								searchId = nodeId
							}
						})
					}

					if (searchText && searchText != this.state.searchText) {
						this.setState({ searchText: searchText, searchId: searchId })
					}
				}
			}
		} catch (e) {
			return false
		}
	}


	componentDidUpdate(oldProps) {

		if (
			//(oldProps.settings && oldProps.settings.list != this.props.settings.list) ||
			(oldProps.showArchived != this.props.showArchived)
		) {
			//rerun
			this.searchNodes()
			$('.searchBox').focus()
		}

	}


	searchNodes(event) {
		this.setState({ searchText: event ? event.currentTarget.value : this.state.searchText, searchIndex: 0, showDropdown: !this.props.searchResults }, () => {
			if (this.props.searchResults) {
				this.findNodes()
				this.props.searchResults(this.foundNodeIds, this.state.searchText)
			}
		})
	}


	findNodes() {
		let searchText = (this.state.searchText || '').toString().trim().toLowerCase();
		this.foundNodeIds = Object.keys(this.dataStore.nodes).filter((id) => {
			let node = (this.dataStore.nodes[id] || {});
			let label = node.label || '';
			let isFound = true;

			if (
				(((node.status || '') === 'archived' || node.archived) && !this.props.showArchived)
				|| ((this.props.nodeType || 'queues|bots|systems').split('|').indexOf(node.type + 's') == -1)
			) {
				return false
			}

			if (this.props.matches) {
				var matchKey = (node.type) + (node.type == 'system' ? ':' + node.system : '') + ':' + (node.label || node.Id || '')
				if (!RegExp(this.props.matches).test(matchKey)) {
					return false
				}
			}

			searchText.split(' ').forEach((searchText) => {
				if (
					(label.toString().toLowerCase().indexOf(searchText) === -1)
					&& (id.toLowerCase().indexOf(searchText) === -1)
				) {
					isFound = false
					if (node.tags) {
						node.tags.toString().split(/, ?/g).forEach((tag) => {
							if (tag.toLowerCase().indexOf(searchText) !== -1) {
								isFound = true
							}
						})
					}
				}
			})

			return isFound
		}).sort((a, b) => {
			a = (this.dataStore.nodes[a].label || '').toString()
			b = (this.dataStore.nodes[b].label || '').toString()
			if (a.toLowerCase() === searchText) {
				return -1
			} else if (b.toLowerCase() === searchText) {
				return 1
			}
			return a.localeCompare(b)
		})
		this.searchCount = this.foundNodeIds.length
	}


	setSearchIndex(searchIndex) {
		searchIndex = this.state.showNew
			? Math.min(Math.max(searchIndex, 0), this.searchCount)
			: Math.min(Math.max(searchIndex, 0), this.searchCount - 1)
		this.setState({ searchIndex: searchIndex }, () => {
			setTimeout(() => {
				var list = $('.search-list')
				if (list.length && list.find('li.active')) {
					list.stop(true).animate({
						scrollTop: (list.find('li.active').position().top + list[0].scrollTop - list.height() / 2 + list.find('li.active').height() / 2)
					}, 'fast')
				}
			}, 0)
		})
	}


	handleKeyDown(event) {
		switch (event.keyCode) {
			case 13: //enter
				setTimeout(() => {
					this.selectNode(this.searchNode || (this.foundNodeIds || [])[this.state.searchIndex] || this.props.userSettings.selected[0])
				}, 1)
				event.preventDefault()
				break

			case 38: //up
				this.setSearchIndex(--this.state.searchIndex)
				this.props.upAndDown && this.props.upAndDown(-1)
				event.preventDefault()
				break

			case 40: //down
				this.setSearchIndex(++this.state.searchIndex)
				this.props.upAndDown && this.props.upAndDown(1)
				event.preventDefault()
				break

			case 27: //escape
				this.toggleSearchBox.call(this, false)
				break
		}
	}


	selectNode(id) {
		if (this.props.settings) {
			this.dataStore.changeAllStateValues(id, this.dataStore.urlObj.timePeriod, 'node', [0, 0], id);
			this.props.dispatch(saveSettings({ node: id, selected: [id], view: 'node', offset: [0, 0] }))
		}
		let selectedText = (this.dataStore.nodes[id] || {}).id || id;
		this.setState({ selectedText: selectedText, searchText: selectedText }, () => {
			this.toggleSearchBox(false)
		})
		this.props.onChange && this.props.onChange({ id: id, label: selectedText })
	}


	toggleSearchBox(show) {
		if (!this.props.searchResults) {
			if (!show && this.state.showNew && this.state.searchText && (this.state.searchText != this.state.selectedText)) {
				this.props.onChange && this.props.onChange(this.state.searchText)
			}
			this.setState({ showDropdown: show })
			this.props.toggleSearchBox && this.props.toggleSearchBox(show)
		}
	}


	clearSearch() {
		this.setState({ searchText: '' }, this.searchNodes.bind(this))
		this.props.onChange && this.props.onChange('')
	}


	render() {

		var searchIndex = 0
		if (this.state.showDropdown) {
			this.searchCount = 0
			this.findNodes()
		}

		let maxResults = parseInt(localStorage.getItem('searchUiSize')) || 50;

		return (<div className={"theme-autocomplete " + (this.props.className || '')}>
			{
				this.state.showDropdown
					? <div className="mask" onClick={this.toggleSearchBox.bind(this, false)}></div>
					: false
			}
			<input type="search" name={this.props.name || 'undefined'} className="searchBox theme-form-input" placeholder={this.props.placeholder || 'search...'} onChange={this.searchNodes.bind(this)} onKeyDown={this.handleKeyDown.bind(this)} onFocus={this.toggleSearchBox.bind(this, true)} value={this.state.searchText || ''} autoComplete="off" />
			{
				this.state.searchText
					? <i className="icon-cancel" onClick={this.clearSearch.bind(this)}></i>
					: false
			}
			<i className={'search-icon ' + (this.props.icon || 'icon-search')} />

			{
				this.state.showDropdown
					? <ul className="search-list">
						{
							this.state.showNew
								? (<li className={searchIndex++ == this.state.searchIndex ? 'active' : ''} onClick={this.selectNode.bind(this, this.state.searchText)}>
									<i className="icon-plus display-inline-block margin-5"></i>
									{this.searchNode = (this.state.searchText != this.state.selectedText ? this.state.searchText : '')}
								</li>)

								: false
						}
						{
							this.foundNodeIds.slice(0, maxResults).map((nodeId) => {

								var node = this.dataStore.nodes[nodeId] || {}
								var tags = (node.tags || '').toString().split(',').filter(t => !t.match(/(^repo:)/))

								if (searchIndex == this.state.searchIndex) {
									this.searchNode = nodeId
								}

								return (<li key={nodeId} className={'flex-row flex-space ' + (searchIndex++ == this.state.searchIndex ? 'active' : '')} onClick={this.selectNode.bind(this, nodeId)} >
									<NodeIcon className="theme-image-tiny margin-0-5" node={nodeId} />
									<span className="flex-grow">
										{node.label}
										<div className="theme-tags">
											{
												tags.map((tag, index) => {
													return (<span key={index}>{tag}</span>)
												})
											}
										</div>
									</span>
									<i className="icon-cog" style={{ fontSize: '1.25em' }} onClick={window.nodeSettings.bind(this, {
										id: nodeId,
										label: node.label,
										server_id: node.id,
										type: node.type,
										logs: node.logs
									})} />
								</li>)

							})
						}
						{this.foundNodeIds.length > maxResults ? (<li style={{ display: "flex", "align-items": "center", "justify-content": "center" }}>
							<span>Refine Search</span>
						</li>) : false}
						{
							this.searchCount == 0
								? (<li><em>no results</em></li>)
								: false
						}
					</ul>
					: false
			}
		</div>)
	}


}

export default connect(store => store)(NodeSearch)
