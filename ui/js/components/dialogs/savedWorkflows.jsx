import React, {Component} from 'react';

import sortable from 'html5sortable'

export default class SavedWorkflows extends React.Component {
	constructor(props) {
		super(props)

		this.state = {}
	}


	componentDidMount() {

		this.modal = LeoKit.modal($('#savedWorkflows'),
			{},
			'Saved Workflows',
			this.props.onClose
		)

		sortable('#savedWorkflows', {
			handle: '.icon-menu',
			forcePlaceholderSize: true
		})

		sortable('#savedWorkflows')[0].addEventListener('sortupdate', (event) => {
			var order = event.detail.newStartList.map((element) => {
				return $(element).data('view')
			})
			this.props.workflows.order(order)
		})

	}


	componentWillUnmount() {

		sortable('#savedSearches', 'destroy')

	}


	onDelete(view) {
		this.props.workflows.delete(view)
		setTimeout(() => {
			LeoKit.center(this.modal)
		}, 1000)
	}


	render() {

		var savedWorkflows = this.props.workflows.views
		,   order = this.props.workflows.order()

		return (<div>
			<div id="savedWorkflows" className="saved-views">
			{
				order.length
				? (order.map((view) => {
					return (<div key={view} className="workflow-div flex-row flex-space" data-view={view}>
						<i className="icon-menu" />
						<span className="flex-grow" onClick={this.props.workflows.restore.bind(this, view)}>{view}</span>
						{/*<i className={'icon-ok cursor-pointer' + (this.state.defaultView === savedWorkflows[view] ? ' theme-color-success' : ' theme-color-disabled')} title="set as default" onClick={this.setDefaultView.bind(this, view)}></i>*/}
						<i className="icon-minus-circled pull-right" onClick={this.onDelete.bind(this, view)}></i>
					</div>)
				}))
				: 'There are no saved Workflows'
			}
			</div>
		</div>)
	}

}
