import React, {Component} from 'react';

export default class ManageAccess extends React.Component {


	constructor(props) {
		super(props)

		this.state = {
			ips: [
				'127.0.0.1'
			]
		}
	}


	componentDidMount() {

		LeoKit.modal($('.manageAccess'),
			{},
			'Manage Access',
			this.props.onClose
		)

	}


	add() {
		this.setState({ adding: true }, () => {
			$('[name="add"]').focus()
		})
	}


	save(event) {
		var value = event.currentTarget.value
		var ips = this.state.ips
		if (value) {
			ips.push(event.currentTarget.value)
		}
		this.setState({ adding: false, ips: ips })
	}


	delete(ip) {
		var ips = this.state.ips
		ips.splice(ips.indexOf(ip), 1)
		this.setState({ ips: ips })
	}


	onKeyDown(event) {
		if (event.keyCode === 13) {
			event.currentTarget.blur()
		}
	}


	render() {

		return (<div className="display-none">
			<div className="manageAccess">

				<div className="saved-views">
					{
						this.state.ips.map((ip) => {
							return (<div key={ip} className="workflow-div flex-row flex-space">
								<span className="flex-grow">{ip}</span>
								<i className="icon-minus-circled pull-right" onClick={this.delete.bind(this, ip)} />
							</div>)
						})
					}
					<div className="workflow-div flex-row flex-space text-left">
					{
						this.state.adding
						? <input type="text" name="add" className="flex-grow theme-form-input" placeholder="ip address" onBlur={this.save.bind(this)} onKeyDown={this.onKeyDown.bind(this)} />
						: <span className="flex-grow" onClick={this.add.bind(this)}>
							<i className="icon-plus" /> add
						</span>
					}
					</div>
				</div>

			</div>
		</div>)

	}

}
