import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'

import NodeSearch from '../elements/nodeSearch.jsx'

var refUtil = require("leo-sdk/lib/reference.js")

@inject('dataStore')
@observer
export default class QueueSelector extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		var owner = (refUtil.ref(props.value) || { owner: () => null }).owner() || {}

		this.state = {
			systemId: owner.id,
			subqueue: owner.queue,
			subqueues: [],
			id: props.value
		}
	}


	pickedSystem(system) {
		var subqueues = []
		if (system.id) {
			subqueues = this.dataStore.queues.filter((queueId) => {
				return this.dataStore.nodes[queueId].owner === system.id
			}).map((queueId) => {
				return refUtil.ref(queueId).owner().queue
			}).filter((value, index, self) => (value && self.indexOf(value) === index))
		}
		this.setState({ systemId: system.id, subqueues: subqueues, id: ((refUtil.ref(system.id) || { queue: () => null }).queue(this.state.subqueue) || {}).toString() })
	}


	inputChanged(event) {
		var subqueue = event.currentTarget.value
		this.setState({ subqueue: subqueue, id: refUtil.ref(this.state.systemId).queue(subqueue).toString() })
	}


	toggleDropdown(showDropdown) {
		this.setState({ showDropdown: showDropdown })
	}


	selectSubqueue(subqueue) {
		this.setState({ subqueue: subqueue, showDropdown: false })
	}


	render() {

		/*

		Pick a system queue with a subqueue

		result should look like this

		{
		   fieldName: "queue:system.systemName.subqueue"
		}
		you can use core/lib/reference.js to convert from the system & subqueue to the saved queue

		var refutil = require("leo-sdk/lib/reference.js")
		var queueReferenceToSave = refutl.ref(systemId).queue(subqueue).id;

		you can also get the system out of the saved queue like

		refutil.ref(savedQueueReference).owner()

		*/

		var field = this.props
		return (<div title={field.title} className="display-inline-block">
			<NodeSearch value={this.state.systemId} className="display-block" nodeType={field.nodeType} onChange={this.pickedSystem.bind(this)} />
			<div className="theme-autocomplete">
				<input value={this.state.subqueue || ''} onChange={this.inputChanged.bind(this)} placeholder={field.placeholder} onFocus={this.toggleDropdown.bind(this, true)} />
				{
					this.state.showDropdown && this.state.subqueues.length
						? [<div key="0" className="mask" onClick={this.toggleDropdown.bind(this, false)} />,
						<ul key="1">
							{
								this.state.subqueues.map((subqueue) => {
									return (<li key={subqueue} onClick={this.selectSubqueue.bind(this, subqueue)}>{subqueue}</li>)
								})
							}
						</ul>]
						: false
				}

			</div>
			<input type="hidden" name={field.name} value={this.state.id || ''} readOnly onChange={field.onChange} />
		</div>)

	}


}
