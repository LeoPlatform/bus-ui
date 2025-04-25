import React, {Component} from 'react';
import {observer, inject} from 'mobx-react';
import TagsInput from '../elements/tagsInput.jsx'
let currentRequest;


@inject('dataStore')
@observer
export default class Topics extends React.Component {

	constructor(props) {
		super(props);
        this.dataStore = this.props.dataStore;

        this.state = {
			topics: false,
			subscriptions: false,
			basicArn: 'arn:aws:sns:us-west-2:134898387190:'
		}
	}


	componentDidMount() {
        $.get('api/sns_get', (data) => {
			this.dataStore.topicInfo = data;
            this.setupData(data);
        }).fail((result) => {
            window.messageLogNotify('Failure Retrieving SNS Data', 'warning', result);
        });

		this.modal = LeoKit.modal($('#manageTopics'),
			{},
			'Manage Topics',
			this.props.onClose
		)

	}


	setupData(data) {
        let topics = {};
        let regEx = RegExp(/(?:)([^:]*)$/g);
        Object.keys(data.topicAttributes).map((key,index) => {
            topics[key] = {
                topicName: ((key.match(regEx)[0]) || ''),
                displayName: (data.topicAttributes && data.topicAttributes[key] && data.topicAttributes[key].displayName || key),
                owner: (data.topicAttributes && data.topicAttributes[key] && data.topicAttributes[key].owner || '')
            };
        });
        this.setState({
            topics: topics,
            subscriptions: data.subs,
        })
	}


	toggleDialog(dialog, defaults) {
		this.setState({ dialog: dialog, defaults: defaults || {} })
	}


	editTopic(arn) {
		this.setState({ dialog: 'UpdateTopic', defaults: this.state.topics[arn] || {} })
	}


	updateTopic(topic) {
		$.post(`api/sns_save/topic/${topic.arn}`, (response) => {
            let oldTopics = this.state.topics;
			let oldSubs = this.state.subscriptions;
            oldTopics[response.TopicArn] = {topicName: response.TopicArn, displayName: response.TopicArn, owner: response.TopicArn};
            oldSubs[response.TopicArn] = [];
            this.setState({
                topics: oldTopics,
                subscriptions: oldSubs
            });
            window.messageLogNotify(`Topic ${topic.arn} created`)
        }).fail((result) => {
            window.messageLogModal('Failed to create topic ' + (topic.arn || ''), 'error', result)
        });
	}


	editSubscription(id) {
		this.setState({ dialog: 'UpdateSubscription', defaults: this.state.subscriptions[id] || { topicARN: this.state.arn } })
	}


	updateSubscription(subscription) {
        let body = {
			"subscribe": true,
			"protocol": subscription.protocol,
			"endpoint": String(subscription.endpoint)
        };
        $.post(`api/sns_save/subscription/${subscription.topicARN}`, JSON.stringify(body), (response) => {
            let oldSubs = this.state.subscriptions;
            if (response.SubscriptionArn === 'pending confirmation') {
                response.SubscriptionArn = 'PendingConfirmation';
			}
            oldSubs[subscription.topicARN].push({
                Endpoint: subscription.endpoint,
                Protocol: subscription.protocol,
                SubscriptionArn: response.SubscriptionArn,
                TopicArn: subscription.topicARN
            });
            this.setState({
                subscriptions: oldSubs
            });
            window.messageLogNotify(`Subscription for "${subscription.endpoint}" created'`)
        }).fail((result) => {
            window.messageLogModal('Failed to create subscription', 'error', result)
        });
	}


	deleteSubscription(id) {
		LeoKit.confirm('Delete subscription for "' + id.Endpoint + '"?', () => {
            $.post(`api/sns_save/subscription/${id.TopicArn}`, JSON.stringify({ "unSub": id.SubscriptionArn }), (response) => {
                let oldSubs = this.state.subscriptions;
				Object.keys(oldSubs[id.TopicArn]).map((key,index) => {
					if (oldSubs[id.TopicArn][key].SubscriptionArn === id.SubscriptionArn) {
						delete oldSubs[id.TopicArn][key];
                        this.setState({
							subscriptions: oldSubs
						});
					}
				});
                window.messageLogNotify(`Subscription for ${id.Endpoint} deleted'`)
            }).fail((result) => {
                window.messageLogModal('Failed to delete subscription', 'error', result)
            });
		})
	}


