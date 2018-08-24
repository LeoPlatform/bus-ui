import React, {Component} from 'react';
import {inject, observer} from 'mobx-react'
import TagsInput from '../elements/tagsInput.jsx'

@inject('dataStore')
@observer
class SystemSettings extends React.Component {

	systems = {
		'Elastic Search': {
			icon: 'elasticSearch.png',
			settings: ['host']
		},
		'CSV': {
			icon: 'text_file.png',
			settings: []
		},
		'MongoDB': {
			icon: 'mongoDB.png',
			settings: ['host', 'database']
		},
		'LeoDW': {
			icon: 'LeoMane.png',
			settings: []
		},
		'Custom': {
			icon: 'system.png',
			settings: []
		}
	}


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		var defaults = (this.props.data || {})

		this.state = {
			label: defaults.label,
			icon: defaults.icon,
			tags: defaults.tags,
			settings: defaults.settings || {}
		}
	}


	componentWillMount() {

		if (this.props.action != 'create') {
			$.get(window.api + '/system/' + encodeURIComponent(this.props.nodeData.id), (response) => {
				response.isReady = true
				response.settings.system = !response.settings.system || response.settings.system == 'Vanilla' ? 'Custom' : response.settings.system
				if (response.icon == this.systems[response.settings.system].icon) {
					delete response.icon
				}
				this.defaults = JSON.parse(JSON.stringify(response))
				this.defaults.dirty = false
				this.setState(response)
			}).fail((result) => {
				window.messageLogModal('Failure retrieving system settings ' + this.dataStore.nodes[this.props.nodeData.id].label, 'warning', result)
				this.defaults = {}
				this.setState({ isReady: true })
			})
		} else {
			this.setState({ isReady: true })
		}

	}


	componentDidMount() {

		if (this.props.action == 'create') {
			LeoKit.modal($('.SystemSettings'), {
					Save: this.onSave.bind(this),
					cancel: false
				},
				'Create System',
				this.props.onClose
			)
		}

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


	setIcon(event) {
		this.setState({ dirty: true, icon: event.currentTarget.value }, () => {
			this.setDirty()
		})
	}


	setSystem(event) {
		var settings = this.state.settings
		settings.system = event.currentTarget.value
		this.setState({ settings: settings, dirty: true }, () => {
			this.setDirty()
		})
	}


	onReset(callback) {
		callback = (typeof callback == 'function' ? callback : false)
		var formData = $('.SystemSettings').closest('form')[0].reset()
		this.setState(this.defaults, () => {
			this.props.setDirtyState && this.props.setDirtyState(false)
			callback && callback()
		})
	}


	onSave(callback) {
		callback = (typeof callback == 'function' ? callback : false)
		var formData = $('.SystemSettings').closest('form').serializeObject()
		var requiredFields = JSON.parse(JSON.stringify(this.systems[formData.system].settings))

		requiredFields.push('label')

		var errors = []

		requiredFields.forEach((field) => {
			if (formData[field].trim() == '') {
				errors.push(field.capitalize() + ' is Required')
			}
		})

		if (errors.length) {
			window.messageModal(errors, 'warning')
			return false
		}

		var data = {
			label: formData.label,
			icon: formData.icon || this.systems[formData.system].icon,
			tags: formData.tags || undefined,
			settings: formData
		}
		delete formData.label
		delete formData.icon
		delete formData.tags

		$.post(window.api + '/system/' + ((this.props.nodeData || {}).id || ''), JSON.stringify(data), (response) => {
			data.response = response
			window.messageLogNotify('System settings saved successfully for "' + data.label + '"')
			this.props.data && this.props.data.onSave && this.props.data.onSave(data)
			this.props.onSave && this.props.onSave(response)
			window.fetchData()
			this.setState({ dirty: false }, () => {
				this.props.setDirtyState && this.props.setDirtyState(false)
				callback && callback()
			})
		}).fail((result) => {
			window.messageLogModal('Failure saving system settings for "' + data.label + '"', 'error', result)
			return false
		})
	}


	duplicateNode() {
		window.duplicateNode({ id: this.props.nodeData.id })
	}


	render() {

		var systemName = this.state.settings.system == 'Vanilla' ? 'Custom' : this.state.settings.system
		var system = this.systems[this.state.settings.system || Object.keys(this.systems)[0]] || this.systems.Custom

		return (<div className="height-1-1">

			<div className="SystemSettings position-relative height-1-1">

				{
					!this.state.isReady

					? <div className="theme-spinner-large"></div>

					: <div className="flex-row">

						<div className="theme-form">

							<div className="theme-form-section">
								<div className="theme-form-row theme-form-group-heading">
									<div>system info</div>
									<div>&nbsp;</div>
								</div>
								<div>&nbsp;</div>

								<div>
									<label>System</label>
									<select name="system" defaultValue={systemName} onChange={this.setSystem.bind(this)} >
										{
											Object.keys(this.systems).map((system) => {
												return (<option key={system} value={system}>{system}</option>)
											})
										}
									</select>
								</div>

								{
									system.settings.map((setting) => {
										return (<div key={setting} className="theme-required">
											<label>{setting}</label>
											<input name={setting} defaultValue={this.state.settings[setting]} onChange={this.setDirty.bind(this)} />
										</div>)
									})
								}

								<div className="theme-required">
									<label>Label</label>
									<input type="text" name="label" defaultValue={this.state.label} onChange={this.setDirty.bind(this)} />
								</div>

								<div>
									<label>Icon</label>
									<input type="url" name="icon" defaultValue={this.state.icon} placeholder="http://" onChange={this.setIcon.bind(this)} />
								</div>

								<div>
									<label>Tags</label>
									{/*<input type="text" name="tags" defaultValue={this.state.tags} onChange={this.setDirty.bind(this)} />*/}
									<TagsInput name="tags" defaultValue={this.state.tags} onChange={this.setDirty.bind(this)} />
								</div>

								{
									this.props.action != 'create'
									? (<div>
										<label>Id</label>
										<span className="text-left theme-color-disabled">{this.props.nodeData.id}</span>
									</div>)
									: false
								}

							</div>

							{
								this.props.action != 'create'
								? <div className="form-button-bar">
									<button type="button" className="theme-button pull-left" onClick={this.duplicateNode.bind(this)}>Duplicate</button>
									<button type="button" className="theme-button" onClick={this.onReset.bind(this)}>Discard Changes</button>
									<button type="button" className="theme-button-primary" onClick={this.onSave.bind(this, false)} disabled={!this.state.dirty}>Save Changes</button>
								</div>
								: false
							}

						</div>

						<div className="flow-icons">
							<img className="theme-image" src={this.state.icon ? ((!this.state.icon.match(/^https?:/) ? window.leostaticcdn + 'images/nodes/' : '') + this.state.icon) : (window.leostaticcdn + 'images/nodes/' + system.icon)} />
						</div>

					</div>
				}
			</div>

		</div>)

	}

}

export default SystemSettings
