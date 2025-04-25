import React, { Component } from 'react'
import { inject, observer } from 'mobx-react'
let refUtil = require("leo-sdk/lib/reference.js");

@inject('dataStore')
@observer
class EventReplay extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {
			bots: {}
		}
	}


	componentWillMount() {

		var range_count = window.timePeriod.interval.split('_')
		this.currentRequest = $.get(`api/dashboard/${encodeURIComponent(this.props.detail.event)}?range=${range_count[0]}&count=${range_count[1] || 1}&timestamp=${encodeURIComponent(moment().format())}`, (result) => {
			this.setState({ bots: result.bots.read })
		}).fail((result) => {
			result.call = `api/dashboard/${encodeURIComponent(this.props.detail.event)}?range=${range_count[0]}&count=${range_count[1] || 1}&timestamp=${encodeURIComponent(moment().format())}`
			window.messageLogModal('Failure get data', 'error', result)
		}).always(() => {
			this.currentRequest = null;
		})


	}


	componentDidMount() {

		LeoKit.modal($('.EventReplayDialog'),
			{
				Replay: (formData) => {

					if (!formData.botId) {
						window.messageModal('No bot to replay to', 'warning')
						return false
					}

					LeoKit.confirm('Replay bot "' + this.dataStore.nodes[formData.botId].label + '".', () => {

						let checkpoint = this.props.detail.eid;

						if (checkpoint.slice(-1) == '0') {
							checkpoint = checkpoint.slice(0, -1)
						} else {
							checkpoint = checkpoint.slice(0, -1) + (checkpoint.slice(-1) - 1)
						}

						let id = refUtil.botRef(formData.botId).id;

						let data = {
							id: id,
							checkpoint: { [`queue:${this.props.detail.event}`]: checkpoint },
							executeNow: true
						};

						$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
							window.messageLogNotify('Replay triggered for ' + this.dataStore.nodes[formData.botId].label, 'info')
						}).fail((result) => {
							window.messageLogModal('Failure triggering replay for ' + this.dataStore.nodes[formData.botId].label, 'error', result)
						})

					})

				},
				cancel: false
			},
			'Replay Event',
			this.props.onClose
		)

	}


	componentWillUnmount() {
		if (this.currentRequest) {
			this.currentRequest.abort()
		}
	}


	render() {

		return (<div>
			<div className="EventReplayDialog theme-form">
				{/*<div>
					<label>Replay Single Event</label>
					<input type="radio" name="events" value="1" />
				</div>
				<div>
					<label>Replay all Events from this point on</label>
					<input type="radio" name="events" value="${eventCount}" />
				</div>*/}
				<div>
					<label>Select Bot</label>
					<select name="botId">
						{
							Object.keys(this.state.bots).map((botId) => {
								var bot = this.dataStore.nodes[botId] || this.state.bots[botId]
								return (!bot.archived
									? (<option key={botId} value={botId}>{bot.label}</option>)
									: false
								)
							})
						}
					</select>
				</div>
			</div>
		</div>)

	}

}

export default EventReplay
