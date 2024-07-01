import React, { Component } from 'react'
import { connect } from 'react-redux'
import { observer, inject } from 'mobx-react'
import ResetStream from './resetStream.jsx'
import { NodeImages } from '../elements/nodeIcon.jsx'

// var config = require("leo-sdk/leoConfigure.js");
var config = window;

config.registry.tabs = Object.assign({
	CodeEditor: require("../tabs/codeEditor.jsx").default,
	Logs: require("../tabs/logs.jsx").default,
	BotSettings: require("../tabs/botSettings.jsx").default,
	BotDashboard: require("../tabs/botDashboard.jsx").default,
	QueueDashboard: require("../tabs/queueDashboard.jsx").default,
	EventViewer: require("../tabs/eventViewer.jsx").default,
	QueueSettings: require("../tabs/queueSettings.jsx").default,
	Checksum: require("../tabs/checksum.jsx").default,
	Cron: require("../tabs/cron.jsx").default,
	Webhooks: require("../tabs/webhooks.jsx").default,
	SystemSettings: require("../tabs/systemSettings.jsx").default,
	QueueSchema: require("../tabs/queueSchema.jsx").default,
}, config.registry.tabs);


var currentRequest

@inject('dataStore')
@observer
class Settings extends React.Component {


	nodeTabs = {

		MapperBot: {
			Dashboard: 'BotDashboard',
			Code: 'CodeEditor', //'Mapper',
			Logs: 'Logs',
			Settings: 'BotSettings'
		},

		AWSBot: {
			Dashboard: 'BotDashboard',
			Code: 'CodeEditor', //'Mapper',
			Logs: 'Logs',
			Settings: 'BotSettings'
		},

		ChecksumBot: {
			Dashboard: 'BotDashboard',
			Code: 'CodeEditor', //'Mapper',
			Checksum: 'Checksum',
			Logs: 'Logs',
			Settings: 'BotSettings'
		},

		EventQueue: {
			Dashboard: 'QueueDashboard',
			Events: 'EventViewer',
			Settings: 'QueueSettings',
			Schema: "QueueSchema"
		},

		System: {
			Dashboard: 'QueueDashboard',
			Events: 'EventViewer',
			Checksum: 'Checksum',
			Cron: 'Cron',
			Webhook: 'Webhooks',
			Settings: 'SystemSettings'
		}

	}


	dialogTagKey = Date.now()

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		var nodeData = props.data
			, nodeType = props.nodeType

		nodeData.label = nodeData.label || nodeData.name

		if (props.data.openTab === 'Code') {
			nodeType = 'MapperBot'
		}

		this.mytabs = this.nodeTabs[nodeType]

		if (this.dataStore.nodes[nodeData.id].checksum !== "" && this.dataStore.nodes[nodeData.id].type !== 'queue' && this.dataStore.nodes[nodeData.id].checksum !== undefined && this.dataStore.nodes[nodeData.id].checksum !== false) {
			this.mytabs = this.nodeTabs['ChecksumBot']
		}

		this.state = {
			nodeData: nodeData,
			nodeType: nodeType,
			tabIndex: (props.data.openTab ? Object.keys(this.mytabs).indexOf(props.data.openTab) || 0 : 0),
			isDirty: false,
			tabs: this.mytabs,

			paused: (this.dataStore.nodes[nodeData.id] || {}).paused
		}

