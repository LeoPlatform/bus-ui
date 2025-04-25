import React, {Component} from 'react';

import sortable from 'html5sortable'

export default class SavedSearches extends React.Component {
	constructor(props) {
		super(props)

		this.state = {}
	}


	componentDidMount() {

		LeoKit.modal($('#savedSearches'),
			{},
			'Saved Searches',
			this.props.onClose
		)

		sortable('#savedSearches', {
			handle: '.icon-menu',
			forcePlaceholderSize: true
		})

		sortable('#savedSearches')[0].addEventListener('sortupdate', (event) => {
			var order = event.detail.newStartList.map((element) => {
				return $(element).data('search')
			})
			this.props.searches.order(order)
		})

	}


	componentWillUnmount() {

		sortable('#savedSearches', 'destroy')

	}


	restoreSearch(search) {
		this.props.searches.restore(search)
	}


	render() {

		var savedSearches = this.props.searches.views
		,   order = this.props.searches.order()

		return (<div>
			<div id="savedSearches" className="saved-views">
			{
				order.length
				? (order.map((view) => {
					return (<div key={view} className="workflow-div flex-row flex-space" data-search={view}>
						<i className="icon-menu" />
						<span className="flex-grow" onClick={this.restoreSearch.bind(this, view)}>{view}</span>
						<i className="icon-minus-circled pull-right" onClick={this.props.searches.delete.bind(this, view)}></i>
					</div>)
				}))
				: 'There are no saved Searches'
			}
			</div>
		</div>)
	}

}
