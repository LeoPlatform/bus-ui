import React, { Component } from 'react';
import { inject, observer } from 'mobx-react';
import TagsInput from '../elements/tagsInput.jsx';

@inject('dataStore')
@observer
class QueueSettings extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;
		this.state = {};
	}


	componentWillMount() {

		$.get(window.api + '/eventsettings/' + encodeURIComponent(this.props.nodeData.id), (response) => {
			this.setState({
				isReady: true,
				tags: (response.other || {}).tags || '',
				min: response.min_kinesis_number,
				name: response.name || response.event,
				archived: response.archived
			})
		}).fail((result, status) => {
			if (status !== "abort" && status !== "canceled") {
				window.messageLogModal('Failure retrieving queue settings ' + this.dataStore.nodes[this.props.nodeData.id].label, 'warning', result)
				this.setState({
					isReady: true,
					tags: ''
				})
			}
		})

	}


	setDirty() {
		if (!this.state.dirty) {
			this.setState({ dirty: true })
		}
		this.props.setDirtyState && this.props.setDirtyState({
			onSave: this.onSave.bind(this),
			onReset: this.onReset.bind(this)
		})
	}


	onReset(callback) {
		callback = (typeof callback == 'function' ? callback : false)
		var formData = $('.QueueSettings').closest('form')[0].reset()
		this.setState({ dirty: false }, () => {
			this.props.setDirtyState && this.props.setDirtyState(false)
			callback && callback()
		})
	}


	onSave(callback) {
		callback = (typeof callback == 'function' ? callback : false)
		var formData = $('.QueueSettings').closest('form').serializeObject()
		var setup = {
			id: this.props.nodeData.id,
			other: {
				tags: formData.tags || null
			},
			name: formData.name,
			min_kinesis_number: formData.min || undefined
		}

		$.post(window.api + '/eventsettings/save', JSON.stringify(setup), (response) => {
			this.setState({ dirty: false }, () => {
				this.props.setDirtyState && this.props.setDirtyState(false)
				callback && callback()

				window.messageLogNotify('Queue settings saved successfully ' + this.dataStore.nodes[this.props.nodeData.id].label)
			})
		}).fail((result) => {
			window.messageLogModal('Failure saving queue ' + this.dataStore.nodes[this.props.nodeData.id].label, 'error', result)
		})
	}


	archiveQueue() {
		let node = this.dataStore.nodes[this.props.nodeData.id] || {};
		let archive = !this.state.archived;
		let data = { id: this.props.nodeData.id, event: this.props.nodeData.id, archived: archive, paused: true };
		$.post(window.api + '/eventsettings/save', JSON.stringify(data), (response) => {
			window.fetchData()
			window.messageLogNotify((!archive ? 'Unarchived' : 'Archived') + ' queue ' + (node.label || ''), 'info')
			this.setState({ archived: archive })
		}).fail((result) => {
			window.messageLogModal('Failed attempting to ' + (!archive ? 'Unarchive' : 'Archive') + ' bot ' + (node.label || ''), 'error', result)
		})
	}


	render() {

		return (<div className="QueueSettings position-relative height-1-1">

			{
				!this.state.isReady

					? <div className="theme-spinner-large"></div>

					: <div className="flex-row">

						<div className="theme-form">

							<div className="theme-form-section">
								<div className="theme-form-row theme-form-group-heading">
									<div>queue info</div>
									<div>&nbsp;</div>
								</div>
								<div>&nbsp;</div>

								<div>
									<label>Name</label>
									<input type="text" name="name" defaultValue={this.state.name} onChange={this.setDirty.bind(this)} />
								</div>
								<div>
									<label>Tags</label>
									{/*<input type="text" name="tags" defaultValue={this.state.tags} onChange={this.setDirty.bind(this)} />*/}
									<TagsInput name="tags" defaultValue={this.state.tags} onChange={this.setDirty.bind(this)} />
								</div>
								<div>
									<label>Min</label>
									<input type="text" name="min" defaultValue={this.state.min} onChange={this.setDirty.bind(this)} />
								</div>

								<div>
									<label>Id</label>
									<span className="text-left theme-color-disabled">{this.props.nodeData.id}</span>
								</div>

							</div>

							<div className="form-button-bar">
								<button type="button" className="theme-button" onClick={this.onReset.bind(this, false)}>Discard Changes</button>
								<button type="button" className="theme-button-primary" onClick={this.onSave.bind(this, false)} disabled={!this.state.dirty}>Save Changes</button>
								<button type="button" className="theme-button pull-right" onClick={this.archiveQueue.bind(this)}>
									{
										this.state.archived
											? <i className="icon-unarchive"> Unarchive</i>
											: <i className="icon-archive"> Archive</i>
									}
								</button>
							</div>

						</div>

					</div>
			}

		</div>)

	}

}

export default QueueSettings
