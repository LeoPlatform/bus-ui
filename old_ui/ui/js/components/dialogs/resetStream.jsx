import React, {Component} from 'react';
import NodeSearch from '../elements/nodeSearch.jsx';
import refUtil from "leo-sdk/lib/reference.js";

export default class ResetStream extends React.Component {

	constructor(props) {
		super(props);

        let lambdaSource = {};
        if(props.source) {
            lambdaSource[props.source] = props.source;
        }

		this.state = {
			checkpoint: 'z' + moment.utc().format('/YYYY/MM/DD/HH/mm/ss/'),
			forceRun: props.forceRun,
			advanced: false,
			openCustom: false,
			checked: true,
            links: Object.assign({}, refUtil.refId(lambdaSource).id, props.links),
            selected: refUtil.refId(props.source !== false ? props.source : Object.keys(props.links)[0]).id
		}
	}


	componentDidMount() {

		LeoKit.modal($('.checkpointDialog'), {
				Save: (formData) => {
					let source = formData['checkpoint-shortcut'][0];
                    if(this.state.selected === 'selectOther') {
                        source = this.state.selected2
					}

					let data = {
						id: this.props.nodeId,
						checkpoint: {}
					};
                    data.checkpoint[source] = formData.checkpoint;

                    if (this.props.forceRun) {
						data.executeNow = true
					}
					$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
						window.messageLogNotify('Checkpoint changed on bot ' + (this.props.label || ''))
						window.fetchData()
					}).fail((result) => {
						window.messageLogModal('Failed changing checkpoint on bot ' + (this.props.label || ''), 'error', result)
					})
				},
				cancel: false,
			},
			'Change Checkpoint',
			this.props.onClose
		)

	}


	setCheckpoint(event) {

		if ($('#CheckpointDialogDateTimePicker').data('DateTimePicker')) {
			$('#CheckpointDialogDateTimePicker').data('DateTimePicker').hide()
		}

		var shortcut = event.currentTarget.value;

		switch(shortcut) {

			case 'lastRead':
				this.setState({ checkpoint: '', shortcut: shortcut, openCustom: false });
			break;

			case 'fromNow':
				this.setState({ checkpoint: 'z' + moment.utc().format('/YYYY/MM/DD/HH/mm/ss/'), shortcut: shortcut, openCustom: false });
			break;

			case 'beginning':
				this.setState({ checkpoint: 'z/', shortcut: shortcut, openCustom: false });
			break;

			case 'custom':
                this.setState({ openCustom: true, shortcut:shortcut });
                this.setCustom('now', false);
			break;

			case 'date':
				this.setCustom('now', true);
			break;
		}

	}


	setCustom(event, openDatePicker) {

		if (event === 'now') {
			var checkpoint = 'z' + moment.utc().format('/YYYY/MM/DD/HH/mm/ss/')
		} else {
			var checkpoint = event.currentTarget.value
		}

		if(openDatePicker) {
            this.setState({ checkpoint: checkpoint, shortcut: 'date', openCustom: false });

            if (!$('#CheckpointDialogDateTimePicker').data('DateTimePicker')) {
                $('#CheckpointDialogDateTimePicker').datetimepicker({
                    inline: true,
                    sideBySide: true,
                    maxDate: moment().endOf('d'),
                    defaultDate: moment()
                })
                $('#CheckpointDialogDateTimePicker').on('dp.change', (event) => {
                    if (this.state.checked) {
                        this.setState({ checkpoint: 'z' + event.date.utc().format('/YYYY/MM/DD/HH/mm/ss/'), shortcut: 'date' })
                    } else {
                        this.setState({ checkpoint: 'z' + event.date.format('/YYYY/MM/DD/HH/mm/ss/'), shortcut: 'date' })
                    }
                })
            } else {
                $('#CheckpointDialogDateTimePicker').data('DateTimePicker').show()
            }
		} else {
            this.setState({ checkpoint: checkpoint });
		}
	}

    openMoreOptions(event) {
        let selected = event.currentTarget.value;

        if(selected === 'selectOther') {
        	this.setState({
                advanced: true,
                selected: selected
			});
		} else {
            this.setState({
                advanced: false,
                selected: selected
            });
		}
    }

    useUTC() {
		let checked = !this.state.checked;
        let dp = $('#CheckpointDialogDateTimePicker').data().date;
        let checkpoint;
        if (checked) {
			checkpoint = 'z' + moment(dp).utc().format('/YYYY/MM/DD/HH/mm/ss/')
		} else {
            checkpoint = 'z' + moment(dp).format('/YYYY/MM/DD/HH/mm/ss/')
        }
		this.setState({checked: checked, checkpoint: checkpoint});
	}

    setEventStream(stream) {
        if (stream) {
            if (typeof stream === 'object') {
                stream = stream.label
            }
            this.setState({ selected2: stream })
        }
    }


	render() {
		let nodeSearch = (
			<div className="theme-form-row">
				<label>Other Source</label>
				<NodeSearch key="0" name="sources" value={''} className="display-inline-block" nodeType={'queues|systems'} onChange={this.setEventStream.bind(this)} />
			</div>
		);

		let customCheckpoint = this.state.openCustom ? {} : {display:'none'};

		return (<div>
			<div className="checkpointDialog">
				<div className="resetBody">
					<p>This operation will change the checkpoint of the bot.  Please be sure you know what you are doing.</p>
					<div className="theme-form-row">
						<label>Source</label>
						<select name="checkpoint-shortcut" value={this.state.selected || ''} onChange={this.openMoreOptions.bind(this)}>
                            {
                                Object.keys(this.state.links).map((key, index) => {
                                    return <option key={index} value={key}>{key}</option>
                                })
                            }
							<option value="selectOther">select other...</option>
						</select>
					</div>

					{
						this.state.advanced
							? nodeSearch
							: false
					}
					<div className="theme-form-row">
						<label></label>
						<div>
							<select name="checkpoint-shortcut" onChange={this.setCheckpoint.bind(this)} value={this.state.shortcut || ''}>
								<option value="fromNow">Start from Now</option>
								<option value="beginning">From the Beginning of Time</option>
								<option value="date">Choose Date</option>
								<option value="custom">Custom</option>
							</select>
                            {
                                this.state.shortcut === 'date' ?
									<div style={{paddingBottom: '10px'}}>
										<label style={{paddingRight: '10px'}}> Use UTC</label>
										<input type="checkbox" checked={this.state.checked} onChange={this.useUTC.bind(this)} />
									</div>
                                    : false
                            }

							<div className="input-group" id="CheckpointDialogDateTimePicker">
								<input type="hidden" name="customTimeFrame" />
							</div>
						</div>
					</div>

					<div className="theme-form-row" style={customCheckpoint}>
						<label style={customCheckpoint}>Resume Checkpoint</label>
						<input className="fixed-size" name="checkpoint" type="text" value={this.state.checkpoint || ''} onChange={this.setCustom.bind(this)} />
						<span>UTC</span>
					</div>


					{
						this.props.forceRun
						? <div className="forceWarning">Will be Force Run once Checkpoint is Saved</div>
						: false
					}
				</div>
			</div>
		</div>)

	}

}