	selectRow = (table, row) => {
		let data = (this.dataStore.topicInfo && this.dataStore.topicInfo.tags && this.dataStore.topicInfo.tags.tags) || {};
        let tags = [];
        Object.keys(data).forEach((tag) => {
            if (data[tag].indexOf(row) !== -1) {
                tags.push(tag);
            }
        });
		this.setState({
            [table]: row,
            tags: tags
        })
	}


	render() {
		let topic = this.state.topics[this.state.arn] || {};

        return (<div className="display-none">
			<div id="manageTopics" className="flex-row xbeta-feature overflow-hidden" style={{ height: 'calc(100vh - 130px)', maxHeight: 'inherit' }}>

				<div className="flex-column width-1-3 height-1-1 padding-small">

					<strong className="text-left">Topics</strong>
					<div className="theme-table-fixed-header">
						<table>
							<thead>
								<tr>
									<th>Display Name</th>
									<th className="theme-2-icon-column"></th>
								</tr>
							</thead>
							<tbody>
								{
									this.state.topics
									? Object.keys(this.state.topics).map((arn) => {
										var topic = this.state.topics[arn]
										return (<tr key={arn} className={this.state.arn === arn ? 'active' : ''} onClick={this.selectRow.bind(this, 'arn', arn)}>
											<td>{topic.displayName}</td>
										</tr>)
									})
									: (<tr><td><div className="theme-spinner-small" /></td></tr>)
								}
							</tbody>
						</table>
					</div>
					<div className="text-right padding-small">
						<div className="theme-button-primary" onClick={this.editTopic.bind(this, false)}>Create Topic</div>
					</div>

				</div>

				{
					this.state.arn
					? (<div className="flex-column width-2-3 height-1-1 padding-small">

						<strong>Topic Details: {topic.displayName === this.state.arn ? '' : topic.displayName}</strong>

						<div className="theme-form">
							<div><label>Topic ARN</label><span className="user-selectable">{this.state.arn}</span></div>
							<div><label>Topic Owner</label><span>{topic.owner}</span></div>
							<div><label>Display Name</label><span>{topic.displayName === this.state.arn ? '' : topic.displayName}</span></div>
							<div><label>Tags</label><TagsInput name="tags" defaultValue={this.state.tags} alerts={true} tags={(this.dataStore.topicInfo && this.dataStore.topicInfo.tags) || {}} arn={this.state.arn}/></div>
						</div>

						<strong className="text-left">Subscriptions</strong>
						<div className="theme-table-fixed-header theme-table-overflow-hidden">
							<table>
								<thead>
									<tr>
										<th className="width-1-2">Subscription ID</th>
										<th>Protocol</th>
										<th>Endpoint</th>
										<th className="theme-2-icon-column"></th>
									</tr>
								</thead>
								<tbody>
									{
										this.state.subscriptions
										? this.state.subscriptions[this.state.arn].map((key, id) => {
											return (<tr key={id}>
												<td className="width-1-2">{key.SubscriptionArn}</td>
												<td>{key.Protocol}</td>
												<td>{key.Endpoint}</td>
												{
													key.SubscriptionArn !== 'PendingConfirmation' ?
														<td className="theme-2-icon-column">
															<i className="icon-cancel cursor-pointer"
															   onClick={this.deleteSubscription.bind(this, key)}/>
														</td>
														:
														<td className="theme-2-icon-column">
														</td>
												}

											</tr>)
										})
										: (<tr><td><div className="theme-spinner-small" /></td></tr>)
									}
								</tbody>
							</table>
						</div>
						<div className="text-right padding-small">
							<div className="theme-button-primary" onClick={this.editSubscription.bind(this, false)}>Create Subscription</div>
						</div>
					</div>)
					: false
				}

				{
					(() => {
						switch(this.state.dialog) {
							case 'UpdateTopic':
								return <UpdateTopic defaults={this.state.defaults} updateTopic={this.updateTopic.bind(this)} onClose={this.toggleDialog.bind(this, false, {})} />
							break

							case 'UpdateSubscription':
								return <UpdateSubscription defaults={this.state.defaults} updateSubscription={this.updateSubscription.bind(this)} topics={this.state.topics} onClose={this.toggleDialog.bind(this, false, {})} />
							break
						}
					})()
				}

			</div>
		</div>)

	}

}



class UpdateTopic extends React.Component {

	constructor(props) {
		super(props)
		this.state = this.props.defaults
	}


