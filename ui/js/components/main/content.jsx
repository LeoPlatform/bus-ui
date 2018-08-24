import React, {Component} from 'react'
import { connect } from 'react-redux';
import {inject, observer} from 'mobx-react'
import { saveSettings } from '../../actions'

import DashboardPage from '../pages/dashboardPage.jsx'
import CatalogPage from '../pages/catalogPage.jsx'
import WorkflowPage from '../pages/workflowPage.jsx'
import TracePage from '../pages/tracePage.jsx'
import SDKPage from '../pages/sdkPage.jsx'
import NodeSettings from '../dialogs/nodeSettings.jsx'
import BotSettings from '../tabs/botSettings.jsx'
import SystemSettings from '../tabs/systemSettings.jsx'
import SavedWorkflows from '../dialogs/savedWorkflows.jsx'
import SavedSearches from '../dialogs/savedSearches.jsx'

@inject('dataStore')
@observer
class Content extends React.Component {
	constructor(props) {
		super(props);
        this.dataStore = this.props.dataStore;
        this.state = {}

	}


	componentDidMount() {

		window.showDialog = (dialogType, settings) => {

			switch(dialogType) {
				case 'manageSearches': case 'manageWorkflows': case 'createBot': case 'createSystem': case 'subNodeSettings': case 'traceSettings':
					this.setState({ [dialogType]: undefined }, () => {
						this.setState({ [dialogType]: settings || {} })
					})
				break
			}
		}

		window.createBot = (data) => {
			this.setState({ createBot: data })
		}

		window.duplicateNode = (data) => {
			var node = this.dataStore.nodes[data.id] || {};
			switch(node.type) {
				case 'system':
					this.setState({ nodeSettings: undefined }, () => {
						this.setState({ createSystem: node })
					})
				break

				case 'bot':
					node.id = data.id //use correct id
					node.server_id = '' //show source
					node.group = 'bot'
					//$('.settingsDialog').closest('.theme-modal').remove()
					this.setState({ nodeSettings: undefined }, () => {
						this.setState({ createBot: node })
					})
				break
			}
		}

		window.createSystem = (data) => {
			this.setState({ createSystem: data })
		}

		window.nodeSettings = (data) => {
			this.setState({ nodeSettings: undefined }, () => {
				if (data) {
					this.setState({ nodeSettings: data })
				}
			})
		}

		window.subNodeSettings = (data) => {
			this.setState({ subNodeSettings: data })
		}

		window.traceSettings = (data) => {
			//$('.traceSettings').closest('.theme-modal-full').remove()
			data.zIndex = 10
			this.setState({ traceSettings: undefined }, () => {
				this.setState({ traceSettings: data })
			})
		}

		window.createNode = () => {

			if (this.state.createNode) {
				return false
			}

			this.setState({
				createNode: {
					Bot: () => {
						window.createBot({ server_id: '', groups: ['bot', 'cron'], })
						LeoKit.close(this.createDialog)
						this.setState({ createNode: false })
					},
					/*
					Checksum: () => {
						window.createBot({ source: null, group: 'checksum', system: { type: 'checksum' } })
						LeoKit.close(this.createDialog)
						this.setState({ createNode: false })
					},
					*/
					/*
					Cron: () => {
						window.createBot({ source: null, group: 'cron', system: { type: 'cron' } })
						LeoKit.close(this.createDialog)
						this.setState({ createNode: false })
					},
					*/
					/*
					Webhook: () => {
						window.createBot({ source: null, group: 'webhook', system: { type: 'webhook' } })
						LeoKit.close(this.createDialog)
						this.setState({ createNode: false })
					},*/
					System: () => {
						window.createSystem({})
						LeoKit.close(this.createDialog)
						this.setState({ createNode: false })
					}
				}
			}, () => {
				this.createDialog = LeoKit.dialog($('.createNode'), {
						cancel: false
					},
					'Select Node Type to Create',
					() => {
						this.setState({ createNode: false })
					}
				)
			})

		}

	}


	render() {
		return (<div className="page-main-wrapper">
				{
					(() => {

						switch(this.props.userSettings.view|| 'dashboard') {
                            case 'dashboard':
								return <DashboardPage />
							break

							case 'list':
								return <CatalogPage searches={this.props.searches} />
							break

							case 'node':
								return <WorkflowPage workflows={this.props.workflows} />
							break

							case 'trace':
								return <TracePage />
							break

							case 'sdk':
								return <SDKPage/>
							break

							default:
								this.props.userSettings.view
                                break
						}
					})()
				}

				{
					this.state.createBot
					? <BotSettings action="create" data={this.state.createBot} onSave={(response) => { this.setState({ nodeSettings: { id: 'b_' + response.refId, openTab: 'Code', label: response.label, type: 'bot', server_id: response.refId }, createBot: undefined }) }} onClose={() => { this.setState({ createBot: undefined }) }} />
					: false
				}
				{
					this.state.createSystem
					? <SystemSettings action="create" data={this.state.createSystem} onSave={(response) => {
						this.props.dispatch(saveSettings({ node: response.id, selected: [response.id], offset: [0,0] }));
						this.dataStore.changeAllStateValues([response.id], this.dataStore.urlObj.timePeriod, this.dataStore.view, [0,0], response.id, this.dataStore.zoom, this.dataStore.details);
						window.fetchData()
					}} onClose={() => { this.setState({ createSystem: undefined }) }} />
					: false
				}
				{
					this.state.nodeSettings
					? <NodeSettings nodeType={{ bot: 'AWSBot', queue: 'EventQueue', system: 'System'}[this.state.nodeSettings.type]} data={this.state.nodeSettings} onClose={() => { this.setState({ nodeSettings: undefined }) }} />
					: false
				}
				{
					this.state.subNodeSettings
					? <NodeSettings nodeType={{ bot: 'AWSBot', queue: 'EventQueue', system: 'System'}[this.state.subNodeSettings.type]} data={this.state.subNodeSettings} onClose={() => { this.setState({ subNodeSettings: undefined }) }} />
					: false
				}
				{
					this.state.traceSettings
					? <NodeSettings nodeType={this.state.traceSettings.type === 'bot' ? 'MapperBot' : 'EventQueue'} data={this.state.traceSettings} onClose={() => { this.setState({ traceSettings: undefined }) }} />
					: false
				}
				{
					this.state.createNode
					? (<div>
						<div className="createNode flex-row flex-space">
							{
								Object.keys(this.state.createNode).map((buttonLabel) => {
									return (<button key={buttonLabel} type="button" className="theme-button" onClick={this.state.createNode[buttonLabel].bind(this)}>
										<img className="theme-image-tiny text-middle margin-5" src={window.leostaticcdn + 'images/nodes/' + buttonLabel.toLowerCase() + '.png'} />
										{buttonLabel}
									</button>)
								})
							}
						</div>
					</div>)
					: false
				}

				{
					this.state.manageWorkflows
					? <SavedWorkflows workflows={this.props.workflows} />
					: false
				}

				{
					this.state.manageSearches
					? <SavedSearches searches={this.props.searches} />
					: false
				}

		</div>)

	}

}

export default connect(store => store)(Content)
