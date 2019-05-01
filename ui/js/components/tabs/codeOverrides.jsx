// const leoaws = require('leo-aws/factory')('dynamodb');
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { observer, inject } from 'mobx-react'
import styled from 'styled-components';
import JSONPretty from 'react-json-pretty';

// import PayloadSearch from '../elements/payloadSearch.jsx'

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

const StyledMainDiv = styled.div`
	height: 100%;
`;

const StyledFormattedDiv = styled.div`
	float: right;
	width: 32%;
	padding: 5px;
`;

const StyledTextareaDiv = styled.div`
	float: right;
	width: 32%;
	height: 100%;
	padding: 5px;
`;

const StyledTextarea = styled.textarea`
    width: 100%;
	height: 100%;
`;

@inject('dataStore')
@observer
class CodeOverrides extends React.Component {

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
		console.log('in constructor');
		super(props);

		var botSettings = props.nodeData ? this.props.nodeData.settings || {} : {}
			, lambdaSettings = (botSettings.lambda && botSettings.lambda.settings && botSettings.lambda.settings[0]) ? botSettings.lambda.settings[0] : {}

		this.state = {
			code: lambdaSettings.code || 'Insert code to override specific payloads',
			results: 'Results will show here',
			payload: 'Insert a payload to modify'
		};