	componentDidMount() {

		LeoKit.modal($('#updateTopic'),
			{
				['Create Topic']: (formData) => {
                    formData.arn = formData.topicName || '';
                    let missing = Object.keys(formData).filter(data => !formData[data]);
					if (missing.length) {
						LeoKit.alert(
							missing.map(miss => $('[name="' + miss + '"]').prev().text() + ' is required<br/>'),
							'error'
						)
						return false
					}
					this.props.updateTopic(formData)
				},
				close: false
			},
			(this.props.defaults.arn ? 'Update Topic' : 'Create New Topic'),
			this.props.onClose
		)

	}


	setDisplayName(event) {
		if (!$('[name="displayName"]').val()) {
			$('[name="displayName"]').val(event.currentTarget.value)
		}
	}


	updateField(event) {
		this.setState({ [event.currentTarget.name]: event.currentTarget.value })
	}


	render() {

		return (<div>
			<div id="updateTopic" className="theme-form width-1-1">
				<input type="hidden" name="arn" value={this.state.arn || ''} />
				<small>A topic name will be used to create a permanent unique identifier called an Amazon Resoure Name (ARN).</small>
				<div className="theme-required">
					<label>Topic Name</label>
					<input type="text" pattern=".+" name="topicName" value={this.state.topicName || ''} className="wide" placeholder="Enter topic name" onBlur={this.setDisplayName.bind(this)} onChange={this.updateField.bind(this)} />
				</div>
				{/*<div className="theme-required">*/}
					{/*<label>Display Name</label>*/}
					{/*<input type="text" pattern=".+" name="displayName" value={this.state.displayName || ''} className="wide" placeholder="Enter topic display name.  Required for topics with SMS subscriptions." onChange={this.updateField.bind(this)} />*/}
				{/*</div>*/}
			</div>
		</div>)

	}

}


class UpdateSubscription extends React.Component {

	constructor(props) {
		super(props);
		this.state = this.props.defaults
	}


	componentDidMount() {

		LeoKit.modal($('#updateSubscription'),
			{
				[this.props.defaults.id ? 'Update Subscription' : 'Create Subscription']: (formData) => {
					formData.id = formData.id || formData.topicARN + Math.random() * 10000000

					var errors = Object.keys(formData).filter(data => !new RegExp($('[name="' + data + '"]').attr('pattern')).test(formData[data]) ).map(err => $('[name="' + err + '"]').prev().text() + ($('[name="' + err + '"]').val() === '' ? ' is required' : ' is in error'))

					if (errors.length) {
						LeoKit.alert(errors.join('<br/>'), 'error')
						return false
					}

					this.props.updateSubscription(formData)
				},
				close: false
			},
			(this.props.defaults.id ? 'Update Subscription' : 'Create New Subscription'),
			this.props.onClose
		)

	}


	updateField(event) {
		this.setState({ [event.currentTarget.name]: event.currentTarget.value })
	}


	render() {

		let protocols = {
			email:        { label: 'Email', placeholder: 'example@example.com', pattern: '.+@.+\\..+' },
			sms:          { label: 'SMS', placeholder: '1-800-555-1212', pattern: '\\d{1}[^\\d]?\\d{3}[^\\d]?\\d{3}[^\\d]?\\d{4}' }
		};

		var protocol = (protocols[this.state.protocol || Object.keys(protocols)[0]])

		return (<div>
			<div id="updateSubscription" className="theme-form width-1-1">
				<input type="hidden" name="id" value={this.state.id || ''} />
				<div className="theme-required">
					<label>Topic ARN</label>
					<select name="topicARN" className="wide" value={this.state.topicARN || ''} onChange={this.updateField.bind(this)}>
						{
							Object.keys(this.props.topics).map((arn) => {
								return (<option key={arn} value={arn}>{this.props.topics[arn].displayName}</option>)
							})
						}
					</select>
				</div>
				<div className="theme-required">
					<label>Protocol</label>
					<select name="protocol" value={this.state.protocol || ''} onChange={this.updateField.bind(this)}>
						{
							Object.keys(protocols).map((protocol) => {
								return (<option key={protocol} value={protocol}>{protocols[protocol].label}</option>)
							})
						}
					</select>
				</div>
				<div className="theme-required">
					<label>Endpoint</label>
					<input type="text" name="endpoint" className="wide" value={this.state.endpoint || ''} onChange={this.updateField.bind(this)} placeholder={protocol.placeholder} pattern={protocol.pattern || '.+'} />
				</div>
			</div>
		</div>)

	}

}
