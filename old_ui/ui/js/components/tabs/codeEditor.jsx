import React, { Component } from 'react';
import { observer, inject } from 'mobx-react'

import PayloadSearch from '../elements/payloadSearch.jsx'

var mappers = {
    default: {
    	compile: function() {
    		return {exports: {}};
		},
		run: function() {
    		return [];
		}
	}
}

@inject('dataStore')
@observer
class CodeEditor extends React.Component {

	layout = ['33%', '33%', '33%']


	codeMirrorJSONOptions = {
		//mode:  { name: "javascript", json: true },
		mode: { name: "javascript" },
		lineWrapping: false,
		lineNumbers: true,
		indentWithTabs: true,
		indentUnit: 4,
		tabSize: 4,
		matchBrackets: true,
		autoCloseBrackets: true,
		//theme: 'eclipse',
		gutters: ["CodeMirror-lint-markers"],
		lint: {
			options: {
				esversion: 6
			}
		},
		keyMap: 'sublime'
		//autofocus: true
	}


	codeMirrorInstances = []


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.getMappings = this.getMappings.bind(this)

		var botSettings = props.nodeData ? this.props.nodeData.settings || {} : {}
			, lambdaSettings = (botSettings.lambda && botSettings.lambda.settings && botSettings.lambda.settings[0]) ? botSettings.lambda.settings[0] : {}

		this.savedEventsId = 'savedEvents-' + props.nodeData.id

		this.state = {
			view: localStorage.getItem('mapper-view.' + props.nodeData.id || 'default') || 'left',
			eventName: '',
			events: false,
			eventId: 0,
			mapper: 'default',
			preview: {},
			botSettings: botSettings,
			hasPreviewError: false,
			dirty: false,

			source: lambdaSettings.source || false,
			//timeFrame: '1w',
			payload: props.nodeData.input ? JSON.stringify(props.nodeData.input, null, 4) : '',
			editable: false,

			input: props.nodeData.input,
			output: props.nodeData.output,
			enabledMockCheckboxes: [],
			mockOpen: false,
			mockCheckboxes: [],

			savedEvents: JSON.parse(localStorage.getItem(this.savedEventsId) || '[]').filter(event => event)

		}

