import React, {Component} from 'react'


export default class MessageList extends React.Component {

	constructor(props) {
		super(props)

		this.state = {
			messages: JSON.parse(sessionStorage.getItem('messageQueue') || '[]').reverse()
		}
	}


	componentDidMount() {

		this.modal = LeoKit.modal($('.messageList'),
			{},
			'Messages',
			this.props.onClose
		)

	}


	clearMessage(index) {
		var messages = this.state.messages
		messages.splice(index, 1)
		sessionStorage.setItem('messageQueue', JSON.stringify(messages.reverse()))
		this.setState({ messages: messages.reverse() }, () => {
			LeoKit.center(this.modal)
		})
		this.props.messageDeleted(messages.length)
	}


	clearMessages() {
		sessionStorage.removeItem('messageQueue')
		this.setState({ messages: [] }, () => {
			LeoKit.center(this.modal)
		})
		this.props.messageDeleted(0)
	}


	render() {

		return (<div className="display-none">
			<div className="messageList">
				{
					this.state.messages && this.state.messages.length > 0
					? <div className="height-1-1 overflow-hidden">
						<div className="height-1-1 message-list">
						{
							this.state.messages.map((message, index) => {
								if (typeof message.message == 'object' && !message.message.length) {
									message.message = Object.keys(message.message)
								}
								return (<div key={index} className={'message ' + (message.priority || 'success')}>
									<div>
										{(message.message || message).map((message, key) => {
											return (<span key={key}>{message}</span>)
										})}
										<i className="icon-minus-circled pull-right" onClick={this.clearMessage.bind(this, index)} />
										<div className="details-wrapper">
										{
											message.details
											? (
												this.state.detailIndex === index
												? [
													<div key="0" className="details">{JSON.stringify(message.details || {}, null, 4)}</div>,
													<span key="1" className="pull-right cursor-pointer" onClick={() => { this.setState({ detailIndex: undefined })}}>hide details</span>
												]
												: <span className="pull-right cursor-pointer" onClick={() => { this.setState({ detailIndex: index }, () => { LeoKit.center(this.modal) })}}>view details</span>
											)
											: false
										}
										</div>
										<small>{message.timestamp ? moment(message.timestamp).format('MMM D @ h:mm:ss a') : '-'}</small>
									</div>
								</div>)
							})
						}
						</div>
						<div>
							<button type="button" className="theme-button pull-right" onClick={this.clearMessages.bind(this)}>Clear Message List</button>
						</div>
					</div>
					: (<div>No messages</div>)
				}
			</div>
		</div>)

	}

}
