import React, {Component} from 'react';
import { connect } from 'react-redux';
import {observer, inject} from 'mobx-react';
import { setDisplayState } from '../../actions'
import Dialog from '../dialogs/dialog.jsx'
import ManageAccess from '../dialogs/manageAccess.jsx'
import MessageList from '../dialogs/messageList.jsx'
import Topics from '../dialogs/topics.jsx'

@inject('dataStore')
@observer
class Header extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;
		this.state = {
			messageCount: props.messageCount,
			displayPaused: false
		};
		this.localTz = moment.tz.guess();
		let tz = localStorage.getItem("defaultBotmonTimezone");
		this.timeZone = tz ? tz : "Default";
		this.timeZoneList = [
			"Default",
			"US/Pacific",
			"US/Central",
			"US/Eastern",
			"US/Mountain",
			"Europe/Madrid",
			"Europe/London",
			"Europe/Dublin",
			"UTC"
		].filter((item => item !== this.localTz));

		// console.log(this.timeZone);
	}


	componentWillReceiveProps(props) {

		if (typeof props.messageCount !== 'undefined') {
			this.setState({ messageCount: props.messageCount })
		}

		this.setState({ displayPaused: !!props.displayPaused })

	}


	togglePause() {
		this.props.dispatch(setDisplayState(!this.props.displayPaused))
	}


	closeDialog() {
		this.setState({ dialog: undefined })
	}


	manageAccess() {
		this.setState({ dialog: 'manageAccess' })
	}


	messageDeleted(messageCount) {
		this.setState({ messageCount: messageCount })
	}

	setTimeZone(tz) {
		// console.log(`tz = ${JSON.stringify(tz)}`);
		this.timeZone = tz;
		if (this.timeZone == "Default") {
			localStorage.removeItem("defaultBotmonTimezone");
			moment.tz.setDefault();
		} else {
			localStorage.setItem("defaultBotmonTimezone", tz);
			moment.tz.setDefault(tz);
		}
	}


	render() {
		return (<header className="page-header">

			<div className="page-logo-wrapper">
				<div className="page-logo theme-dropdown-left">
					<a href="#"><img src="//cdnleo.s3.amazonaws.com/logos/leo_icon.png" /></a>
				</div>

				<div className="page-title">
					{/*
					Innovation Center
					<small className="margin-2"><span>{(window.botmon ? window.botmon.version : '-')}</span></small>
					&nbsp; | &nbsp;
					*/}
					{
						(() => {
                            switch(this.props.userSettings.view || 'dashboard') {
                                case 'dashboard':
									return 'Dashboard'
								break

								default:
								case 'list':
									return 'Catalog'
								break

								case 'node':
									return 'Workflow'
								break

								case 'trace':
									return 'Trace'
								break

								case 'sdk':
									return 'SDK'
								break
							}
						})()
					}
				</div>
			</div>

			

			<div className='header-options'>
				<nav className="page-sub-nav">
					<ul>
						<li className="theme-dropdown-right">
							<a>
								<i className="icon-ellipsis"></i>
							</a>
							<ul>
								<li>
									<a>
										<div>
											<i className="icon-clock" />
											<span>
												<select name="selectedTimeZone" defaultValue={this.timeZone} onChange={c => this.setTimeZone(c.target.value)}>
													{this.timeZoneList.map(item => <option key={item} value={item}>{item == "Default" ? this.localTz : item}</option>)}
												</select>
											</span>
										</div>
									</a>
								</li>
								<li>
									<a onClick={this.togglePause.bind(this)}>
										{
											this.state.displayPaused
											? <div><i className="icon-play" /><span className="theme-color-danger text-bold">Resume Display</span></div>
											: <div><i className="icon-pause" /><span>Pause Display</span></div>
										}
									</a>
								</li>
								{
									localStorage.getItem('enableBetaFeatures')
									? (<li>
										<a onClick={this.manageAccess.bind(this)}>
											<i className="icon-key" /><span>Manage Access</span>
										</a>
									</li>)
									: false
								}
								<li>
									<a className={(this.state.messageCount !== 0 ? '' : 'theme-color-gray')} onClick={() => { this.setState({ dialog: 'Messages' }) }}>
										<i className="icon-comment" /><span>Messages</span>
									</a>
								</li>
								<li>
									<a onClick={() => { this.setState({ dialog: 'Topics' }) }}>
										<i className="icon-volume-low font-13em" /><span>Alerts</span>
									</a>
								</li>

								<li>
									<small className="text-center display-block stroke-above margin-8" style={{ paddingTop: 8 }}>
										Version <span>{(window.botmon ? window.botmon.version : '-')}</span>
									</small>
								</li>
							</ul>
						</li>
					</ul>
				</nav>

			</div>

			{
				(() => {

					switch(this.state.dialog) {
						case 'Messages':
							return <MessageList onClose={this.closeDialog.bind(this)} messageDeleted={this.messageDeleted.bind(this)} />
						break

						case 'manageAccess':
							return <ManageAccess onClose={this.closeDialog.bind(this)} />
						break

						case 'Topics':
							return <Topics onClose={this.closeDialog.bind(this)} />
						break
					}

				})()
			}

		</header>)
	}

}

export default connect(store => store)(Header)
