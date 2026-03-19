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
				Apply: {
					label: 'Reset checkpoint & reprocess',
					action: (formData) => {

						if (!formData.botId) {
							window.messageModal('Select a bot to update the checkpoint.', 'warning')
							return false
						}

						const botLabel = this.dataStore.nodes[formData.botId].label

						LeoKit.confirm(
							'Reset checkpoint for bot "' + botLabel + '" to this event and reprocess from here? ' +
								'The bot will handle this event and all later events on the queue (not only this single row).',
							() => {

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
									window.messageLogNotify(
										'Checkpoint reset; processing from this event for ' + botLabel,
										'info'
									)
								}).fail((result) => {
									window.messageLogModal(
										'Failure resetting checkpoint for ' + botLabel,
										'error',
										result
									)
								})

							}
						)

					}
				},
				cancel: false
			},
			'Reprocess from this event',
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
			{/* Do not add theme-form here: the dialog already wraps content in form.theme-form, and
			    .theme-form > div { display: table-row } breaks layout for callout + field rows. */}
			<div className="EventReplayDialog">
				<div className="event-replay-callout" role="note">
					<span className="event-replay-callout-title" id="event-replay-callout-heading">How this works</span>
					<ul className="event-replay-callout-list" aria-labelledby="event-replay-callout-heading">
						<li>Sets the bot&rsquo;s read checkpoint to this event.</li>
						<li>
							Processing includes <strong>this event and all later events</strong> on the queue
							&mdash;not only the row you clicked.
						</li>
					</ul>
				</div>
				<div className="event-replay-field">
					<label htmlFor="event-replay-bot-select">Select bot</label>
					<select id="event-replay-bot-select" className="wide" name="botId">
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
