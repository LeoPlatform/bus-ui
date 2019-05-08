import React from 'react';
import { observer, inject } from 'mobx-react'
import styled from 'styled-components';
import JSONPretty from 'react-json-pretty';

const StyledMainDiv = styled.div`
	height: 75%;
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

	constructor(props) {
		super(props);

		this.dataStore = this.props.dataStore;

		this.settings = (props.nodeData || props.data || {});

		this.data = {
			id: this.settings.id,
			label: this.settings.label
		};

		this.state = {
			code: this.dataStore.cronInfo.code || `if (typeof obj === 'object') {
	// make a change to see results
	obj.modified = true;
}`,
			dirty: false,
			payload: `{
    "id": "example event",
    "event": "dw.load",
    "payload": {
        "type": "dimension",
        "entity": "d_example",
        "data": {
            "id": 1234567890,
            "example_id": 1234567890,
            "other_info": "none"
        }
    },
    "event_source_timestamp": 1556662750662,
    "eid": "z/2019/04/30/22/20/1556662805215-0000000",
    "correlation_id": {
        "source": "example.event",
        "start": "z/2019/04/30/22/20/1556662802206-0000001",
        "units": 1
    },
    "timestamp": 1556662805344
}`,
			results: 'Results will show here',
		};

		this.originalState = Object.assign({}, this.state);
	}

	handleCodeChanges = (event) => {
		this.setState({code: event.target.value});

		this.processOverrides(this.state.payload, event.target.value);
	};

	handlePayloadChanges = (event) => {
		this.setState({payload: event.target.value});

		this.processOverrides(event.target.value, this.state.code);
	};

	handleSave = () => {
		this.data.code = this.state.code;

		$.post(window.api + '/cron/save', JSON.stringify(this.data), (response) => {
			window.messageLogNotify(`Bot settings saved successfully for ${this.data.label}`);
			this.setState({dirty: false});
		}).fail((result) => {
			window.messageLogModal(`Error saving bot ${this.data.label}`, 'error', result);
			return false
		})
	};

	handleReset = () => {
		this.setState(this.originalState);
		this.state = Object.assign({}, this.originalState);
	};

	processOverrides = (obj, code) => {
		try {
			obj = JSON.parse(obj);
		} catch (e) {
			return this.setState({results: `Payload is invalid JSON. ${e.message}`});
		}

		try {
			eval(code);
		} catch (e) {
			return this.setState({results: `invalid javascript syntax. ${e.message}`});
		}

		this.setState({results: obj, dirty: true});
	};

	render() {
		if (!this.dataStore.cronInfo.lambda.settings[0].codeOverrides) {
			return (<div>Code editing unavailable.</div>);
		}

		return (
			<StyledMainDiv>
				<StyledFormattedDiv>
					<h3>Payload results</h3>
					<JSONPretty id="payloadResults" data={this.state.results}></JSONPretty>
				</StyledFormattedDiv>

				<StyledTextareaDiv>
					<h3>Insert javascript to modify payload. Use "obj" for the entire object coming in.</h3>
					<StyledTextarea value={this.state.code} onChange={this.handleCodeChanges} />
				</StyledTextareaDiv>

				<StyledTextareaDiv>
					<h3>Paste a payload below</h3>
					<StyledTextarea value={this.state.payload} onChange={this.handlePayloadChanges} />
				</StyledTextareaDiv>
				<div className="form-button-bar mobile-hide">
					<button type="button" className="theme-button" onClick={this.handleReset} disabled={!this.state.dirty}>Reset</button>
					<button type="button" className="theme-button-primary" onClick={this.handleSave} disabled={!this.state.dirty || false}>Save Changes</button>
				</div>
			</StyledMainDiv>
		);
	}
}

export default CodeOverrides