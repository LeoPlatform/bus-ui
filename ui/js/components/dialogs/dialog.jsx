import React, {Component} from 'react';

class Content extends React.Component {
	constructor(props) {
		super(props)
		this.state = {}
	}


	componentDidMount() {

		LeoKit.modal($('#dialogTag'),
			this.props.buttons || { close: false },
			this.props.title,
			this.props.onClose
		)

	}

	render() {

		return (<div>
			<div id="dialogTag">
				{this.props.children}
			</div>
		</div>)

	}

}


export default Content