		// dynamodb.get()
		//
		// this.getMappings = this.getMappings.bind(this)
		//
		//
		// this.savedEventsId = 'savedEvents-' + props.nodeData.id
		//
		// this.state = {
		// 	view: localStorage.getItem('mapper-view.' + props.nodeData.id || 'default') || 'left',
		// 	eventName: '',
		// 	events: false,
		// 	eventId: 0,
		// 	mapper: 'default',
		// 	preview: {},
		// 	botSettings: botSettings,
		// 	hasPreviewError: false,
		// 	dirty: false,
		//
		// 	source: lambdaSettings.source || false,
		// 	//timeFrame: '1w',
		// 	payload: props.nodeData.input ? JSON.stringify(props.nodeData.input, null, 4) : '',
		// 	editable: false,
		//
		// 	input: props.nodeData.input,
		// 	output: props.nodeData.output,
		// 	enabledMockCheckboxes: [],
		// 	mockOpen: false,
		// 	mockCheckboxes: [],
		//
		// 	savedEvents: JSON.parse(localStorage.getItem(this.savedEventsId) || '[]').filter(event => event)
		//
		// }
		//
		// this.onReset(false)
	}


	componentDidMount() {
		console.log('component did mount');

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

	//
	// componentWillUnmount() {
	// 	console.log('component will unmount');
	//
	// 	this.componentUnmounting = true
	// 	for (var instanceName in this.codeMirrorInstances) {
	// 		this.codeMirrorInstances[instanceName].toTextArea()
	// 		delete this.codeMirrorInstances[instanceName]
	// 	}
	//
	// 	$(window).unbind('beforeunload')
	// }

	// onReset(callback) {
	//
	// 	callback = (typeof callback == 'function' ? callback : false)
	//
	// 	$.get(window.api + '/cron/' + encodeURIComponent(this.props.nodeData.id), (response) => {
	// 		var lambda = response.lambda || {}
	// 			, settings = (lambda.settings || [])[0] || {}
	// 			, mappings = settings.mappings || ''
	// 			, mock = response.mock || ''
	// 			, codeEditor = !!((window.templates && window.templates[response.templateId] || {}).settings || {}).mappings
	// 		//delete settings.mock
	// 		this.setState({ lambda: lambda, mappings: mappings, mock: mock, dirty: false, codeEditor: codeEditor }, () => {
	// 			if (codeEditor) {
	// 				this.initCodeAreas()
	// 				this.codeMirrorInstances['mappings'] && this.codeMirrorInstances['mappings'].setValue(mappings)
	// 				this.codeMirrorInstances['mock'].setValue(mock)
	// 				this.getMockCheckboxes(this.runMapping.bind(this))
	// 				this.setState({ dirty: false }, () => {
	// 					this.props.setDirtyState(false)
	// 					callback && callback()
	// 				})
	// 			}
	// 		})
	// 	})
	//
	// }


	// onSave(callback) {
	//
	// 	callback = (typeof callback == 'function' ? callback : false)
	//
	// 	//var data = this.props.nodeData.settings;
	// 	var data = {
	// 		id: this.props.nodeData.id,
	// 		lambda: this.state.lambda
	// 	}
	// 	try {
	// 		data.lambda.settings[0].mappings = this.codeMirrorInstances['mappings'].doc.getValue()
	// 		if (data.lambda.settings[0].mappings.length == undefined) {
	// 			data.lambda.settings[0].mappings = [data.lambda.settings[0].mappings]
	// 		}
	// 		//data.lambda.settings[0].mock = (this.codeMirrorInstances['mock'].doc.getValue() || '{}')
	// 		data.mock = (this.codeMirrorInstances['mock'].doc.getValue() || '{}')
	// 	} catch (e) {
	// 		window.messageModal('Preview is in error. Please correct before saving', 'warning')
	// 		return false
	// 	}
	//
	// 	$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
	// 		window.nodeTree.updateDiagram && window.nodeTree.updateDiagram(null, true)
	// 		this.setState({ dirty: false }, () => {
	// 			this.props.setDirtyState(false)
	// 			callback && callback()
	// 		})
	// 	}).fail((result) => {
	// 		window.messageLogModal('Failure saving mapping on ' + this.dataStore.nodes[data.id].label, 'error', result)
	// 	})
	//
	// }

	// returnEvents(events, status) {
	// 	$('.source-panel').addClass('theme-spinner')
	// 	this.setState({ eventId: 0, events: events, eventName: (events[0] || {}).event || this.state.eventName, payload: JSON.stringify((events[0] || {}).payload, null, 4) }, () => {
	// 		this.runMapping()
	// 		setTimeout(() => {
	// 			$('.source-panel').removeClass('theme-spinner')
	// 		}, 200)
	// 	})
	// }

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

	// saveCurrentEvent() {
	// 	console.log('saveCurrentEvent');
	// 	this.setState({ showSavedEvents: false })
	// 	LeoKit.prompt('Save Current Event', 'Event Name', {
	// 		Save: (formData) => {
	// 			if (formData.prompt_value) {
	// 				var savedEvents = this.state.savedEvents
	// 				savedEvents.push({
	// 					name: formData.prompt_value,
	// 					payload: this.state.payload,
	// 					timestamp: Date.now()
	// 				})
	// 				localStorage.setItem(this.savedEventsId, JSON.stringify(savedEvents))
	// 				this.setState({ savedEvents: savedEvents })
	// 			}
	// 		},
	// 		cancel: false
	// 	})
	// }


	// useSavedEvent(index) {
	// 	console.log('in useSavedEvent');
	// 	var savedEvents = this.state.savedEvents
	// 	if (savedEvents[index]) {
	// 		this.setState({ payload: savedEvents[index].payload, showSavedEvents: false }, this.runMapping.bind(this))
	// 	}
	// }


	// deleteSavedEvent(index) {
	// 	console.log('in delete saved event');
	// 	var savedEvents = this.state.savedEvents
	// 	savedEvents.splice(index, 1).filter(event => event)
	// 	localStorage.setItem(this.savedEventsId, JSON.stringify(savedEvents))
	// 	this.setState({ savedEvents: savedEvents })
	// }

	handleCodeChanges = (event) => {
		this.setState({code: event.target.value});

		let processOverrides = (obj) => {
			obj = JSON.parse(obj);
			eval(event.target.value);

			// const formatter = new JSONFormatter(JSON.stringify(obj));
			// return formatter.render();
			return obj;
		};

		let results = processOverrides(this.state.payload);
		this.setState({results: results});
	}

	handlePayloadChanges = (event) => {
		this.setState({payload: event.target.value});
	}

	render() {
		console.log('in render');

		// if (!this.state.codeEditor) {
		// 	return (
		// 		typeof this.state.codeEditor === 'undefined'
		// 			? (<div className="theme-spinner-large" />)
		// 			: (<div>
		// 				Code editing unavailable
		// 		</div>)
		// 	)
		// }


		return (
			<StyledMainDiv>
				<StyledFormattedDiv>
					<JSONPretty id="payloadResults" data={this.state.results}></JSONPretty>
				</StyledFormattedDiv>

				<StyledTextareaDiv>
					<StyledTextarea value={this.state.code} onChange={this.handleCodeChanges} />
				</StyledTextareaDiv>

				<StyledTextareaDiv>
					<StyledTextarea value={this.state.payload} onChange={this.handlePayloadChanges} />
				</StyledTextareaDiv>
			</StyledMainDiv>
		);
		// var source = (this.state.source || (((this.state.lambda || {}).settings || [])[0] || {}).source || '')
		// 	, eventName = (this.dataStore.nodes[source] || {}).label || this.state.eventName
		//
		// return (<div className={"mapping-frame " + (this.state.mockOpen ? ' mock' : '')} onKeyDown={this.keyDown.bind(this)}>
		//
		// 	<div className={'source-panel flex-column' + (this.state.expandPanel === 'source-panel' ? ' expanded' : '')} onDragOver={this.dragOver.bind(this)}>
		//
		// 		<div className="panel-header">
		// 			<span className="panel-title cursor-pointer" onClick={this.toggleMock.bind(this)}>
		// 				<i className={!this.state.mockOpen ? 'icon-down-open' : 'icon-right-open'} />
		// 				Source Events
		// 			</span>
		// 			<span className="pull-right">
		// 				<img className="theme-white-out" src={window.leostaticcdn + 'images/nodes/queue.png'} style={{ maxWidth: 40, verticalAlign: 'top' }} />
		// 				{eventName}
		// 			</span>
		// 		</div>
		//
		// 		<div className={(this.state.mockOpen ? 'display-none' : 'flex-column flex-grow') + ' '} style={{ background: '#F2F2F2' }}>
		//
		// 			{
		// 				!this.state.input
		// 					? <PayloadSearch ref={(me) => { this.payloadSearch = me }} serverId={source} returnEvents={this.returnEvents.bind(this)} timeFrames={['15m', '1hr', '1d', '1w']} />
		// 					: false
		// 			}
		//
		// 			<div style={{ padding: '0 8px 8px' }} className="position-relative">
		// 				<span className="event-timestamp">{(this.state.events[this.state.eventId] || {}).timestamp ? moment(this.state.events[this.state.eventId].timestamp).format('YYYY-MM-DD HH:mm:ss') : ''}</span>
		// 				{
		// 					!this.state.input
		// 						? <div className="display-inline-block">
		// 							<a onClick={this.prevEvent.bind(this)} disabled={this.state.eventId === 0}> <i className="icon-left-open" /> </a>
		// 							<a onClick={this.nextEvent.bind(this)} disabled={(this.state.events || []).length === 0 || this.state.eventId === (this.state.events.length - 1)} > <i className="icon-right-open" /> </a>
		// 						</div>
		// 						: false
		// 				}
		//
		// 				<i className="icon-doc-text pull-right" style={{ fontSize: '1.25em' }} onClick={this.toggleSaveEventDropdown.bind(this)} />
		//
		// 				{
		// 					this.state.showSavedEvents
		// 						? (<div className="mock-checkboxes theme-popup-below-left">
		// 							<div className="mask" onClick={this.toggleSaveEventDropdown.bind(this)}></div>
		// 							<div>
		// 								<div className="panel-title">Saved Events</div>
		// 								{
		// 									this.state.savedEvents
		// 										? this.state.savedEvents.map((event, index) => {
		// 											return (!event
		// 												? false
		// 												: (<label key={event.name} onClick={this.useSavedEvent.bind(this, index)} className="cursor-pointer">
		// 													<span>{event.name}</span>
		// 													<i className="icon-minus-circled pull-right" title="delete saved event" onClick={this.deleteSavedEvent.bind(this, index)} />
		// 												</label>)
		// 											)
		// 										})
		// 										: false
		// 								}
		// 								<button type="button" className="theme-button-small" onClick={this.saveCurrentEvent.bind(this)}>Save Current Event</button>
		// 							</div>
		// 						</div>)
		// 						: false
		// 				}
		//
		// 			</div>
		//
		// 			{
		// 				this.state.editable
		// 					? <textarea value={this.state.payload || ''} onChange={this.setPayload.bind(this)} className="flex-grow" onClick={this.expandPanel.bind(this, 'source-panel')} />
		// 					: <textarea value={this.state.payload || ''} onMouseDown={this.toggleEditable.bind(this, true)} className="flex-grow" onChange={() => { }} />
		// 			}
		//
		// 			{
		// 				this.state.botSettings.lambdaName == 'Leo_core_text_mapper'
		// 					? <div>
		// 						<i className="icon-upload" onClick={(event) => { $(event.currentTarget).next('.uploadFile').trigger('click') }}></i>
		// 						<input type="file" className="uploadFile" accept="text/csv" onChange={this.verifyUpload.bind(this)} />
		// 					</div>
		// 					: false
		// 			}
		// 		</div>
		//
		// 		<div className="panel-header">
		// 			<span className="panel-title cursor-pointer" onClick={this.toggleMock.bind(this)}>
		// 				<i className={this.state.mockOpen ? 'icon-down-open' : 'icon-right-open'} />
		// 				Mock Functions
		// 			</span>
		//
		// 			{
		// 				this.state.mockPopup
		// 					? (<div className={'mock-checkboxes ' + (this.state.mockOpen ? 'open theme-popup-below-left' : 'closed theme-popup-above-left')}>
		// 						<div className="mask" onClick={this.toggleMockPopup.bind(this)}></div>
		// 						<div>
		// 							<div className="panel-title">Mock Functions</div>
		// 							{
		// 								this.state.mockCheckboxes
		// 									? this.state.mockCheckboxes.map((checkbox) => {
		// 										return (<label key={checkbox}>
		// 											<input type="checkbox" checked={this.state.enabledMockCheckboxes.indexOf(checkbox) !== -1} onChange={this.mockCheckbox.bind(this, checkbox)} />
		// 											<span>{checkbox}</span>
		// 											<i className="icon-minus-circled pull-right" />
		// 										</label>)
		// 									})
		// 									: false
		// 							}
		// 							<button type="button" className="theme-button-small" onClick={this.createMockFunction.bind(this)}>Create New Mock Function</button>
		// 						</div>
		// 					</div>)
		// 					: false
		// 			}
		//
		// 			<span className="pull-right">
		// 				<i className="icon-minus-squared" />
		// 				<i className="icon-list-bullet" onClick={this.toggleMockPopup.bind(this)} />
		// 			</span>
		//
		// 		</div>
		//
		// 		<div className={this.state.mockOpen ? 'mock-wrapper flex-grow' : 'display-none'} onClick={this.expandPanel.bind(this, 'source-panel')}>
		// 			<textarea name="mock" className="codeMirror" defaultValue={this.state.mock}></textarea>
		// 		</div>
		//
		// 	</div>
		//
		// 	<hr draggable="true" onDragStart={this.dragStart.bind(this, 0)} onDragOver={this.dragOver.bind(this)} onDragEnd={this.dragEnd} />
		//
		// 	<div className={'code-panel position-relative'} onDragOver={this.dragOver.bind(this)} onClick={this.expandPanel.bind(this, 'code-panel')}>
		// 		<div className="panel-header">
		// 			<span className="panel-title">Code Editor</span>
		// 		</div>
		// 		<textarea name="mappings" className="codeMirror" defaultValue={this.state.mappings} />
		// 		<div className="form-button-bar">
		// 			<button type="button" className="theme-button" onClick={this.onReset.bind(this, false)} disabled={!this.state.dirty}>Discard Changes</button>
		// 			<button type="button" className="theme-button-primary" onClick={this.onSave.bind(this, false)} disabled={!this.state.dirty}>Save Changes</button>
		// 		</div>
		// 	</div>
		//
		// 	<hr draggable="true" onDragStart={this.dragStart.bind(this, 1)} onDragOver={this.dragOver.bind(this)} onDragEnd={this.dragEnd} />
		//
		// 	<div className={'preview-panel theme-tabs previewTabs' + (this.state.expandPanel === 'preview-panel' ? ' expanded' : '')} onDragOver={this.dragOver.bind(this)} onClick={this.expandPanel.bind(this, 'preview-panel')}>
		// 		<div className="panel-header">
		// 			<span className="panel-title">Output Preview</span>
		// 		</div>
		// 		<div>
		// 			{
		// 				this.state.output
		// 					? (<div className="active">
		// 						<pre readOnly="true">{JSON.stringify(this.state.output, null, 4)}</pre>
		// 					</div>)
		// 					: false
		// 			}
		// 			<div className={(!this.state.output ? 'active' : '')}>
		// 				{
		// 					this.state.preview == ''
		// 						? <div className="theme-spinner"></div>
		// 						: <pre className="validationOutput user-selectable">{this.showValidation()}</pre>
		// 				}
		// 			</div>
		// 		</div>
		// 	</div>
		//
		// </div>)

	}

}

export default CodeOverrides
