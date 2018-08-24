import React, {Component} from 'react';
import {inject, observer} from 'mobx-react'

@inject('dataStore')
@observer
export default class MuteButton extends React.Component {

	constructor(props) {
		super(props);
		this.state = {}
		this.dataStore = this.props.dataStore;
	}


	toggleMuteAlarm(showMuteAlarmId, event) {
		event.stopPropagation()
		this.setState({ showMuteAlarmId: showMuteAlarmId })
	}


	setMute(id, event) {
		let timePeriod = {'15m':{minutes:15}, '30m':{minutes:30}, '1hr':{hours:1}, '2hr':{hours:2}, '6hr':{hours:6}, '1d':{days:1}, '1w':{days:7}};

		let mute = $(event.currentTarget).text();
		switch(mute) {
			case '&#x221e;': case '∞':
				mute = true;
			break;

			case 'unmute':
				mute = false;
			break;
		}

        if (mute !== true && mute !== false) {
			let timeMuted =  timePeriod[mute];
            mute = Math.floor(moment().add(timeMuted).valueOf());
        }

		let data = {
			"id": id,
			"health": {mute: mute}
		};


		let existed = true;
        let temp = (this.dataStore.nodes && this.dataStore.nodes[id] && this.dataStore.nodes[id].health && this.dataStore.nodes[id].health.mute) ? this.dataStore.nodes[id].health.mute : false;
        if (this.dataStore.nodes && this.dataStore.nodes[id] && this.dataStore.nodes[id].health && (this.dataStore.nodes[id].health.mute || this.dataStore.nodes[id].health.mute === false)) {
            if (mute === true && this.dataStore.nodes[id].health.mute === false) {
                this.dataStore.nodes[id].health.mute = !this.dataStore.nodes[id].health.mute
            } else if (mute === false && this.dataStore.nodes[id].health.mute === true) {
                this.dataStore.nodes[id].health.mute = !this.dataStore.nodes[id].health.mute
            } else {
                this.dataStore.nodes[id].health.mute = mute;
            }
        }
		// For the first time ever muted
        if(this.dataStore.nodes[id].health.mute === undefined) {
            this.dataStore.nodes[id].health.mute = mute;
            existed = false;
		}

        $.post('api/cron/saveOverrides', JSON.stringify(data), (response) => {
            window.messageLogNotify(id + (!mute ? ' un-muted' : (' muted' + (mute !== true ? ' until ' + moment(mute).calendar() : ' indefinitely'))), 'info');
            this.setState({ paused: mute });
			if(!existed) {
            	this.dataStore.getStats();
			}
        }).fail((result) => {
            this.dataStore.nodes[id].health.mute = temp;
			window.messageLogNotify('Failed to ' + (!mute ? 'un-mute ' : 'mute ') + (id || ''), 'error', result)
        })
	}


	render() {

		let id = this.props.id;

		return (<a className="position-relative">
			<i className={(!this.props.mute ? 'icon-volume-low' : 'icon-volume-off') + ' font-15em ' + (!this.props.mute ? 'unMuted' : 'muted')} onClick={this.toggleMuteAlarm.bind(this, id)} />

			{
				this.state.showMuteAlarmId === id
				? (<div className="mute-alarm theme-popup-below-left">
					<div className="mask" onClick={this.toggleMuteAlarm.bind(this, false)}></div>

					{
                        this.props.mute
						? <header>
							<i className="icon-volume-off theme-color-success" />
							{
                                this.props.mute === true
								? <span>Muted Indefinitely</span>
								: <span>Muted until {moment(this.props.mute).calendar()}</span>
							}
						</header>
						: false
					}

					{
                        this.props.mute
						? <header>
							Edit mute:
							<button type="button" className="theme-button-micro pull-right" onClick={this.setMute.bind(this, id)}>unmute</button>
						</header>
						: <header>Mute alarm for:</header>
					}

					<div className="times">
						{
							['15m', '30m', '1hr', '2hr', '6hr', '1d', '1w', '&#x221e;']	.map((duration) => {
								return (<span key={duration} className="theme-hover-glow" dangerouslySetInnerHTML={{__html: duration }} onClick={this.setMute.bind(this, id)}></span>)
							})
						}
					</div>
				</div>)
				: false
			}

		</a>)

	}

}