		this.onReset(false)
	}


	componentDidMount() {

		$('.mapping-frame > div').css({ width: '33%' })

		if (this.props.nodeData) {
			//this.initCodeAreas()
			//window.resize = this.positionElements
			//this.runMapping()
		}

		$(window).bind('beforeunload', () => {
			if (this.state.dirty) {
				return 'Changes have not been saved. Are you sure you want to reload?';
			}
		})

	}


	componentWillUnmount() {

		this.componentUnmounting = true
		for (var instanceName in this.codeMirrorInstances) {
			this.codeMirrorInstances[instanceName].toTextArea()
			delete this.codeMirrorInstances[instanceName]
		}

		$(window).unbind('beforeunload')
	}


	initCodeAreas() {
		$('.mapping-frame textarea.codeMirror').each((index, textArea) => {
			var textareaName = $(textArea).attr('name')
			if (!(textareaName in this.codeMirrorInstances)) {
				var codeMirrorInstance = CodeMirror.fromTextArea(textArea, this.codeMirrorJSONOptions)
				this.codeMirrorInstances[textareaName] = codeMirrorInstance
				codeMirrorInstance.on('change', () => {
					return ((codeMirrorInstance, textareaName) => {
						if (!this.state.dirty) {
							this.setState({ dirty: true }, () => {
								this.props.setDirtyState({
									onSave: this.onSave.bind(this),
									onReset: this.onReset.bind(this)
								})
							})
						}
						clearTimeout(this.typingTimeout)
						this.typingTimeout = setTimeout(() => {
							codeMirrorInstance.save()
							this.scrollTop = $('.validationOutput').scrollTop()
							if (textareaName === 'mappings') {
								this.runMapping()
							} else {
								this.getMockCheckboxes(null)
							}
						}, 300)
					})(codeMirrorInstance, textareaName)
				})
				codeMirrorInstance.on('focus', () => {
					$('.theme-dialog').removeAttr('tabIndex')
				})
				codeMirrorInstance.on('blur', () => {
					$('.theme-dialog').attr('tabIndex', -1)
				})
			}
		})

		$('.mapping-frame textarea:not(.codeMirror)').each((index, textArea) => {
			$(textArea).bind('keydown', function (e) {
				if (e.keyCode == 9) {
					e.preventDefault()
					var val = this.value
						, start = this.selectionStart
						, end = this.selectionEnd
					this.value = val.substring(0, start) + '\t' + val.substring(end)
					this.selectionStart = this.selectionEnd = start + 1
					return false
				}
			})
		})

	}


	getMappings() {
		var code = this.codeMirrorInstances['mappings'].doc.getValue()
		try {
			var mappings = code;//JSON.parse(code)
			if (typeof mappings == "string" || mappings.length == undefined) {
				mappings = [mappings]
			}
			return mappings
		} catch (e) {

		}
		return false
	}


	showValidation() {

		var previewData = this.state.preview

		if (typeof previewData == 'string' || !previewData.length) {
			return JSON.stringify(previewData, null, 4)
		}

		var tabWidth = 4
		var firstErrorShown = false

		var lines = previewData.map((result, k) => {
			var errors = result.error || {}
			Object.keys(errors).forEach((error) => {
				if (errors[error].length) {
					errors[error] = {
						key: errors[error][0] || undefined,
						value: errors[error][1] || undefined,
						style: {
							color: errors[error][2] || undefined
						}
					}
				}
			})

			var warns = result.warn || {}

			var infos = result.info || {}
			Object.keys(infos).forEach((info) => {
				if (infos[info].length) {
					infos[info] = {
						key: infos[info][0] || undefined,
						value: infos[info][1] || undefined,
						style: {
							color: infos[info][2] || undefined
						}
					}
				}
			})

			var crumb = []
			var results = JSON.stringify(result.obj, null, tabWidth)

			return (results || '').split(/[\r\n]+/).map((line, i) => {
				var depth = 0
				var hasKey = 'key'
				var parts = line.split(/(^\s*"|": "?|",\s*$)/ig).map((part, j) => {
					var className = ''
						, tooltip = ''
						, style = {}

					depth += ((part.match(/^\s+/) || [''])[0] || []).length

					if (part.match(/[a-z0-9]/i)) {
						if (hasKey == 'key') {
							crumb = crumb.slice(0, depth / tabWidth)
							crumb[depth / tabWidth] = part
						}
						var errorKey = crumb.join('.').replace(/^\.+/, '')
						if (errorKey in errors && errors[errorKey][hasKey]) {
							className = 'error' + (firstErrorShown ? ' hide' : '')
							tooltip = errors[errorKey][hasKey]
							style = errors[errorKey].style || {}
							firstErrorShown = true
						} else if (errorKey in warns && warns[errorKey][hasKey]) {
							className = 'warn'
							tooltip = warns[errorKey][hasKey]
							style = warns[errorKey].style || {}
						} else if (errorKey in infos && infos[errorKey][hasKey]) {
							className = 'info'
							tooltip = infos[errorKey][hasKey]
							style = infos[errorKey].style || {}
						}
						hasKey = 'value'
					}

					return (
						part.match(/[a-z0-9]/i)
							? (<span key={j} className={className || undefined} style={style} data-tooltip={tooltip || undefined}>{part}</span>)
							: part
					)

				})

				parts.unshift(Array(tabWidth).join(' '))
				return (<div key={i}>{parts}</div>)

			})

		})

		lines.unshift(<div key="opening">[</div>)
		lines.push(<div key="closing">]</div>)

		if (this.scrollTop) {
			setTimeout(() => { $('.validationOutput').scrollTop(this.scrollTop) }, 0)
		}

		return lines
	}


	validate(results) {
		var errorData = [];
		if (this.props.nodeData.mapperTemplate && this.props.nodeData.mapperTemplate.validator) {
			try {
				errorData = this.props.nodeData.mapperTemplate.validator(results)
			} catch (error) {
				console.log(error)
			}
		}
		return errorData.length !== 0 ? errorData : [{ obj: results }]
	}


	runMapping() {

		if (!this.state.codeEditor || !this.codeMirrorInstances['mappings']) {
			return
		}

		$('.preview-panel').addClass('theme-spinner')

		var code = this.codeMirrorInstances['mappings'].doc.getValue()

		try {
			var mappings = code
			if (typeof mappings == "string" || mappings.length == undefined) {
				mappings = [mappings]
			}

			if (!this.componentUnmounting) {
				this.setState({ preview: '', hasPreviewError: false })
			}

			// exports.init needs the full event
			var event = Object.assign({}, this.state.events[this.state.eventId] || {});
			event.payload = JSON.parse(this.state.payload || '{}')

			var data = [event]

			var mapper = mappers[this.state.mapper || "default"] || mappers.default;
			try {
				var results = [];
				var compiled = mapper.compile(mappings);
				var mockCompiled = mapper.compile(this.state.mock)

				this.state.enabledMockCheckboxes.forEach((func) => {
					compiled.exports[func] = mockCompiled.exports[func]
				})

				var result = mapper.run(data, compiled, "payload");

				if (compiled.async) {
					var that = this;
					result.then(data => {
						var results = [];
						data.forEach(e => { results = results.concat(e) });
						var hasPreviewError = !!results.errorMessage
						that.setState({ preview: this.validate(results), hasPreviewError: hasPreviewError })
					}).catch(err => {
						console.log("Got Error", err)
						that.setState({ preview: err, hasPreviewError: err })
					});
				} else {
					let data = result;
					var results = [];
					data.forEach(e => { results = results.concat(e) });
					var hasPreviewError = !!results.errorMessage
					this.setState({ preview: this.validate(results), hasPreviewError: hasPreviewError })
				}

			} catch (e) {
				console.log('error', e)
				this.setState({ preview: e.message || 'error', hasPreviewError: true })
			}

		} catch (e) {
			console.log('error', e)
			this.setState({ preview: e.toString(), hasPreviewError: true })
		}

		setTimeout(() => {
			$('.preview-panel').removeClass('theme-spinner')
		}, 0)

	}


	changeMapper(event) {
		this.setState({ mapper: $(event.target).data('mapper') }, () => {
			this.runMapping()
		})
	}


	dragStart(index, event) {
		this.dragIndex = index
		$('.CodeMirror').css({ pointerEvents: 'none' })
		event.dataTransfer.setData('text', '')
		event.dataTransfer.setDragImage(new Image(), 0, 0)
	}


	dragOver(event) {

		var dragLeft = event.clientX - $('.mapping-frame').offset().left
		var panels = $('.mapping-frame > div')

		if (this.dragIndex === 0) {

			var panelWidths = [Math.max(250, dragLeft)]
			panelWidths.push($(panels[0]).width() + $(panels[1]).width() - panelWidths[0] + $('.mapping-frame > hr').width())

			if (panelWidths[1] < 350) {
				panelWidths = [
					$(panels[0]).width() + $(panels[1]).width() - 250 + $('.mapping-frame > hr').width(),
					350
				]
			}

			$(panels[0]).width(panelWidths[0])
			$(panels[1]).width(panelWidths[1])

		} else {

			var panelWidths = [Math.max(350, (dragLeft - $(panels[0]).width()))]
			panelWidths.push($(panels[1]).width() + $(panels[2]).width() - panelWidths[0] + $('.mapping-frame > hr').width())

			if (panelWidths[1] < 250) {
				panelWidths = [
					$(panels[0]).width() + $(panels[1]).width() + $(panels[2]).width() - 350 + $('.mapping-frame > hr').width() * 2,
					250
				]
			}

			$(panels[1]).width(panelWidths[0])
			$(panels[2]).width(panelWidths[1])

		}

	}


	dragEnd(event) {
		$('.CodeMirror').css({ pointerEvents: 'initial' })
	}


	prevEvent() {
		if (this.state.eventId > 0) {
			$('.source-panel').addClass('theme-spinner')

			this.setState({
				editable: false,
				eventId: --this.state.eventId,
				payload: this.state.events && this.state.events.length > 0 ? JSON.stringify(this.state.events[this.state.eventId].payload, null, 4) : ''
			}, () => {
				this.runMapping()
				setTimeout(() => {
					$('.source-panel').removeClass('theme-spinner')
				}, 200)
			})
		}
	}


	nextEvent() {
		if (this.state.eventId !== this.state.events.length - 1) {
			$('.source-panel').addClass('theme-spinner')
			if (this.state.resumptionToken && (this.state.eventId + 3 >= this.state.events.length)) {
				this.payloadSearch.continueSearch()
			}
			this.setState({
				editable: false,
				eventId: ++this.state.eventId,
				payload: this.state.events && this.state.events.length > 0 ? JSON.stringify(this.state.events[this.state.eventId].payload, null, 4) : ''
			}, () => {
				this.runMapping()
				setTimeout(() => {
					$('.source-panel').removeClass('theme-spinner')
				}, 200)
			})
		}
	}


	onReset(callback) {

		callback = (typeof callback == 'function' ? callback : false)

		$.get(window.api + '/cron/' + encodeURIComponent(this.props.nodeData.id), (response) => {
			var lambda = response.lambda || {}
				, settings = (lambda.settings || [])[0] || {}
				, mappings = settings.mappings || ''
				, mock = response.mock || ''
				, codeEditor = !!((window.templates && window.templates[response.templateId] || {}).settings || {}).mappings
			//delete settings.mock
			this.setState({ lambda: lambda, mappings: mappings, mock: mock, dirty: false, codeEditor: codeEditor }, () => {
				if (codeEditor) {
					this.initCodeAreas()
					this.codeMirrorInstances['mappings'] && this.codeMirrorInstances['mappings'].setValue(mappings)
					this.codeMirrorInstances['mock'].setValue(mock)
					this.getMockCheckboxes(this.runMapping.bind(this))
					this.setState({ dirty: false }, () => {
						this.props.setDirtyState(false)
						callback && callback()
					})
				}
			})
		})

	}


	onSave(callback) {

		callback = (typeof callback == 'function' ? callback : false)

		//var data = this.props.nodeData.settings;
		var data = {
			id: this.props.nodeData.id,
			lambda: this.state.lambda
		}
		try {
			data.lambda.settings[0].mappings = this.codeMirrorInstances['mappings'].doc.getValue()
			if (data.lambda.settings[0].mappings.length == undefined) {
				data.lambda.settings[0].mappings = [data.lambda.settings[0].mappings]
			}
			//data.lambda.settings[0].mock = (this.codeMirrorInstances['mock'].doc.getValue() || '{}')
			data.mock = (this.codeMirrorInstances['mock'].doc.getValue() || '{}')
		} catch (e) {
			window.messageModal('Preview is in error. Please correct before saving', 'warning')
			return false
		}

		$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
			window.nodeTree.updateDiagram && window.nodeTree.updateDiagram(null, true)
			this.setState({ dirty: false }, () => {
				this.props.setDirtyState(false)
				callback && callback()
			})
		}).fail((result) => {
			window.messageLogModal('Failure saving mapping on ' + this.dataStore.nodes[data.id].label, 'error', result)
		})

	}


	toggleEditable(editable) {
		this.setState({ editable: editable })
	}


	setPayload(event) {
		var payload = event.currentTarget ? event.currentTarget.value : event
		this.setState({ payload: payload }, () => {
			if (this.typingTimeout) {
				clearTimeout(this.typingTimeout)
				this.typingTimeout = undefined
			}
			this.typingTimeout = setTimeout(() => {
				this.typingTimeout = undefined
				this.runMapping()
			}, 300)
		})
	}


	verifyUpload(event) {
		var file = event.currentTarget.files[0]
		if (!file) {
			window.messageModal('Nothing to upload', 'warning')
		} else if ((file.size / 1024 / 1024) > 5) {
			window.messageModal('The file size must not exceed 5MB', 'warning')
		} else {
			var reader = new FileReader()
			reader.onerror = function () {
				window.messageLogModal('Error reading file', 'error', reader)
			}
			reader.onload = () => {
				if (reader.result) {
					//var first50Lines = reader.result.split(/[\r\n]+/).slice(0, 51)
					//var header = first50Lines.shift()
					this.setState({
						upload: {
							//header: header,
							//rows: first50Lines,
							reader: reader,
							file: file
						}
					}, () => {
						this.uploadFile()
					})
				}
			}
			reader.readAsText(file)
		}
	}


	uploadFile() {
		if (!this.state.upload || !this.state.upload.reader) {
			window.messageModal('Select a file to upload', 'warning')
			return false
		}

		$('.source-panel').addClass('theme-spinner')

		$.ajax({
			url: 'api/files',
			type: 'PUT',
			contentType: 'application/json',
			data: JSON.stringify({
				Body: this.state.upload.reader.result,
				Key: this.state.upload.file.name,
				ContentType: this.state.upload.file.type,
				BotName: this.state.botSettings.name,
				EventName: this.state.botSettings.lambda.settings[0].source
			}),
			success: (result) => {
				window.messageLogNotify('File uploaded successfully ' + this.state.uploaded.file.name)
				//window.location.hash = '{"selected":["b_' + this.state.upload.bot + '"],"view":"node","node":"b_' + this.state.upload.bot + '"}'
				$('.source-panel').removeClass('theme-spinner')
			},
			error: (result) => {
				window.messageLogModal('Failure uploading file ' + this.state.uploading.file.name, 'error', result)
				$('.source-panel').removeClass('theme-spinner')
			}
		})

		this.setState({
			upload: undefined
		})
	}


	returnEvents(events, status) {
		$('.source-panel').addClass('theme-spinner')
		this.setState({ eventId: 0, events: events, eventName: (events[0] || {}).event || this.state.eventName, payload: JSON.stringify((events[0] || {}).payload, null, 4) }, () => {
			this.runMapping()
			setTimeout(() => {
				$('.source-panel').removeClass('theme-spinner')
			}, 200)
		})
	}


	toggleMock() {
		if (this.state.mockOpen) {
			$('.mock-wrapper').slideUp('slow', () => {
				this.setState({ mockOpen: false })
			})
		} else {
			this.setState({ mockOpen: true }, () => {
				$('.mock-wrapper').slideDown('slow')
				this.codeMirrorInstances['mock'].refresh()
			})
		}
	}


	getMockCheckboxes(callback) {
		var mockCheckboxes = []
		try {
			var mock = this.codeMirrorInstances['mock'].doc.getValue()
			var mapper = mappers[this.state.mapper || "default"] || mappers.default
			var compiled = mapper.compile(mock)
			var skip = ["asyncInit", "asyncEach", "asyncPost"];
			mockCheckboxes = Object.keys(compiled.exports).filter((checkbox) => {
				return skip.indexOf(checkbox) == -1;
			})
		} catch (e) {
			//console.error(e)
		}
		this.setState({ mock: mock, mockCheckboxes: mockCheckboxes, enabledMockCheckboxes: mockCheckboxes.slice(0) }, () => {
			callback && callback()
		})
	}


	mockCheckbox(checkbox, event) {
		var enabledMockCheckboxes = this.state.enabledMockCheckboxes || []
		if (event.currentTarget.checked) {
			enabledMockCheckboxes.push(checkbox)
		} else {
			enabledMockCheckboxes.splice(enabledMockCheckboxes.indexOf(checkbox), 1)
		}
		this.setState({ enabledMockCheckboxes: enabledMockCheckboxes }, this.runMapping.bind(this))
	}


	keyDown(event) {
		if (event.ctrlKey) {
			switch (event.keyCode) {
				case 83: //s
					event.preventDefault()
					this.onSave()
					break

				case 76: //l
				case 82: //r
					event.preventDefault()
					break

				default:
					console.log('event.keyCode', event.keyCode)
					break
			}
		}
	}


	toggleMockPopup(event) {
		this.setState({ mockPopup: !this.state.mockPopup })
	}


	createMockFunction() {
		var functionNumber = ''
		while (this.state.mockCheckboxes.indexOf('newFunctionName' + functionNumber) !== -1) {
			if (functionNumber === '') {
				functionNumber = 1
			}
			functionNumber++
		}

		var newFunction = `
exports.newFunctionName${functionNumber} = (params) => {
	//Code goes here
	return {
		"sample": "data"
	};
};`
		this.codeMirrorInstances['mock'].replaceRange(newFunction, CodeMirror.Pos(this.codeMirrorInstances['mock'].lastLine()))

		this.setState({ mockOpen: false, mockPopup: false }, this.toggleMock)
	}


	toggleSaveEventDropdown() {
		this.setState({ showSavedEvents: !this.state.showSavedEvents })
	}


	saveCurrentEvent() {
		this.setState({ showSavedEvents: false })
		LeoKit.prompt('Save Current Event', 'Event Name', {
			Save: (formData) => {
				if (formData.prompt_value) {
					var savedEvents = this.state.savedEvents
					savedEvents.push({
						name: formData.prompt_value,
						payload: this.state.payload,
						timestamp: Date.now()
					})
					localStorage.setItem(this.savedEventsId, JSON.stringify(savedEvents))
					this.setState({ savedEvents: savedEvents })
				}
			},
			cancel: false
		})
	}


	useSavedEvent(index) {
		var savedEvents = this.state.savedEvents
		if (savedEvents[index]) {
			this.setState({ payload: savedEvents[index].payload, showSavedEvents: false }, this.runMapping.bind(this))
		}
	}


	deleteSavedEvent(index) {
		var savedEvents = this.state.savedEvents
		savedEvents.splice(index, 1).filter(event => event)
		localStorage.setItem(this.savedEventsId, JSON.stringify(savedEvents))
		this.setState({ savedEvents: savedEvents })
	}


	expandPanel(panel) {
		//this.setState({ expandPanel: panel })
	}


	render() {

		if (!this.state.codeEditor) {
			return (
				typeof this.state.codeEditor === 'undefined'
					? (<div className="theme-spinner-large" />)
					: (<div>
						This code cannot be edited from the Innovation Center. Please contact your System Administrator.
				</div>)
			)
		}


		var source = (this.state.source || (((this.state.lambda || {}).settings || [])[0] || {}).source || '')
			, eventName = (this.dataStore.nodes[source] || {}).label || this.state.eventName

		return (<div className={"mapping-frame " + (this.state.mockOpen ? ' mock' : '')} onKeyDown={this.keyDown.bind(this)}>

			<div className={'source-panel flex-column' + (this.state.expandPanel === 'source-panel' ? ' expanded' : '')} onDragOver={this.dragOver.bind(this)}>

				<div className="panel-header">
					<span className="panel-title cursor-pointer" onClick={this.toggleMock.bind(this)}>
						<i className={!this.state.mockOpen ? 'icon-down-open' : 'icon-right-open'} />
						Source Events
					</span>
					<span className="pull-right">
						<img className="theme-white-out" src={window.leostaticcdn + 'images/nodes/queue.png'} style={{ maxWidth: 40, verticalAlign: 'top' }} />
						{eventName}
					</span>
				</div>

				<div className={(this.state.mockOpen ? 'display-none' : 'flex-column flex-grow') + ' '} style={{ background: '#F2F2F2' }}>

					{
						!this.state.input
							? <PayloadSearch ref={(me) => { this.payloadSearch = me }} serverId={source} returnEvents={this.returnEvents.bind(this)} timeFrames={['15m', '1hr', '1d', '1w']} />
							: false
					}

					<div style={{ padding: '0 8px 8px' }} className="position-relative">
						<span className="event-timestamp">{(this.state.events[this.state.eventId] || {}).timestamp ? moment(this.state.events[this.state.eventId].timestamp).format('YYYY-MM-DD HH:mm:ss') : ''}</span>
						{
							!this.state.input
								? <div className="display-inline-block">
									<a onClick={this.prevEvent.bind(this)} disabled={this.state.eventId === 0}> <i className="icon-left-open" /> </a>
									<a onClick={this.nextEvent.bind(this)} disabled={(this.state.events || []).length === 0 || this.state.eventId === (this.state.events.length - 1)} > <i className="icon-right-open" /> </a>
								</div>
								: false
						}

						<i className="icon-doc-text pull-right" style={{ fontSize: '1.25em' }} onClick={this.toggleSaveEventDropdown.bind(this)} />

						{
							this.state.showSavedEvents
								? (<div className="mock-checkboxes theme-popup-below-left">
									<div className="mask" onClick={this.toggleSaveEventDropdown.bind(this)}></div>
									<div>
										<div className="panel-title">Saved Events</div>
										{
											this.state.savedEvents
												? this.state.savedEvents.map((event, index) => {
													return (!event
														? false
														: (<label key={event.name} onClick={this.useSavedEvent.bind(this, index)} className="cursor-pointer">
															<span>{event.name}</span>
															<i className="icon-minus-circled pull-right" title="delete saved event" onClick={this.deleteSavedEvent.bind(this, index)} />
														</label>)
													)
												})
												: false
										}
										<button type="button" className="theme-button-small" onClick={this.saveCurrentEvent.bind(this)}>Save Current Event</button>
									</div>
								</div>)
								: false
						}

					</div>

					{
						this.state.editable
							? <textarea value={this.state.payload || ''} onChange={this.setPayload.bind(this)} className="flex-grow" onClick={this.expandPanel.bind(this, 'source-panel')} />
							: <textarea value={this.state.payload || ''} onMouseDown={this.toggleEditable.bind(this, true)} className="flex-grow" onChange={() => { }} />
					}

					{
						this.state.botSettings.lambdaName == 'Leo_core_text_mapper'
							? <div>
								<i className="icon-upload" onClick={(event) => { $(event.currentTarget).next('.uploadFile').trigger('click') }}></i>
								<input type="file" className="uploadFile" accept="text/csv" onChange={this.verifyUpload.bind(this)} />
							</div>
							: false
					}
				</div>

				<div className="panel-header">
					<span className="panel-title cursor-pointer" onClick={this.toggleMock.bind(this)}>
						<i className={this.state.mockOpen ? 'icon-down-open' : 'icon-right-open'} />
						Mock Functions
					</span>

					{
						this.state.mockPopup
							? (<div className={'mock-checkboxes ' + (this.state.mockOpen ? 'open theme-popup-below-left' : 'closed theme-popup-above-left')}>
								<div className="mask" onClick={this.toggleMockPopup.bind(this)}></div>
								<div>
									<div className="panel-title">Mock Functions</div>
									{
										this.state.mockCheckboxes
											? this.state.mockCheckboxes.map((checkbox) => {
												return (<label key={checkbox}>
													<input type="checkbox" checked={this.state.enabledMockCheckboxes.indexOf(checkbox) !== -1} onChange={this.mockCheckbox.bind(this, checkbox)} />
													<span>{checkbox}</span>
													<i className="icon-minus-circled pull-right" />
												</label>)
											})
											: false
									}
									<button type="button" className="theme-button-small" onClick={this.createMockFunction.bind(this)}>Create New Mock Function</button>
								</div>
							</div>)
							: false
					}

					<span className="pull-right">
						<i className="icon-minus-squared" />
						<i className="icon-list-bullet" onClick={this.toggleMockPopup.bind(this)} />
					</span>

				</div>

				<div className={this.state.mockOpen ? 'mock-wrapper flex-grow' : 'display-none'} onClick={this.expandPanel.bind(this, 'source-panel')}>
					<textarea name="mock" className="codeMirror" defaultValue={this.state.mock}></textarea>
				</div>

			</div>

			<hr draggable="true" onDragStart={this.dragStart.bind(this, 0)} onDragOver={this.dragOver.bind(this)} onDragEnd={this.dragEnd} />

			<div className={'code-panel position-relative'} onDragOver={this.dragOver.bind(this)} onClick={this.expandPanel.bind(this, 'code-panel')}>
				<div className="panel-header">
					<span className="panel-title">Code Editor</span>
				</div>
				<textarea name="mappings" className="codeMirror" defaultValue={this.state.mappings} />
				<div className="form-button-bar">
					<button type="button" className="theme-button" onClick={this.onReset.bind(this, false)} disabled={!this.state.dirty}>Discard Changes</button>
					<button type="button" className="theme-button-primary" onClick={this.onSave.bind(this, false)} disabled={!this.state.dirty}>Save Changes</button>
				</div>
			</div>

			<hr draggable="true" onDragStart={this.dragStart.bind(this, 1)} onDragOver={this.dragOver.bind(this)} onDragEnd={this.dragEnd} />

			<div className={'preview-panel theme-tabs previewTabs' + (this.state.expandPanel === 'preview-panel' ? ' expanded' : '')} onDragOver={this.dragOver.bind(this)} onClick={this.expandPanel.bind(this, 'preview-panel')}>
				<div className="panel-header">
					<span className="panel-title">Output Preview</span>
				</div>
				<div>
					{
						this.state.output
							? (<div className="active">
								<pre readOnly="true">{JSON.stringify(this.state.output, null, 4)}</pre>
							</div>)
							: false
					}
					<div className={(!this.state.output ? 'active' : '')}>
						{
							this.state.preview == ''
								? <div className="theme-spinner"></div>
								: <pre className="validationOutput user-selectable">{this.showValidation()}</pre>
						}
					</div>
				</div>
			</div>

		</div>)

	}

}

export default CodeEditor
