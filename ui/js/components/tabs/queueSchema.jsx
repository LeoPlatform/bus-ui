import React, { Component } from 'react';
import { inject, observer } from 'mobx-react'

import DynamicForm from '../elements/dynamicForm.jsx'
import NodeIcon from '../elements/nodeIcon.jsx'
let refUtil = require("leo-sdk/lib/reference.js");

@inject('dataStore')
@observer
class QueueSchema extends React.Component {

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
		foldGutter: true,
		gutters: ["CodeMirror-lint-markers", "CodeMirror-linenumbers", "CodeMirror-foldgutter"],
		lint: {
			options: {
				esversion: 6
			}
		},
		//autofocus: true
		foldOptions: {
			widget: (from, to) => {
				var count = undefined;

				// Get open / close token
				var startToken = '{', endToken = '}';
				var prevLine = window.editor_json.getLine(from.line);
				if (prevLine.lastIndexOf('[') > prevLine.lastIndexOf('{')) {
					startToken = '[', endToken = ']';
				}

				// Get json content
				var internal = window.editor_json.getRange(from, to);
				var toParse = startToken + internal + endToken;

				// Get key count
				try {
					var parsed = JSON.parse(toParse);
					count = Object.keys(parsed).length;
				} catch (e) { }

				return count ? `\u21A4${count}\u21A6` : '\u2194';
			}
		}
	}


	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		let settings = (props.nodeData || props.data || {});
		let settingsId = settings.type == 'queue' ? settings.id : undefined

		this.state = {
			id: settingsId,
			settingsId: settingsId,
			version: "",
			defaults: {},
		};
	}

	componentWillReceiveProps() {
	}


	componentDidMount() {
		this.getInitSettings(this.initCodeAreas.bind(this));
	}


	componentWillUnmount() {

		this.isUnmounting = true

		for (var instanceName in this.codeMirrorInstances) {
			this.codeMirrorInstances[instanceName].toTextArea()
			delete this.codeMirrorInstances[instanceName]
		}

	}


	getInitSettings(callback) {
		if (this.state.settingsId) {
			callback();
		} else {
			this.saveInitSettings({}, callback)
		}
	}


	saveInitSettings(response, callback) {
		if (!this.isUnmounting) {

			this.requiredFields = {}

			this.setState({
				id: (this.props.nodeData || {}).id,
				dirty: false,
			}, () => {
				callback()
			});
		}
	}



	codeMirrorInstances = []

	initCodeAreas() {
		$('.QueueSchema textarea.codeMirror').each((index, textArea) => {
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


	changeVersion(version) {
		this.setState({
			version: version
		})
	}


	render() {
		if (this.props.nodeData && !this.state.id || Object.keys(this.dataStore.queueInfo || {}).length === 0) {
			return (<div>
				No schema defined.  Register one via LeoRegister (Bus-Register)
			</div>)
		}

		let versions = Object.keys(this.dataStore.queueInfo);
		if (!this.state.version) {
			//this.setState({ version: versions[0] });
			this.state.version = versions[0];
		}

		//var node = this.dataStore.nodes[(this.props.nodeData || {}).id] || {}

		//let theid = refUtil.ref(this.state.id).id;
		return (<div className="overflow-auto height-1-1">
			<div className="QueueSchema height-1-1">
				<select name='version' title='Version' value={this.state.version} onChange={this.changeVersion.bind(this)}>
					{
						versions.map((value, key) => {
							return (<option key={key} value={value}>{value}</option>)
						})
					}
				</select>
				<div className=" height-1-1">
					<textarea style={{ height: '100%' }} defaultValue={JSON.stringify(this.dataStore.queueInfo[this.state.version] || {}, null, 2)} className="codeMirror" />
				</div>
			</div>

		</div>)

	}

}

export default QueueSchema
