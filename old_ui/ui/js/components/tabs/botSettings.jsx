import React, { Component } from 'react';
import { inject, observer } from 'mobx-react'

import DynamicForm from '../elements/dynamicForm.jsx'
import NodeIcon from '../elements/nodeIcon.jsx'
let refUtil = require("leo-sdk/lib/reference.js");

@inject('dataStore')
@observer
class BotSettings extends React.Component {

	requiredFields = {}

	codeMirrorJSONOptions = {
		mode: { name: "javascript", json: true },
		//mode:  { name: "javascript" },
		lineWrapping: true,
		lineNumbers: true,
		indentWithTabs: true,
		matchBrackets: true,
		autoCloseBrackets: true,
		theme: 'eclipse',
		indentUnit: 4,
		tabSize: 4,
		gutters: ["CodeMirror-lint-markers"],
		lint: {
			options: {
				esversion: 6
			}
		},
		//autofocus: true
	}


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		var settings = (props.nodeData || props.data || {})
			, settingsId = settings.type == 'bot' ? settings.id : undefined

		this.state = {
			settingsId: settingsId,
			defaults: {},
			archived: (this.dataStore.nodes[(props.nodeData || {}).id] || {}).archived,
			source_lag: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.source_lag / 60 / 1000) || ''),
			old_source_lag: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.source_lag)),
			write_lag: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.write_lag / 60 / 1000) || ''),
			old_write_lag: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.write_lag)),
			error_limit: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.error_limit * 100) || ''),
			old_error_limit: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.error_limit)),
			consecutive_errors: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.consecutive_errors) || ''),
			old_consecutive_errors: ((this.dataStore.nodes[props.nodeData.id] && this.dataStore.nodes[props.nodeData.id].health && this.dataStore.nodes[props.nodeData.id].health.consecutive_errors)),
			check1: false,
			check2: false,
			check3: false,
			check4: false
		};

		this.handle1 = this.handle1.bind(this);
		this.handle2 = this.handle2.bind(this);
		this.handle3 = this.handle3.bind(this);
		this.handle4 = this.handle4.bind(this);
		this.check1 = this.check1.bind(this);
		this.check2 = this.check2.bind(this);
		this.check3 = this.check3.bind(this);
		this.check4 = this.check4.bind(this);
	}

	resetOverrides() {
		this.setState({
			source_lag: undefined,
			write_lag: undefined,
			error_limit: undefined,
			consecutive_errors: undefined,
			dirty: true
		});
	}


	componentWillReceiveProps() {
		if (this.state.old_source_lag !== this.dataStore.nodes[this.props.nodeData.id].health.source_lag) {
			this.setState({
				source_lag: ((this.dataStore.nodes[this.props.nodeData.id].health.source_lag / 60 / 1000) || ''),
				old_source_lag: this.dataStore.nodes[this.props.nodeData.id].health.source_lag,
				dirty: true
			})
		}
		if (this.state.old_write_lag !== this.dataStore.nodes[this.props.nodeData.id].health.write_lag) {
			this.setState({
				write_lag: ((this.dataStore.nodes[this.props.nodeData.id].health.write_lag / 60 / 1000) || ''),
				old_write_lag: this.dataStore.nodes[this.props.nodeData.id].health.write_lag,
				dirty: true
			})
		}
		if (this.state.old_error_limit !== this.dataStore.nodes[this.props.nodeData.id].health.error_limit) {
			this.setState({
				error_limit: ((this.dataStore.nodes[this.props.nodeData.id].health.error_limit * 100) || ''),
				old_error_limit: this.dataStore.nodes[this.props.nodeData.id].health.error_limit,
				dirty: true
			})
		}
		if (this.state.old_consecutive_errors !== this.dataStore.nodes[this.props.nodeData.id].health.consecutive_errors) {
			this.setState({
				consecutive_errors: ((this.dataStore.nodes[this.props.nodeData.id].health.consecutive_errors) || ''),
				old_consecutive_errors: this.dataStore.nodes[this.props.nodeData.id].health.consecutive_errors,
				dirty: true
			})
		}
	}


	componentDidMount() {

		this.templates = window.templates// data.lambda_templates
		this.getInitSettings(this.initCodeAreas.bind(this))

		if (this.props.action == 'create') {
			this.modal = LeoKit.modal($('.BotSettings'), {
				Save: this.onSave.bind(this),
				cancel: false
			},
				'Create ' + (this.props.data.group || this.props.data.groups[0]).capitalize(),
				this.props.onClose
			)
		}

	}


	componentWillUnmount() {

		this.isUnmounting = true

		for (var instanceName in this.codeMirrorInstances) {
			this.codeMirrorInstances[instanceName].toTextArea()
			delete this.codeMirrorInstances[instanceName]
		}

	}


	onReset(callback) {
		callback = (typeof callback == 'function' ? callback : false)

		for (var instanceName in this.codeMirrorInstances) {
			this.codeMirrorInstances[instanceName].toTextArea()
			delete this.codeMirrorInstances[instanceName]
		}

		this.getInitSettings(() => {
			this.initCodeAreas()
		})
		this.props.setDirtyState && this.props.setDirtyState(false)
		callback && callback()
	}


	getInitSettings(callback) {
		if (this.state.settingsId) {
			$.get(window.api + '/cron/' + encodeURIComponent(this.state.settingsId), (response) => {
				this.saveInitSettings(response, callback)
			}).fail((result) => {
				result.call = window.api + '/cron/' + this.state.settingsId
				window.messageLogNotify('Failed to get bot settings', 'warning', result)
			})
		} else {
			this.saveInitSettings({}, callback)
		}
	}


	saveInitSettings(response, callback) {
		if (!this.isUnmounting) {

			var templateId = (response.templateId || response.lambdaName)
			this.requiredFields = {}

			var settings = ((response.lambda || {}).settings || [])[0] || {}

			var triggerSource = (this.dataStore.nodes[(this.props.data || {}).id || 'e_' + settings.source] || this.dataStore.nodes['s_' + settings.source] || {}).id
			if (this.props.action == 'create' && !response.triggers && triggerSource) {
				response.triggers = [triggerSource]
			}

			var defaults = {
				source: settings.source, //(settings.source || '').replace(/^system\./, ''),
				destination: settings.destination, //(settings.destination || '').replace(/^system\./, ''),
				templateId: (response.templateId || response.lambdaName),
				name: response.name,
				description: response.description,
				tags: response.tags,
				triggers: response.triggers, // || (triggerSource ? [triggerSource] : null),
				time: response.time,
				invocationType: response.invocationType,
				lambdaName: response.lambdaName,
				health: response.health
			}

			if (defaults.time && defaults.triggers && defaults.triggers.constructor === Array && defaults.triggers.length === 0) {
				defaults.triggers = null
			}

			Object.keys(settings).forEach((setting) => {
				//defaults[setting] = (typeof settings[setting] == 'object') ? (settings[setting].value || undefined) : settings[setting]
				defaults[setting] = settings[setting]
			})

			var sourceNodeTypes = 'systems|queues|new'
			var destinationNodeTypes = 'systems|queues|new'

			if (templateId) {
				var template = window.templates && window.templates[templateId] ? window.templates[templateId] : {};
				if (template && template.matches) {
					if (template.matches.source) {
						if (template.matches.source.slice(0, 5) == 'queue') {
							sourceNodeTypes = 'queues|new'
						}
						if (template.matches.source.slice(0, 6) == 'system') {
							sourceNodeTypes = 'systems|new'
						}
					}
					if (template.matches.destination) {
						if (template.matches.destination.slice(0, 5) == 'queue') {
							destinationNodeTypes = 'queues|new'
						}
						if (template.matches.destination.slice(0, 6) == 'system') {
							destinationNodeTypes = 'systems|new'
						}
					}
				}
			}

			this.setState({
				templateId: templateId,
				templates: templateId ? { [templateId]: (window.templates && window.templates[templateId] ? window.templates[templateId] : {}) } : {},
				id: (this.props.nodeData || {}).id,
				lambda: response.lambda || { settings: [{}] },
				lambdaSettings: response.lambda && response.lambda.settings ? response.lambda.settings[0] || {} : {},
				dirty: false,
				sourceNodeTypes: sourceNodeTypes,
				destinationNodeTypes: destinationNodeTypes,
				defaults: defaults,
				editingSource: false,
				editingDestination: false,
				health: defaults.health
			}, () => {
				if (this.props.action == 'create') {
					this.setSource(this.props.data ? this.props.data.id : undefined)
				}
				callback()
			})
		}
	}


	onSave(formData) {

		var callback = (typeof formData == 'function' ? formData : false)

		if (!formData || typeof formData == 'function') {
			formData = $('.BotSettings').closest('form').serializeObject()
		}

		var errors = [];
		var settings = formData.templateId ? (this.templates && this.templates[formData.templateId] || {}).settings || {} : {};

		Object.keys(this.requiredFields).forEach((fieldName) => {
			var field = this.requiredFields[fieldName]
			if (typeof field == 'object') {
				fieldName = field.name || fieldName
			}
			if (formData[fieldName] == '') {
				errors.push(field.label.replace(/_/g, ' ').capitalize() + ' is Required')
			} else {
				//validate json
				if (field.type == 'json') {
					try {
						var test = JSON.parse(formData[fieldName])
					} catch (errorMsg) {
						errors.push(field.label.replace(/_/g, ' ').capitalize() + ' ' + errorMsg)
					}
				}
			}
		})

		var lambda = this.state.lambda
		var data = {}
		lambda.settings = lambda.settings || [{}]

		Object.keys(settings).forEach((settingName) => {
			var setting = settings[settingName]
			if (typeof setting == 'object') {
				settingName = setting.name || settingName
			}

			if (setting.group) {
				Object.keys(setting.group).forEach((subsettingName) => {
					var subsetting = setting.group[subsettingName]
					if (typeof subsetting == 'object') {
						subsettingName = subsetting.name || subsettingName
					}
					if (formData[subsettingName]) {
						if (!lambda.settings[0][settingName]) {
							lambda.settings[0][settingName] = {}
						}
						if ((subsetting.type || subsetting) == 'json') {
							try {
								formData[subsettingName] = JSON.parse(formData[subsettingName])
							} catch (e) {
								errors.push(subsetting.label.capitalize() + ' - ' + e)
							}
						}
						lambda.settings[0][settingName][subsettingName] = formData[subsettingName]
					}
				})
			} else if (formData[settingName]) {
				if ((setting.type || setting) == 'json') {
					try {
						formData[settingName] = JSON.parse(formData[settingName])
					} catch (e) {
						errors.push(setting.label.capitalize() + ' - ' + e)
					}
				}
				lambda.settings[0][settingName] = formData[settingName]
			}
		})

		if (errors.length > 0) {
			window.messageModal(errors, 'warning')
			return false
		}

		if (this.props.action == 'create' && formData.templateId && (this.templates && this.templates[formData.templateId] && this.templates[formData.templateId].code)) {
			lambda.settings[0].mappings = this.templates[formData.templateId].code
		}

		if (formData.time == 'null') {
			formData.time = null
		}

		data.id = formData.id ? formData.id : undefined;
		data.name = formData.name;
		data.description = formData.description || null;
		data.triggers = formData.triggers ? [formData.triggers] : null;
		data.time = formData.triggers ? null : (formData.time || null);
		data.tags = formData.tags || null;
		data.templateId = formData.templateId;
		data.invocationType = formData.invocationType;

		let source_lag = '';
		let write_lag = '';
		let error_limit = '';
		let consecutive_errors = '';
		if (formData.source_lag !== '') {
			source_lag = formData.source_lag || (this.dataStore.nodes[formData.id] && this.dataStore.nodes[formData.id].health && this.dataStore.nodes[formData.id].health.source_lag / 1000 / 60) || '';
		}
		if (formData.write_lag !== '') {
			write_lag = formData.write_lag || (this.dataStore.nodes[formData.id] && this.dataStore.nodes[formData.id].health && this.dataStore.nodes[formData.id].health.write_lag / 1000 / 60) || '';
		}
		if (formData.error_limit !== '') {
			error_limit = formData.error_limit || (this.dataStore.nodes[formData.id] && this.dataStore.nodes[formData.id].health && this.dataStore.nodes[formData.id].health.error_limit * 100) || '';
		}
		if (formData.consecutive_errors !== '') {
			consecutive_errors = formData.consecutive_errors || (this.dataStore.nodes[formData.id] && this.dataStore.nodes[formData.id].health && this.dataStore.nodes[formData.id].health.consecutive_errors) || '';
		}

		if (typeof source_lag === 'number') {
			source_lag = 1000 * 60 * source_lag;
		}
		if (typeof write_lag === 'number') {
			write_lag = 1000 * 60 * write_lag;
		}
		if (typeof error_limit === 'number') {
			error_limit = error_limit / 100;
		}

		data.health = Object.assign({}, this.state.health, { source_lag: source_lag, write_lag: write_lag, error_limit: error_limit, consecutive_errors: consecutive_errors });

		if (formData.templateId) {
			data.lambdaName = formData.lambdaName || (this.templates && this.templates[formData.templateId] || {}).lambda || formData.templateId
			data.lambda = lambda
		}

		lambda.settings[0].source = formData.source || undefined
		lambda.settings[0].destination = formData.destination || undefined

		if (this.state.sourceId) {
			lambda.settings[0].source = (
				((this.dataStore.nodes[this.state.sourceId] || {}).type === 'system')
					? 'system.'
					: ''
			) + ((this.dataStore.nodes[this.state.sourceId] || {}).id || this.state.sourceId)
		}

		if (this.state.destinationId) {
			lambda.settings[0].destination = (
				((this.dataStore.nodes[this.state.destinationId] || {}).type === 'system')
					? 'system.'
					: ''
			) + ((this.dataStore.nodes[this.state.destinationId] || {}).id || this.state.destinationId)
		}

		if (!!formData.checkpoint || formData.checkpoint == 0) {
			data.checkpoint = formData.checkpoint
			data.executeNow = true
		}

		if (this.props.action == 'create') {
			data.paused = true
			data.checkpoint = 'z' + moment().format('/YYYY/MM/DD/HH/mm/ss/')
		}

		if (this.props.data && this.props.data.system) {
			data.system = this.props.data.system
			if (this.state.systemId && !data.system.id) {
				data.system.id = this.state.systemId
			}
			if (formData.systemName && !data.system.label) {
				data.system.label = formData.systemName
			}
		}

		if (!formData.error_limit) {
			formData.error_limit = '';
		}


		if (formData.error_limit > -1 && formData.error_limit < 101) {
			$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
				window.messageLogNotify('Bot settings saved successfully for ' + data.name)
				if (this.props.onSave) { //add
					if (typeof response == 'object') {
						response.label = data.name
					}
					this.props.onSave(response)
				} else if (this.props.nodeData) { //update
					window.nodeTree.updateDiagram && window.nodeTree.updateDiagram(null, true)
				}
				(this.props.data || {}).onSave && this.props.data.onSave(response)
				if (this.props.action != 'create') {
					this.setState({ dirty: false })
					this.props.setDirtyState && this.props.setDirtyState(false)
				}
				callback && callback()
			}).fail((result) => {
				window.messageLogModal('Error saving bot ' + data.name, 'error', result)
				return false
			})
		} else {
			window.messageLogModal('Errors Per Executions must be between 0 and 100', 'error')
		}

	}


	setDirty(event) {

		if (event && event.currentTarget) {
			var fieldName = event.currentTarget.name
			var fieldValue = event.currentTarget.value
			this.setState((currentState) => {
				currentState.defaults[fieldName] = fieldValue
				return currentState
			})
		}

		if (!this.state.dirty) {
			this.setState({ dirty: true })
		}

		this.props.setDirtyState && this.props.setDirtyState({
			onSave: this.onSave.bind(this),
			onReset: this.onReset.bind(this)
		})
	}


	setTrigger(value) {
		this.setState((currentState) => {
			if (!value) {
				currentState.defaults.triggers = null
				currentState.defaults.time = null
			} else if (value && value.constructor == Array) {
				currentState.defaults.triggers = value
				currentState.defaults.time = null
			} else {
				currentState.defaults.triggers = null
				currentState.defaults.time = value
			}

			return currentState
		}, this.setDirty.bind(this))
	}


	setSource(sourceId, dontAsk) {
		if (typeof sourceId === 'object') {
			sourceId = sourceId.id
		}

		var source = this.dataStore.nodes[sourceId]
		if (this.props.action === 'create') {
			if (sourceId && !source && !dontAsk) {
				this.askNewType(sourceId, 'source')
			} else {
				source = source || {}
				var sourceKey = (source.type || (sourceId ? 'queue' : '')) + ((source.type == 'system' && source.system) ? ':' + source.system : '') + ':' + (source.label || '')
				this.setState({ sourceId: sourceId, sourceKey: sourceKey }, this.filterTemplates.bind(this))
			}
		} else {
			source = source || {}
			this.setState((currentState) => {
				currentState.defaults.source = (source.type === 'system' ? 'system.' : '') + source.id
				return currentState
			}, this.setDirty.bind(this))
		}
	}


	setDestination(destinationId, dontAsk) {
		if (typeof destinationId === 'object') {
			destinationId = destinationId.id
		}
		var destination = this.dataStore.nodes[destinationId]
		if (this.props.action === 'create') {
			if (destinationId && !destination && !dontAsk) {
				this.askNewType(destinationId, 'destination')
			} else {
				destination = destination || {}
				var destinationKey = (destination.type || (destinationId ? 'queue' : '')) + (destination.type == 'system' ? ':' + destination.system : '') + ':' + (destination.label || destinationId || '')
				this.setState({ destinationId: destinationId, destinationKey: destinationKey }, this.filterTemplates.bind(this))
			}
		} else {
			destination = destination || {}
			this.setState((currentState) => {
				currentState.defaults.destination = (destination.type === 'system' ? 'system.' : '') + destination.id
				return currentState
			}, this.setDirty.bind(this))
		}
	}


	askNewType(id, type) {

		LeoKit.confirm('Will this new node be a Queue or a System?', {
			Queue: () => {
				if (type == 'source') {
					this.setSource(id, true)
				} else {
					this.setDestination(id, true)
				}
			},
			System: () => {
				(
					(type == 'destination')
						? window.createSystem({
							label: id, onSave: (data) => {
								var defaults = this.state.defaults
								defaults.destination = 'system.' + data.response.id
								var destinationKey = 'system' + ':' + data.settings.system + ':' + data.label
								this.setState({ destinationId: data.response.id, desourceKey: destinationKey, defaults: defaults }, this.filterTemplates.bind(this))
							}
						})
						: window.createSystem({
							label: id, onSave: (data) => {
								var defaults = this.state.defaults
								defaults.source = 'system.' + data.response.id
								var sourceKey = 'system' + ':' + data.settings.system + ':' + data.label
								this.setState({ sourceId: data.response.id, sourceKey: sourceKey, defaults: defaults }, this.filterTemplates.bind(this))
							}
						})
				)
			}
		}, false)

	}


	filterTemplates() {

		var templates = {}
			, sourceKey = this.state.sourceKey
			, destinationKey = this.state.destinationKey
			, sourceNodeTypes = {}
			, destinationNodeTypes = {}

		Object.keys(this.templates).forEach((templateId) => {
			var template = (this.templates && this.templates[templateId])

			try {

				if (template.matches
					&& (RegExp(template.matches.source).test(sourceKey) || (sourceKey == ':') || (!sourceKey))
					&& (RegExp(template.matches.destination).test(destinationKey) || (destinationKey == ':') || (!destinationKey))
					&& (template.matches.group == this.props.data.group || (this.props.data.groups || []).indexOf(template.matches.group) != -1)
				) {
					templates[templateId] = template.name

					if (template.matches && template.matches) {

						if (template.matches.source) {
							switch (template.matches.source.split(':')[0]) {
								case 'queue':
									sourceNodeTypes['queues'] = true
									sourceNodeTypes['new'] = true
									break

								case 'system':
									sourceNodeTypes['systems'] = true
									sourceNodeTypes['new'] = true
									break

								case '.*':
									sourceNodeTypes['queues'] = true
									sourceNodeTypes['systems'] = true
									sourceNodeTypes['new'] = true
									break
							}
						}

						if (template.matches.destination) {
							switch (template.matches.destination.split(':')[0]) {
								case 'queue':
									destinationNodeTypes['queues'] = true
									destinationNodeTypes['new'] = true
									break

								case 'system':
									destinationNodeTypes['systems'] = true
									destinationNodeTypes['new'] = true
									break

								case '.*':
									destinationNodeTypes['queues'] = true
									destinationNodeTypes['systems'] = true
									destinationNodeTypes['new'] = true
									break
							}
						}

					}

				}

			} catch (e) {
				window.messageLogNotify('Error in regex matching source and destination to template: ' + template.name, 'error', e)
			}

		})

		this.requiredFields = {}

		this.setState({
			templates: templates,
			templateId: (Object.keys(templates).indexOf(this.state.templateId) != -1 ? this.state.templateId : undefined),
			sourceNodeTypes: Object.keys(sourceNodeTypes).join('|') || 'systems|queues|new',
			destinationNodeTypes: Object.keys(destinationNodeTypes).join('|') || 'systems|queues|new'
		}, () => {
			this.initCodeAreas()
			LeoKit.center(this.modal)
		})
	}


	codeMirrorInstances = []

	initCodeAreas() {

		$('.BotSettings textarea.codeMirror').each((index, textArea) => {
			var textareaName = $(textArea).attr('name')
			if (!(textareaName in this.codeMirrorInstances) || $(textArea).next('.CodeMirror').length == 0) {
				var codeMirrorInstance = CodeMirror.fromTextArea(textArea, this.codeMirrorJSONOptions)
				this.codeMirrorInstances[textareaName] = codeMirrorInstance
				codeMirrorInstance.on('change', () => {
					return ((codeMirrorInstance) => {
						clearTimeout(this.typingTimeout)
						this.typingTimeout = setTimeout(() => {
							codeMirrorInstance.save()
							this.setJSONText(textArea)
						}, 300)
					})(codeMirrorInstance)
				})
			}
		})

		LeoKit.center(this.modal)
	}

	handle1(e) {
		this.setState({
			source_lag: e.target.value,
			dirty: true
		});
	}

	handle2(e) {
		this.setState({
			write_lag: e.target.value,
			dirty: true
		});
	}

	handle3(e) {
		this.setState({
			error_limit: e.target.value,
			dirty: true
		});
	}

	handle4(e) {
		this.setState({
			consecutive_errors: e.target.value,
			dirty: true
		});
	}

	check1() {
		this.setState({
			check1: !this.state.check1
		});
	}

	check2() {
		this.setState({
			check2: !this.state.check2
		});
	}

	check3() {
		this.setState({
			check3: !this.state.check3
		});
	}

	check4() {
		this.setState({
			check4: !this.state.check4
		});
	}


	setJSONText(textArea) {
		this.setState((currentState) => {
			try {
				currentState.defaults[textArea.name] = JSON.parse(textArea.value)
			} catch (e) {
				console.log('e', e)
				currentState.defaults[textArea.name] = textArea.value
			}
			return currentState
		}, this.setDirty.bind(this))
	}


	invocationTypeChange(value) {
		if (typeof value == 'string') {
			this.setState((currentState) => {
				currentState.defaults.invocationType = value
				return currentState
			}, this.setDirty.bind(this))
		} else if (value.currentTarget) {
			value = value.currentTarget.value
			this.setState((currentState) => {
				currentState.defaults.lambdaName = value || ''
				return currentState
			}, this.setDirty.bind(this))
		}
	}


	setSystem(systemId) {
		this.setState({ systemId: systemId })
	}


	setTemplate(event) {
		this.requiredFields = {}
		this.setState({ templateId: event.currentTarget.value, time: this.templates[event.currentTarget.value].time || this.state.time }, this.initCodeAreas.bind(this))
	}


	setRequiredFields(fields, required) {
		Object.keys(fields).forEach((field) => {
			if (required) {
				this.requiredFields[field] = fields[field]
			} else {
				delete this.requiredFields[field]
			}
		})
	}


	toggleAdvanced() {
		LeoKit.center(this.modal)
		this.initCodeAreas()
	}


	editField(fieldName) {
		this.setState({ [fieldName == 'source' ? 'editingSource' : 'editingDestination']: true })
	}


	archiveBot() {
		var node = this.dataStore.nodes[this.state.id] || {}
		var archive = !this.state.archived
		var data = { id: this.state.id, archived: archive, paused: true }
		$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
			window.fetchData()
			window.messageLogNotify('Bot ' + (!archive ? 'Unarchived' : 'Archived'), 'info')
			this.setState({ archived: archive })
		}).fail((result) => {
			window.messageLogModal('Failed attempting to ' + (!archive ? 'Unarchive' : 'Archive') + ' bot ' + (node.label || ''), 'error', result)
		})
	}


	render() {
		if (this.props.nodeData && !this.state.id) {
			return false
		}

		var sourceId = this.state.sourceId
			, destinationId = this.state.destinationId
			, sourceName = (this.dataStore.nodes[sourceId] || {}).id
			, destinationName = (this.dataStore.nodes[destinationId] || {}).id

		var templateId = this.state.templateId || Object.keys(this.state.templates || {})[0] // || (((this.baseFlows || {})[this.state.flow] || {}).systems || [])[0]
		var template = (this.templates || {})[templateId] || {}

		if (this.state.defaults.source || this.state.defaults.destination) {
			sourceName = this.state.defaults.source
			destinationName = this.state.defaults.destination
			for (var id in this.dataStore.nodes) {
				if (this.dataStore.nodes[id].type !== 'bot') {
					if (this.dataStore.nodes[id].id === this.state.defaults.source) {
						sourceId = id
						sourceName = this.dataStore.nodes[id].idCache
					} else if (this.dataStore.nodes[id].id == this.state.defaults.destination) {
						destinationId = id
						destinationName = this.dataStore.nodes[id].id
					}
				}
			}
		}

		var node = this.dataStore.nodes[(this.props.nodeData || {}).id] || {}

		var form = {}

		var rightSide = {}

		/* BOT INFO */
		rightSide.bot_info = { section: {} }

		rightSide.bot_info.section.name = {
			label: 'Bot Name',
			value: this.state.defaults.name,
			required: false,
			onChange: this.setDirty.bind(this)
		}

		rightSide.bot_info.section.tags = {
			type: 'tags',
			value: this.state.defaults.tags,
			onChange: this.setDirty.bind(this)
		}

		rightSide.bot_info.section.description = {
			type: 'textarea',
			value: this.state.defaults.description,
			onChange: this.setDirty.bind(this)
		}

		if (this.props.action != 'create') {

			rightSide.bot_info.section.id = {
				type: 'hidden',
				value: this.props.nodeData.id
			}

		}


		/* FLOW */
		rightSide.flow = { section: {} }

		if (this.props.action == 'create' && template.matches && template.matches.source != null) {

			if (this.props.data.server_id) {

				rightSide.flow.section.sourceLabel = {
					type: 'text',
					label: 'source',
					required: (template && template.matches && template.matches.source != '.*'),
					value: this.props.data.id,
					readOnly: true,
				}

				rightSide.flow.section.source = {
					type: 'hidden',
					value: this.props.data.server_id,
				}

			} else {

				rightSide.flow.section.source = {
					required: (template && template.matches && template.matches.source != '.*'),
					type: 'autocomplete',
					value: this.state.defaults.source,
					nodeType: this.state.sourceNodeTypes,
					onChange: this.setSource.bind(this)
				}

			}

		} else if (this.state.defaults.source && !this.state.editingSource) {

			rightSide.flow.section.source = {
				label: 'source',
				required: (template && template.matches && template.matches.source !== '.*'),
				type: 'readonly',
				value: this.state.defaults.source,
				text: sourceName,
				edit: this.editField.bind(this, 'source')
			}

		} else if (this.state.editingSource || (template && template.matches && template.matches.source && template.matches.source !== '.*')) {

			rightSide.flow.section.source = {
				required: (template && template.matches && template.matches.source !== '.*'),
				type: 'autocomplete',
				value: this.state.defaults.source,
				nodeType: this.state.sourceNodeTypes,
				matches: ((template || {}).matches || {}).source,
				onChange: this.setSource.bind(this),
				description: 'explanation of what it means to change sources and destinations'
			}

		}


		if (this.props.action == 'create' && template.matches && template.matches.destination != null) {

			rightSide.flow.section.destination = {
				required: (template && template.matches && template.matches.destination != '.*'),
				type: 'autocomplete',
				value: this.state.defaults.destination,
				nodeType: this.state.destinationNodeTypes, //this.props.data.destinationTypes || ((window.nodes[this.props.data.id] || {}).type == 'system' ? 'queues|new' : 'systems|queues|new'),
				onChange: this.setDestination.bind(this)
			}

		} else if (this.state.defaults.destination && !this.state.editingDestination) {

			rightSide.flow.section.destination = {
				label: 'destination',
				required: (template && template.matches && template.matches.destination !== '.*'),
				type: 'readonly',
				value: this.state.defaults.destination,
				text: destinationName,
				edit: this.editField.bind(this, 'destination')
			}

		} else if (this.state.editingDestination || (template && template.matches && template.matches.destination && template.matches.destination !== '.*')) {

			rightSide.flow.section.destination = {
				required: (template && template.matches && template.matches.destination !== '.*'),
				type: 'autocomplete',
				value: this.state.defaults.destination,
				nodeType: this.state.destinationNodeTypes,
				matches: ((template || {}).matches || {}).destination,
				onChange: this.setDestination.bind(this),
				description: 'explanation of what it means to change sources and destinations'
			}
		}

		if (this.state.templates && Object.keys(this.state.templates).length > 0) {
			var values = {}
			for (var tId in this.state.templates) {
				values[tId] = (this.templates && this.templates[tId] || {}).name || tId
			}

			if (this.props.action != 'create') {
				rightSide.flow.section.template = {
					required: true,
					type: 'readonly',
					text: template.name,
					name: 'templateId',
					label: 'template',
					value: templateId
				}
			} else {
				rightSide.flow.section.templateId = {
					label: 'template',
					required: true,
					type: 'select',
					value: templateId,
					values: values,
					onChange: this.setTemplate.bind(this)
				}
			}

		} else {
			rightSide.flow.section.template = {
				required: true,
				type: 'readonly',
				color: 'danger',
				text: 'No templates found',
				name: 'templateId',
				label: 'template',
				value: ''
			}
		}

		if (this.props.action == 'create' && this.props.data.system && typeof this.props.data.system == 'object' && !this.props.data.system.id) {

			rightSide.flow.section.system = {
				required: false,
				type: 'autocomplete',
				name: 'systemName',
				value: this.state.defaults.systemName,
				nodeType: 'systems',
				onChange: this.setSystem.bind(this)
			}

		}


		/* EXECUTION */
		form.execution = { section: {} }

		var invocationTypes = {
			Lambda: { value: 'Lambda', placeholder: "Lambda Name or ARN" }
		}
		var invocationType = {
			values: ['Lambda']
		}

		if ((template.matches || {}).invocation && template.matches.invocation.constructor === Array && typeof template.matches.invocation[0] === 'object') {
			invocationTypes = {}
			invocationType.values = template.matches.invocation.map((type) => {
				invocationTypes[type.id] = {
					value: type.id,
					placeholder: type.placeholder
				}
				return type.id
			})
		}

		invocationType.value = this.state.defaults.invocationType || invocationType.value || (invocationType.values || [])[0]
		invocationType.lambdaName = this.state.defaults.lambdaName
		invocationType.placeholder = (invocationTypes[invocationType.value || 'Lambda'] || {}).placeholder

		if ((invocationType.values || []).length == 1) {
			invocationType.type = 'hidden'
			form.execution.section.lambdaName = {
				type: 'hidden',
				value: invocationType.lambdaName
			}
		} else {
			invocationType.type = 'invocation'
			invocationType.label = 'Invocation Type'
			invocationType.onChange = this.invocationTypeChange.bind(this)
		}

		form.execution.section.invocationType = invocationType

		form.execution.section.trigger = {
			type: 'trigger',
			required: true,
			values: (template.matches || {}).trigger,
			value: this.state.defaults.triggers || this.state.defaults.time || this.state.defaults.triggers,
			onChange: this.setTrigger.bind(this)
		};

		/* BOT OVERRIDES */
		form.overrides = { section: {} };

		form.overrides.section.source_lag = {
			label: 'Source Lag (Minutes)',
			value: this.state.source_lag,
			required: false,
			type: 'textoverrides',
			type2: 'checkbox',
			style: this.state.check1 ? {} : { backgroundColor: '#d3d3d3' },
			style2: { margin: '12px 5px 0px 0px' },
			onChange: this.handle1,
			onClick: this.check1,
			disabled: this.state.check1
		};

		form.overrides.section.write_lag = {
			label: 'Write Lag (Minutes)',
			value: this.state.write_lag,
			required: false,
			type: 'textoverrides',
			type2: 'checkbox',
			style: this.state.check2 ? {} : { backgroundColor: '#d3d3d3' },
			style2: { margin: '12px 5px 0px 0px' },
			onChange: this.handle2,
			onClick: this.check2,
			disabled: this.state.check2
		};

		form.overrides.section.error_limit = {
			label: 'Errors Per Executions',
			value: this.state.error_limit,
			required: false,
			min: "1",
			type: 'errorpercent',
			type2: 'checkbox',
			valueType: 'number',
			style: this.state.check3 ? {} : { backgroundColor: '#d3d3d3' },
			style2: { margin: '12px 5px 0px 0px' },
			onChange: this.handle3,
			onClick: this.check3,
			disabled: this.state.check3
		};

		form.overrides.section.consecutive_errors = {
			label: 'Consecutive Errors Allowed',
			value: this.state.consecutive_errors,
			required: false,
			type: 'textoverrides',
			type2: 'checkbox',
			style: this.state.check4 ? {} : { backgroundColor: '#d3d3d3' },
			style2: { margin: '12px 5px 0px 0px' },
			onChange: this.handle4,
			onClick: this.check4,
			disabled: this.state.check4
		};


		/* BOT SETTINGS */
		form.bot_settings = { section: {} }

		if (template && template.settings) {
			Object.keys(template.settings).forEach((settingName) => {
				if (['mappings', 'mock', 'source', 'destination'].indexOf(settingName) == -1) {
					form.bot_settings.section[settingName] = template.settings[settingName]
				}
			})
		}
		let theid = refUtil.botRef(this.state.id).id;

		return (<div className="overflow-auto height-1-1">

			<div className="BotSettings height-1-1">

				{
					<div className="flex-row flex-wrap height-1-1 bottom-padding-40">

						<div>
							<DynamicForm className="theme-form" id={theid} resetOverrides={() => this.resetOverrides()} form={form} defaults={this.state.defaults} setRequiredFields={this.setRequiredFields.bind(this)} toggleAdvanced={this.toggleAdvanced.bind(this)} onChange={this.setDirty.bind(this)} />
							<div>
								{
									localStorage.getItem('enableBetaFeatures')
										?
										(<textarea style={{ width: '600px', height: '600px' }} defaultValue={JSON.stringify(this.dataStore.cronInfo, null, 2)} className="codeMirror" />)
										: false
								}
							</div>
						</div>

						<div style={{ width: '5vw' }}>&nbsp;</div>

						<div>
							<DynamicForm className="theme-form" id={theid} resetOverrides={() => this.resetOverrides()} form={rightSide} defaults={this.state.defaults} setRequiredFields={this.setRequiredFields.bind(this)} toggleAdvanced={this.toggleAdvanced.bind(this)} onChange={this.setDirty.bind(this)} />

							<div className="flow-icons">
								{
									sourceId
										? (<div className="display-inline-block text-middle text-center">
											<NodeIcon className="smaller" node={sourceId} />
											<i className="icon-right-fat"></i>
											<div>{sourceName}</div>
										</div>)
										: false
								}

								<NodeIcon className="text-middle" node={{
									type: 'bot',
									templateId: templateId,
									status: node.status,
									paused: node.paused,
									isOrphan: node.isOrphan,
									icon: node.icon
								}} />

								{
									destinationId
										? (<div className="display-inline-block text-middle text-center">
											<i className="icon-right-fat"></i>
											<NodeIcon className="smaller" node={destinationId} />
											<div>{destinationName}</div>
										</div>)
										: false
								}
							</div>

						</div>

						{
							this.props.action != 'create'
								? <div className="form-button-bar mobile-hide">
									<button type="button" className="theme-button" onClick={this.onReset.bind(this, false)} disabled={!this.state.dirty}>Discard Changes</button>
									<button type="button" className="theme-button-primary" onClick={this.onSave.bind(this, false)} disabled={!this.state.dirty || false}>Save Changes</button>
									<button type="button" className="theme-button pull-right" onClick={this.archiveBot.bind(this)}>
										{
											this.state.archived
												? <i className="icon-unarchive"> Unarchive</i>
												: <i className="icon-archive"> Archive</i>
										}
									</button>
								</div>
								: false
						}

					</div>
				}
			</div>

		</div>)

	}

}

export default BotSettings
