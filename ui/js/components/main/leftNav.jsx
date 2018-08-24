import React, {Component} from 'react'
import { connect } from 'react-redux'
import {inject, observer} from 'mobx-react'
import { saveSettings } from '../../actions'

@inject('dataStore')
@observer
class LeftNav extends React.Component {

	constructor(props) {
		super(props);
        this.dataStore = this.props.dataStore;

        this.state = {
			alarmedCount: this.dataStore.alarmedCount
		};
	}


	toggleView(view) {
		this.setState({ hover: (view === this.state.hover ? undefined : view) })
		this.props.dispatch(saveSettings({ view: view }))
		this.dataStore.changeView(view);
	}


	toggleMenu() {
		this.setState({ showMenu: !this.state.showMenu })
	}


	toggleHover(view) {
		this.setState({ hover: view })
	}

    resetDataStoreState() {
		this.dataStore.resetState();
	}


	render() {
		var savedWorkflows = this.props.workflows.order(),
			savedSearches = this.props.searches.order();

		return (<div className={'left-nav' + (this.state.showMenu ? ' active' : '')} onClick={this.toggleMenu.bind(this)}>

			<div className="mask" />

			<div className="page-logo" onClick={this.resetDataStoreState.bind(this)}>
				<a href="#"><img src="//cdnleo.s3.amazonaws.com/logos/leo_icon.png" /></a>
			</div>

			<div className={!this.props.userSettings.view || this.props.userSettings.view === 'dashboard' ? 'active' : ''} onClick={this.toggleView.bind(this, 'dashboard')}>
			{/*<div className={this.dataStore.urlObj.view === 'dashboard' ? 'active' : ''} onClick={this.toggleView.bind(this, 'dashboard')}>*/}
				<i className="icon-layout theme-red-bubble" data-count={this.dataStore.alarmedCount} />
			</div>

			<div title="Workflow" className={this.props.userSettings.view === 'node' ? 'active' : ''} onMouseEnter={this.toggleHover.bind(this, 'node')} onMouseLeave={this.toggleHover.bind(this, '')}>
			{/*<div title="Workflow" className={this.dataStore.urlObj.view === 'node' ? 'active' : ''} onMouseEnter={this.toggleHover.bind(this, 'node')} onMouseLeave={this.toggleHover.bind(this, '')}>*/}
				<span onClick={this.toggleView.bind(this, 'node')}>
					<i className="icon-flow-branch" />
				</span>
				<div className={'pop-out' + (this.state.hover === 'node' ? ' hover' : '')}>
					<header>
						{
							savedWorkflows.length
							? <i className="icon-cog pull-right" style={{ fontSize: 20 }} onClick={() => { window.showDialog('manageWorkflows') }} />
							: false
						}
						Saved Workflows
					</header>
					<ul className="workflow-links">
						{
							savedWorkflows.map((view) => {
								return (<li key={view}>
									<a onClick={this.props.workflows.restore.bind(this, view)}>{view}</a>
								</li>)
							})
						}
						{
							!savedWorkflows.length
							? <li>
								<em>There are no saved Workflows</em>
							</li>
							: false
						}
						{
                            //this.dataStore.urlObj.view === 'node'
                            this.props.userSettings.view === 'node'
                                ? <li>
								<a onClick={this.props.workflows.save}>
									<i className="icon-bookmark" /> Save this Workflow View
								</a>
							</li>
							: false
						}
					</ul>
				</div>
			</div>

			<div title="Catalog" className={this.props.userSettings.view === 'list' ? 'active' : ''} onMouseEnter={this.toggleHover.bind(this, 'list')} onMouseLeave={this.toggleHover.bind(this, '')}>
			{/*<div title="Catalog" className={!this.dataStore.urlObj.view || this.dataStore.urlObj.view === 'list' ? 'active' : ''} onMouseEnter={this.toggleHover.bind(this, 'list')} onMouseLeave={this.toggleHover.bind(this, '')}>*/}
				<span onClick={this.toggleView.bind(this, 'list')}>
					<i className="icon-list-bullet" />
				</span>
				<div className={'pop-out' + (this.state.hover === 'list' ? ' hover' : '')}>
					<header>
						{
							savedSearches.length
							? <i className="icon-cog pull-right" style={{ fontSize: 20 }} onClick={() => { window.showDialog('manageSearches') }} />
							: false
						}
						Saved Searches
					</header>
					<ul className="workflow-links">
						{
							savedSearches.map((view) => {
								return (<li key={view}>
									<a onClick={this.props.searches.restore.bind(this, view)}>{view}</a>
								</li>)
							})
						}
						{
							!savedSearches.length
							? <li>
								<em>There are no saved Searches</em>
							</li>
							: false
						}
						{
							this.props.userSettings.view === 'list'
                            //this.dataStore.urlObj.view === 'list'
                            ? <li>
								<a onClick={this.props.searches.save}>
									<i className="icon-bookmark" /> Save this Search
								</a>
							</li>
							: false
						}
					</ul>
				</div>


			</div>

			<div className={this.props.userSettings.view === 'trace' ? 'active' : ''}>
                {/*<div className={this.dataStore.urlObj.view === 'trace' ? 'active' : ''}>*/}
				<span onClick={this.toggleView.bind(this, 'trace')} title="Trace"><i className="icon-flash" /></span>
			</div>

			{/*FOR LATER WHEN SDKpage IS FINSIHED*/}
			{/*<div className={this.props.userSettings.view === 'sdk' ? 'active' : ''}>*/}
                {/*/!*<div className={this.dataStore.urlObj.view === 'trace' ? 'active' : ''}>*!/*/}
				{/*<span onClick={this.toggleView.bind(this, 'sdk')} title="SDK"><i className="icon-sdk" /></span>*/}
			{/*</div>*/}

			<div title="documentation">
				<a href={window.leoDocsLink + ({ dashboard: 'dashboard', node: 'workflows', list: 'catalog', trace: 'trace' }[this.props.userSettings.view || 'list'])} target="documentation">
				{/*<a href={window.leoDocsLink + ({ dashboard: 'dashboard', node: 'workflows', list: 'catalog', trace: 'trace' }[this.dataStore.urlObj.view || 'list'])} target="documentation">*/}
					<i className="icon-help-circled fixed-width-icon"></i>
				</a>
			</div>

		</div>)
	}

}

export default connect(store => store)(LeftNav)
