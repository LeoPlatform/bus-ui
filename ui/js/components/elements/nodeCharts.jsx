import React, { Component } from 'react';
import { connect } from 'react-redux';

import NodeChart from '../elements/nodeChart.jsx';

class NodeCharts extends React.Component {

	nodeCharts = {
		queue:        ['Events Written', "Events Read", "Source Lag", "analytics"],
		bot:          ['Execution Count', 'Error Count', 'Execution Time'],
		queue_read:   ["Events In Queue", 'Events Read', "Read Source Lag"],
		queue_write:  ['Events Written', "Write Source Lag"],
		system:       ['Events Written', "Events Read", "Source Lag"],
		system_read:  ["Events Read", "Read Source Lag"],
		system_write: ['Events Written', "Write Source Lag"],
	};


	constructor(props) {
		super(props);
		this.state = {};
	}


	render() {

		let nodeType = (this.props.nodeType === 'event' ? 'queue' : this.props.nodeType);

		return (<div className={this.props.className || ''}>
			{
				(this.nodeCharts[nodeType] || []).map((chartKey, index) => {

                    let chartData = []
						, compare = [];

					this.props.chartSettings[chartKey].fields.forEach((field) => {
						chartData.push(this.props.data[field])
						compare.push((this.props.data.compare || {})[field])
					});

					return <NodeChart key={chartKey} data={chartData} compare={compare} lastRead={this.props.lastRead} chartKey={chartKey} interval={this.props.interval} showHeader={this.props.showHeader} className={"width-1-" + this.nodeCharts[nodeType].length} nodeType={nodeType} botId={this.props.botId} queueId={this.props.queueId} isLast={index === (this.nodeCharts[nodeType] || []).length-1 } />
				})

			}
		</div>)

	}

}

export default connect(store => store)(NodeCharts)
