import React, {Component} from 'react'
import { connect } from 'react-redux'
import {inject, observer} from 'mobx-react'


export function noSourceMessage(state, dataStore) {

	let noDataMessage = false
	,   noDataIcon = 'no-database.png';

	if (state.hasData) {
		if ($.isEmptyObject(dataStore.nodes)) {
			noDataMessage = [
				'No data source',
				'The data can\'t flow without a data source.',
				'Click the plus sign in the blue circle in the top right corner to add a data source.'
			]
		} else if (state.userSettings.view === 'trace') {
			noDataIcon = 'no-queue.png'
			noDataMessage = [
				'No queue selected',
				'Search for a queue to find an event to trace'
			]
		} else if (state.userSettings.view !== 'node') {
			noDataMessage = [
				'No nodes found',
				'There are no results that match your search'
			]
		} else if (!state.root) {
			noDataMessage = [
				'No data node selected',
				'Please use the catalog view or start typing to search for a data node to display.'
			]
		} else if (!dataStore.nodes[state.root]) {
			noDataMessage = [
				'Selected data node does not exist',
				'Please use the catalog view or start typing to search for a data node to display.'
			]
		} else if (dataStore.nodes[state.root].archived) {
			noDataMessage = [
				'Selected node is archived',
				'Archived nodes can be found in the catalog. They can be unarchived from the settings tab.',
				'Or start typing to search for a data node to display.'
			]
		}
	}

	return [noDataMessage, noDataIcon]

}

@inject('dataStore')
@observer
class NoSource extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			userSettings: this.props.userSettings,
			root: this.props.root,
			hasData: this.dataStore.hasData
		}
	}




	render() {
		let [noDataMessage, noDataIcon] = noSourceMessage(this.state, this.dataStore);

		return (
			noDataMessage
			? (<g className="no-data-message" transform={this.props.transform}>
				<g transform="translate(-60 -240)">
					<image href={window.leostaticcdn + 'images/icons/' + noDataIcon} width="120px" height="120px">
						{
							noDataIcon === 'spinner.png'
							? <animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="1s" repeatCount="indefinite" />
							: ''
						}
					</image>
				</g>
				<text>
					<tspan x="0" dy="-1.2em">{noDataMessage[0]}</tspan>
					<tspan x="0" dy="2em">{noDataMessage[1] || ''}</tspan>
					<tspan x="0" dy="1.2em">{noDataMessage[2] || ''}</tspan>
				</text>
			</g>)
			: false
		)

	}

}

export default connect(store => store)(NoSource)
