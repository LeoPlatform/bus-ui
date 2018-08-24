import React, { Component } from 'react'
import { connect } from 'react-redux'
import {observer, inject} from 'mobx-react'

import EventViewer from '../tabs/eventViewer.jsx'

@inject('dataStore')
@observer
class TraceViewer extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {}
        if (!this.dataStore.hasData) {
            this.dataStore.getStats();
        }
	}


	render() {

		return (
			!this.dataStore.hasData

			? <div className="theme-spinner-large" />

			: (<div className="theme-form height-1-1 padding-20 border-box">
				<div className="height-1-1 display-block">
					<EventViewer trace={true} nodeData={{ id: this.state.queueId }} hideReply="true" tracePage="true" />
				</div>
			</div>)
		)

	}

}

export default connect(store => store)(TraceViewer)