		this.onClose = this.onClose.bind(this)

	}


	componentDidMount() {

		this.refreshData()

		var dialog = $('.settingsDialog.dialog' + this.dialogTagKey).closest('.theme-dialog').focus()
		this.modal = dialog.closest('.theme-modal').click((event) => {
			if ($(event.target).hasClass('theme-modal')) {
				dialog.focus()
			}
		})

		this.modal.css({ zIndex: (1000 + (this.props.data.zIndex || 0)) })

		dialog.addClass('theme-dialog-open')
		dialog.find('input:not([type=hidden]), select, textarea, button').first().focus().select()
		dialog.find('textarea').bind('keydown', function(e) {
			if (e.keyCode == 9) {
				e.preventDefault()
				var val = this.value,
					start = this.selectionStart,
					end = this.selectionEnd
				this.value = val.substring(0, start) + '\t' + val.substring(end)
				this.selectionStart = this.selectionEnd = start + 1
				return false
			}
		})
		LeoKit.center(dialog)
		setTimeout(() => {
			LeoKit.center(dialog)
		}, 500)

	}


	setCheckpoint(event) {

		if ($('#CheckpointDialogDateTimePicker').data('DateTimePicker')) {
			$('#CheckpointDialogDateTimePicker').data('DateTimePicker').hide()
		}

		switch (event.currentTarget.value) {
			case '1':
				this.setState({ dirty: true, checkpoint: 'z' + moment().format('/YYYY/MM/DD/HH/mm/ss/') }, () => {
					this.setDirty()
				})
				break

			case '2':
				if (!$('#CheckpointDialogDateTimePicker').data('DateTimePicker')) {
					$('#CheckpointDialogDateTimePicker').datetimepicker({
						inline: true,
						sideBySide: true,
						maxDate: moment().endOf('d'),
						defaultDate: moment()
					})
					$('#CheckpointDialogDateTimePicker').on('dp.change', (event) => {
						this.setState({ dirty: true, checkpoint: 'z' + event.date.format('/YYYY/MM/DD/HH/mm/ss/') }, () => {
							this.setDirty()
						})
					})
				} else {
					$('#CheckpointDialogDateTimePicker').data('DateTimePicker').show()
				}
				break

			default:
				this.setState({ dirty: true, checkpoint: event.currentTarget.value }, () => {
					this.setDirty()
				})
				break
		}

	}


	refreshData() {

		switch (this.state.nodeType) {
			case 'System':
				var nodeData = this.props.data
				if (nodeData.system) {
					this.mytabs = Object.assign(this.mytabs, config.registry.systems[nodeData.system.toLowerCase()]);
				}
				nodeData.settings = {}
				this.setState({
					nodeData: nodeData,
					tabs: this.mytabs,
					isReady: true
				}, () => {
					LeoKit.center(this.modal)
				})
				break

			case 'EventQueue':
				var nodeData = this.props.data
				nodeData.settings = {}
				this.setState({
					nodeData: nodeData,
					isReady: true
				}, () => {
					LeoKit.center(this.modal)
				})
				break

			default:
				var nodeData = this.state.nodeData
				nodeData.settings = {}
				this.setState({
					nodeData: this.props.data,
					isReady: true
				}, () => {
					LeoKit.center(this.modal)
				})
				break

		}

	}


	componentWillUnmount() {
		if (currentRequest) {
			currentRequest.abort()
		}
		if (this.modal) {
			this.onClose()
		}
	}


	componentWillMount() {
		if (this.props.data.type === 'bot') {
			this.dataStore.getCron(this.props.data.id);
		} else if (this.props.data.type === 'queue') {
			this.dataStore.getQueue(this.props.data.id);
		}
	}


	setDirtyState(isDirty) {
		this.setState({ isDirty: isDirty })
	}


	onClose() {
		if (this.state.isDirty) {
			this.confirmChange('Changes must be Saved or Reset before closing.', () => {
				LeoKit.close(this.modal)
				delete this.modal
				this.props.onClose && this.props.onClose()
			})
			return false
		}
		LeoKit.close(this.modal)
		delete this.modal
		this.props.onClose && this.props.onClose()
	}


	confirmChange(msg, callback) {
		if (typeof this.state.isDirty == 'object') {
			LeoKit.confirm(msg + ' Save them now?', {
				Save: this.state.isDirty.onSave.bind(false, callback),
				Reset: this.state.isDirty.onReset.bind(false, callback),
				cancel: false
			})
		} else if (typeof this.state.isDirty == 'function') {
			LeoKit.confirm(msg + ' Save them now?', {
				Save: this.state.isDirty,
				cancel: false
			})
		} else {
			window.messageModal(msg, 'warning')
		}
	}


	switchingTabs(index) {
		if (this.state.isDirty) {
			this.confirmChange('Changes must be Saved or Reset before switching tabs.', () => {
				this.setState({ tabIndex: index })
			})
		} else {
			this.setState({ tabIndex: index })
		}
	}


	toggleErrorDetails() {
		this.setState({ showErrorDetails: !this.state.showErrorDetails })
	}


	togglePause() {
		let node = this.dataStore.nodes[this.props.data.id] || {};
		let pause = !this.dataStore.nodes[this.props.data.id].paused;
		let data = { id: node.id, paused: pause };
		this.dataStore.nodes[node.id].paused = !this.dataStore.nodes[node.id].paused;
		$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
			this.dataStore.getStats();
			window.messageLogNotify('Bot ' + (!pause ? 'Unpaused' : 'Paused'), 'info')
		}).fail((result) => {
			this.dataStore.nodes[node.id].paused = !this.dataStore.nodes[node.id];
			window.messageLogModal('Failed attempting to ' + (!pause ? 'Unpause' : 'Pause') + ' bot ' + (node.label || ''), 'error', result)
		})
	}


	runNow(trueForce = false) {
		var data = { id: this.state.nodeData.id, executeNow: true };
		if (trueForce) {
			data.executeNowClear = true;
		}
		$.post(window.api + '/cron/save', JSON.stringify(data), (response) => {
			window.messageLogNotify('Run triggered for bot ' + (this.props.data.label || ''), 'info')
			window.fetchData()
		}).fail((result, status) => {
			if (status !== "abort" && status != "canceled") {
				window.messageLogModal('Failed attempting to run bot ' + (this.props.data.label || ''), 'error', result)
			}
		})
	}


	resetStream(forceRun) {
		if (this.props.data.id) {
			$.get(`api/dashboard/${encodeURIComponent(this.props.data.id)}?range=minute&count=15&timestamp=${encodeURIComponent(moment().format())}`, (result) => {
				var lastRead = false
				if (result && result.queues && result.queues.read) {
					for (var queueId in result.queues.read) {
						lastRead = (lastRead || result.queues.read[queueId].last_read)
					}
				}
				this.setState({
					resetStream: {
						forceRun: forceRun,
						nodeId: this.props.data.id,
						value: this.props.data.settings.checkpoint,
						lastRead: lastRead,
						label: this.props.data.label,
						links: (this.dataStore.nodes && this.dataStore.nodes[this.props.data.id] && this.dataStore.nodes[this.props.data.id].link_to && this.dataStore.nodes[this.props.data.id].link_to.parent) || {},
						source: (this.dataStore.nodes && this.dataStore.nodes[this.props.data.id] && this.dataStore.nodes[this.props.data.id].source) || false
					}
				})
			}).fail((result) => {
				result.call = `api/dashboard/${encodeURIComponent(this.props.data.id)}?range=minute&count=15&timestamp=${encodeURIComponent(moment().format())}`
				window.messageLogNotify('Failed to get bot settings', 'warning', result)
			})
		}
	}


	toggleDropdown() {
		this.setState({ showDropdown: !this.state.showDropdown })
	}


	render() {

		var nodeData = this.props.data
		var nodeId = this.props.data.id
		var node = this.dataStore.nodes[nodeId] || {}
		var templateId = node.templateId
		var template = (window.templates ? window.templates[templateId] || {} : {})
		var templateName = template.name
		var hasErrorStack = false

		var parents = Object.keys((node.link_to || {}).parent || {}).filter((parent) => {
			return this.dataStore.nodes[parent] && !this.dataStore.nodes[parent].archived
		})

		var children = Object.keys((node.link_to || {}).children || {}).filter((child) => {
			return this.dataStore.nodes[child] && !this.dataStore.nodes[child].archived
		})

		var kinesis_number = node.checkpoint || node.kinesis_number || '';

		return (<div className="theme-modal">
			<div tabIndex="-1" className="theme-dialog" onKeyDown={(e) => {
				if (e.keyCode === 27) {
					this.onClose()
				}
			}} >
				{
					((nodeData.logs || {}).errors || []).length > 0
						? (<div className={"node-error-message" + (this.state.showErrorDetails ? ' active' : '')} onClick={this.toggleErrorDetails.bind(this)}>
							<div className="error-exclamation">
								<i className="icon-exclamation margin-5" /> ERROR
							</div>
							<div className="error-preview">
								{
									nodeData.logs.errors.filter(e => e != null).map((error, i) => {
										hasErrorStack = hasErrorStack || error.stack
										return (error.msg || error.id || error.message || error.code
											? (<div key={i}>
												<span>{error.id || error.code}</span>
												<pre>{JSON.stringify(error.msg || error.message, null, 4)}</pre>
											</div>)
											: (<div key={i}>
												<pre>{JSON.stringify(error, null, 4)}</pre>
											</div>)
										)
									})
								}
							</div>
							{
								hasErrorStack
									? <button type="button" className="theme-button-warning theme-button-small">{this.state.showErrorDetails ? 'Hide' : 'View'} Error</button>
									: false
							}
							{
								this.state.showErrorDetails
									? (
										nodeData.logs.errors.map((error, i) => {
											return <pre key={i} className="stack">{error.stack}</pre>
										})
									)
									: false
							}
						</div>)
						: false
				}

				<header tabIndex="-2" className="theme-dialog-header flex-row flex-spread">

					<div className="node-dialog-title">

						<div className="flex-row overflow-hidden">

							<svg dangerouslySetInnerHTML={{ __html: NodeImages(nodeId, this.dataStore, { paused: this.dataStore.nodes[node.id].paused }) }}></svg>

							<div className="flex-column no-wrap overflow-hidden">
								<div className="flex-row">
									<span className="text-ellipsis display-inline-block text-top overflow-hidden">{(node.label || '')}</span>
									<a onClick={window.jumpToNode.bind(this, nodeData.id, this.onClose)}>
										<i className="icon-flow-branch"></i>
									</a>
								</div>

								<div className="theme-default-font-size header-data">
									{
										templateName || node.system
											? [
												<label key="0">Type</label>,
												<span key="1">{templateName || node.system}</span>
											]
											: false
									}
									<label>Id</label><span className="user-selectable">{this.state.nodeData.id}</span>
									{
										this.dataStore.cronInfo && nodeId == this.dataStore.cronInfo.id && leoAws && this.dataStore.cronInfo.lambdaName && leoAws.region ?
											<a className="bot-aws-link" onClick={() => { window.open(`https://${leoAws.region}.console.aws.amazon.com/lambda/home?region=${leoAws.region}#/functions/${this.dataStore.cronInfo.lambdaName}`) }}>lambda<img className="bot-aws-img" title={this.dataStore.cronInfo.lambdaName} src={window.leostaticcdn + 'images/aws/lambda.png'} /></a>

											: false
									}
									{
										(() => {
											// Get the repoUrl.  Depending on version of serverless-leo it may be in 1 of 3 spots. top level repoUrl, repo: tag, or in settings 
											let repoUrl = this.dataStore.cronInfo && (
												this.dataStore.cronInfo.repoUrl ||
												(
													this.dataStore.cronInfo.tags &&
													(this.dataStore.cronInfo.tags.split(",").find(t => t.match(/^repo:/)) || "").replace(/^repo:/, "")
												) ||
												(
													this.dataStore.cronInfo.lambda &&
													this.dataStore.cronInfo.lambda.settings &&
													this.dataStore.cronInfo.lambda.settings[0] &&
													this.dataStore.cronInfo.lambda.settings[0].repoUrl
												)
											);
											// TODO: try and infer a repo: tag based off the other settings
											if (repoUrl) {
												if (!repoUrl.match(/^https?:\/\//)) {
													repoUrl = "https://" + repoUrl;
												}
												let url = new URL(repoUrl);
												let hostname = url.hostname;
												let hostnamesImages = {
													"github.com": "github-mark.png",
													"bitbucket.org": "bitbucket-mark.png",
													"gitlab.com": "gitlab-mark.png",
													"git": "git.png"
												};
												let image = hostnamesImages[hostname] || hostnamesImages.git;

												return <a className="bot-repo-link" onClick={() => { window.open(repoUrl) }}><img className="bot-repo-img" title={hostname} src={window.leostaticcdn + 'images/icons/' + image} /></a>
											} else {
												return false
											}
										})()

									}
								</div>
								{
									(this.dataStore.cronInfo && nodeId == this.dataStore.cronInfo.id && this.dataStore.cronInfo.scheduledTrigger && this.dataStore.cronInfo.scheduledTrigger > Date.now()) ? <span className="bot-invoke-backoff">Backoff Until: {moment(this.dataStore.cronInfo.scheduledTrigger).format("MMM D, Y h:mm:ss a")}</span> : false
								}
							</div>

						</div>

						<div className="flex-grow flex-shrink"></div>

						<div className="node-button-wrapper theme-default-font-size no-wrap flex-row overflow-hidden">
							{
								this.state.nodeData.type === 'bot'
									? (<div className="node-button-bar no-wrap">

										<img title={(this.dataStore.nodes[nodeId].paused ? 'play' : 'pause')} src={window.leostaticcdn + 'images/icons/' + (this.dataStore.nodes[nodeId].paused ? 'play' : 'pause') + '.png'} onClick={this.togglePause.bind(this)} />

										<div className="flex-row overflow-hidden" onClick={this.toggleDropdown.bind(this)}>
											<i className="icon-flash" />
											<span className="kinesis-number">{kinesis_number || ' '}</span>
											<i className="icon-cog" />
											<i className="icon-down-dir" />
										</div>

									</div>)
									: false
							}

						</div>

						<div className="node-button-wrapper no-wrap flex-row margin-4">

							<span className={'node-navigate' + (parents.length ? '' : ' disabled')}>
								<i className="icon-left-open" onClick={
									(parents.length === 1)
										? () => {
											var parentId = parents[0]
											var parent = this.dataStore.nodes[parentId]
											this.props.onClose && this.props.onClose()
											window.nodeSettings({
												id: parentId,
												label: parent.label,
												server_id: parent.id,
												type: parent.type
											})
										}
										: () => {
											this.setState({ showPrev: !this.state.showPrev })
										}
								} />
								{
									parents.length > 1
										? <em>{parents.length}</em>
										: false
								}
								{
									parents.length > 1 && this.state.showPrev
										? (<div className="node-navigate-popup theme-popup-below-left">
											<div className="mask" onClick={() => { this.setState({ showPrev: !this.state.showPrev }) }}></div>
											<header>Previous Nodes</header>
											<ul>
												{
													parents.map((parentId, index) => {
														var parent = this.dataStore.nodes[parentId]
														return (<li key={index} onClick={() => {
															this.props.onClose && this.props.onClose()
															window.nodeSettings({
																id: parentId,
																label: parent.label,
																server_id: parent.id,
																type: parent.type
															})
														}}>{parent.label}</li>)
													})
												}
											</ul>
										</div>)
										: false
								}
							</span>

							<span className={'node-navigate' + (children.length ? '' : ' disabled')}>
								<i className="icon-right-open" onClick={
									(children.length === 1)
										? () => {
											var childId = children[0]
											var child = this.dataStore.nodes[childId]
											this.props.onClose && this.props.onClose()
											window.nodeSettings({
												id: childId,
												label: child.label,
												server_id: child.id,
												type: child.type
											})
										}
										: () => {
											this.setState({ showNext: !this.state.showNext })
										}
								} />
								{
									children.length > 1
										? <em>{children.length}</em>
										: false
								}
								{
									children.length > 1 && this.state.showNext
										? (<div className="node-navigate-popup theme-popup-below-left">
											<div className="mask" onClick={() => { this.setState({ showNext: !this.state.showNext }) }}></div>
											<header>Next Nodes</header>
											<ul>
												{
													children.map((childId, index) => {
														var child = this.dataStore.nodes[childId]
														return (<li key={index} onClick={() => {
															this.props.onClose && this.props.onClose()
															window.nodeSettings({
																id: childId,
																label: child.label,
																server_id: child.id,
																type: child.type
																//,openTab: Object.keys(this.state.tabs)[this.state.tabIndex]
															})
														}}>{child.label}</li>)
													})
												}
											</ul>
										</div>)
										: false
								}
							</span>

						</div>

						{
							this.state.showDropdown
								? (<ul className="dropdown">
									<div className="mask" onClick={this.toggleDropdown.bind(this)} />
									<li onClick={this.resetStream.bind(this, false)}><a>Change Checkpoint</a></li>
									<li onClick={this.runNow.bind(this, false)}><a>Force Run</a></li>
									{
										localStorage.getItem('enableAdminFeatures')
											? <li onClick={this.runNow.bind(this, true)}><a>Force Run (Really)</a></li>
											: false
									}
									<li><a>Replay a range of events (coming soon)</a></li>
									{
										(this.state.nodeData.parents || []).length
											? <li onClick={this.resetStream.bind(this, true)}><a>Change Checkpoint and Force Run</a></li>
											: false
									}
								</ul>)
								: false
						}

					</div>

					<i className="theme-icon-close" onClick={this.onClose.bind(this)} style={{ order: 99 }}></i>

				</header>
				<form className="theme-form">
					<main>
						<div className={'settingsDialog dialog' + this.dialogTagKey}>
							{
								!this.state.isReady

									? (<div className="theme-spinner-large"></div>)

									: (<div className="theme-tabs toggleTabs height-1-1">

										<ul>
											{
												Object.keys(this.state.tabs).map((label, index) => {
													return (<li key={label} className={this.state.tabIndex == index ? 'active' : ''} onClick={this.switchingTabs.bind(this, index)} title={label}>{label}</li>)
												})
											}
										</ul>

										<div style={{ height: 'calc(100% - 45px)' }}>

											{
												Object.keys(this.state.tabs).map((label, tabIndex) => {

													return (<div key={label} className={(this.state.tabIndex == tabIndex ? 'active' : '') + ' height-1-1'}>

														{(function(me) {

															if (me.state.tabIndex !== tabIndex) {
																return false
															}

															var TAB = config.registry.tabs[me.state.tabs[label]];
															if (TAB) {
																return <TAB nodeData={me.state.nodeData} onClose={me.onClose.bind(me)} setDirtyState={me.setDirtyState.bind(me)} />;
															} else {
																return 'Tab "' + me.state.tabs[label] + '" not configured'
															}
														})(this)}

													</div>)
												})
											}

										</div>

									</div>)
							}
						</div>

					</main>
					<footer>

					</footer>
				</form>
			</div>

			{
				this.state.resetStream
					? <ResetStream {...this.state.resetStream} onClose={() => { this.setState({ resetStream: undefined }) }} />
					: false
			}


		</div>)

	}

}

export default connect(store => store)(Settings)
