import React, { Component } from 'react'


export default class MessageCenter extends React.Component {

	constructor(props) {
		super(props)

		this.state = {
			messageQueue: []
		}


		var buildMessage = (message, priority, details) => {
			return {
				details: details,
				timestamp: Date.now(),
				message: (typeof message == 'string' ? [message] : message),
				priority: priority
			}
		}

		window.messageNotify = (message, priority, details) => {
			var message = buildMessage(message, priority, details)
			var messageQueue = this.state.messageQueue
			messageQueue.push(message)
			this.setState({ messageQueue: messageQueue }, () => {
				this.nextMessage()
			})
		}

		window.messageLog = (message, priority, details) => {
			var message = buildMessage(message, priority, details)
			var messages = sessionStorage.getItem('messageQueue') || '[]'
			try {
				messages = JSON.parse(messages)
			} catch (e) {
				messages = []
			}
			messages.push(message)
			sessionStorage.setItem('messageQueue', JSON.stringify(messages))
			this.props.messageLogged(messages.length)
		}

		window.messageLogNotify = (message, priority, details) => {
			window.messageNotify(message, priority, details)
			window.messageLog(message, priority, details)
		}

		window.messageLogModal = (message, priority, details) => {
			window.messageLog(message, priority, details)
			window.messageModal(message, priority, details)
		}

		window.messageModal = (message, priority, details, opts = {}) => {
			if (typeof message == 'object') {
				message = message.map(line => line.htmlEncode()).join('<br/>')
			} else {
				message = message.htmlEncode()
			}

			if (details) {
				message += `<details class="message-details" ${opts.open ? 'open' : ''}>
					<summary></summary>
					<pre>` + (typeof details === "string" ? details : JSON.stringify(details || {}, null, 4)) + `</pre>
				</details>`
			}

			LeoKit.alert(message, priority)
		}

	}


	nextMessage() {
		$('.message-center .message').removeClass('show')
		var messageQueue = this.state.messageQueue
		var currentMessage = messageQueue.shift()

		this.setState({ currentMessage: currentMessage, messageQueue: messageQueue }, () => {
			setTimeout(() => { $('.message-center .message').addClass('show') }, 0)
			if (currentMessage) {
				setTimeout(() => {
					$('.message-center .message').removeClass('show')
					setTimeout(() => {
						this.nextMessage()
					}, 500)
				}, 2500)
			}
		})
	}


	render() {

		return (<div className="message-center message-list">
			{
				this.state.currentMessage
					? (<div className={'message ' + (this.state.currentMessage.priority || 'success')}>
						{
							this.state.currentMessage.message.map((text, key) => {
								return (<div key={key}>{text}</div>)
							})
						}
					</div>)
					: false
			}
		</div>)

	}

}
