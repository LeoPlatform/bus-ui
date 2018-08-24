import React, {Component} from 'react'
import { connect } from 'react-redux'

import DetailsPane from './detailsPane.jsx'


class Footer extends React.Component {
	constructor(props) {
		super(props)

		this.state = {}
	}


	render() {
		return (
			<footer className="details-pane">
				{
					this.props.userSettings.details
					? <DetailsPane />
					: false
				}
			</footer>
		)
	}

}

export default connect(store => store)(Footer)
