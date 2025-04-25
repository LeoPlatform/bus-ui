import React, {Component} from 'react';

import TagsInput from '../elements/tagsInput.jsx'
import ComboBox from '../elements/comboBox.jsx'

class DataSourceConnect extends React.Component {

	constructor(props) {
		super(props)

		this.state = {
			step: 0
		}
	}


	componentDidMount() {

		this.modal = LeoKit.modal($('.DataSourceConnect'),
			{},
			'<i class="icon-database" /> Connect to a data source',
			this.props.onClose
		)

	}

	onChoose() {
		this.setState({ step: 1 }, () => {
			LeoKit.center(this.modal)
		})
	}


	onFocus() {
		this.setState({ active: true })
		console.log('focus')
	}


	onBlur() {
		setTimeout(() => {
			this.setState({ active: false })
			console.log('blur')
		}, 100)
	}


	onChange(event) {
		this.setState({ text: event.currentTarget.value })
	}

	setDirty() {}

	setIcon() {}


	pickProfile() {
		console.log('pi<li onClick={this.pickProfile}>')
		this.setState({ active: false })
	}


	onNext() {
		this.setState({ step: this.state.step+1 }, () => {
			console.log('step', this.state.step)
		})
	}


	onPrev() {
		this.setState({ step: this.state.step-1 }, () => {
			console.log('step', this.state.step)
		})
	}


	render() {

		return (<div>
			<div className="DataSourceConnect">

				{
					this.state.step === 0

					? (<div>
						<div style={{maxWidth: 890, padding: 45 }}>

							<div className="flex-row flex-spread">
								<div className="theme-section-header">Choose a New Data Source</div>

								<div>
									<label className="theme-form-label">Existing Data Sources</label>
									<select className="theme-form-input">
										<option>Select an existing data source...</option>
									</select>
								</div>
							</div>

							<div className="flex-row" style={{ flexWrap: 'wrap', marginLeft: -8 }}>

								<button type="button" className="theme-button-big align-middle" onClick={this.onChoose.bind(this, 'mongoDB')}>
									<img src={window.leostaticcdn + '/images/icons/leaf.png'} />
									mongoDB
								</button>

								<button type="button" className="theme-button-big align-middle">
									<img src={window.leostaticcdn + '/images/icons/gear.png'} />
									Custom
								</button>

								<button type="button" className="theme-button-big align-middle flex-row disabled">
									<img src={window.leostaticcdn + '/images/icons/gear.png'} />
									<div className="display-inline-block">
										<small>coming soon</small>
										MySQL
									</div>
								</button>

								<button type="button" className="theme-button-big align-middle flex-row disabled">
									<img src={window.leostaticcdn + '/images/icons/gear.png'} />
									<div className="display-inline-block">
										<small>coming soon</small>
										SQL
									</div>
								</button>

								<button type="button" className="theme-button-big align-middle flex-row disabled">
									<img src={window.leostaticcdn + '/images/icons/gear.png'} />
									<div className="display-inline-block">
										<small>coming soon</small>
										Webhook
									</div>
								</button>

							</div>

						</div>

						<footer className="flex-row" style={{ background: '#E2E2E2', maxWidth: 890, padding: '20px 45px' }}>

							<div className="flex-grow">
								<div className="theme-section-header">Leo SDK</div>
								<div className="theme-section-subheader">Load events directly using the Leo SDK:</div>
								<table className="theme-plain-table">
									<tbody>
										<tr>
											<th>nodeJS</th>
											<td><a href={window.leoDocsLink} target="documentation">Docker</a></td>
											<td>|</td>
											<td><a href={window.leoDocsLink} target="documentation">Github</a></td>
										</tr>
										<tr>
											<th>php</th>
											<td><a href={window.leoDocsLink} target="documentation">Docker</a></td>
											<td>|</td>
											<td><a href={window.leoDocsLink} target="documentation">Github</a></td>
										</tr>
									</tbody>
								</table>
							</div>

							<div className="flex-grow">
								<div className="theme-section-header">Leo API</div>
								<div className="theme-section-subheader">Data can also be added via the Leo API:</div>
								<a href={window.leoDocsLink} target="documentation">API documentation</a>
							</div>

						</footer>
					</div>)

					: (<div className="theme-tabs">
						<ul>
							<li className={this.state.step === 1 ? 'active' : ''}>Connection</li>
							<li className={this.state.step === 2 ? 'active' : 'disabled'}>Destination</li>
							<li className={this.state.step === 3 ? 'active' : 'disabled'}>Bot</li>
						</ul>
						<div>

							<div className={'theme-form' + (this.state.step === 1 ? ' active' : '')}>

								<ComboBox label="Connection Profile" placeholder="Choose a connection profile..."  icon={window.leostaticcdn + 'images/system.png'} name="connection profile" />

								<div className="theme-form-section">
									<div className="theme-form-group-heading">
										Connection Profile Details
									</div>

									<div className="theme-required">
										<label>Host</label>
										<input type="text" name="host" defaultValue={this.state.host} onChange={this.setDirty.bind(this)} />
									</div>

									<div className="theme-required">
										<label>Database</label>
										<input type="text" name="database" defaultValue={this.state.database} onChange={this.setDirty.bind(this)} />
									</div>

									<div>
										<label>Icon</label>
										<input type="url" name="icon" defaultValue={this.state.icon} placeholder="http://" onChange={this.setIcon.bind(this)} />
										<div><small className="field-description">A custom icon can help this data source be quickly identified in the workflow.</small></div>
									</div>

									<div>
										<label>Tags</label>
										<TagsInput name="tags" defaultValue={this.state.tags} onChange={this.setDirty.bind(this)} />
									</div>


								</div>


							</div>

							<div className={'theme-form' + (this.state.step === 2 ? ' active' : '')}>

								<ComboBox label="Queue name" placeholder="Add a queue..." icon={window.leostaticcdn + 'images/queue.png'} name="queue" />

								<div>
									<label>Tags</label>
									<TagsInput name="queue_tags" defaultValue={this.state.queue_tags} onChange={this.setDirty.bind(this)} />
								</div>
							</div>

							<div className={'theme-form' + (this.state.step === 3 ? ' active' : '')}>

								<div className="theme-required">
									<label>Bot name</label>
									<input  />
								</div>

								<div className="theme-required">
									<label>Description</label>
									<textarea />
								</div>

								<div>
									<label>Tags</label>
									<TagsInput name="queue_tags" defaultValue={this.state.queue_tags} onChange={this.setDirty.bind(this)} />
								</div>

								<div className="theme-form-section">
									<div className="theme-form-group-heading">Bot Settings</div>

									<div className="theme-required">
										<label>Collection</label>
										<input />
									</div>
								</div>

							</div>

						</div>

						<div className="form-button-bar">
							{
								this.state.step > 1
								? <button type="button" className="theme-button pull-left" onClick={this.onPrev.bind(this)}>Prev</button>
								: false
							}
							<div className="pull-right">
								<button type="button" className="theme-button">Cancel</button>
								{
									this.state.step === 3
									? <button type="button" className="theme-button-primary" onClick={this.onNext.bind(this)}>Create Data Source</button>
									: <button type="button" className="theme-button-primary" onClick={this.onNext.bind(this)}>Next</button>
								}
							</div>
						</div>

					</div>)
				}

			</div>
		</div>)

	}

}

export default DataSourceConnect
