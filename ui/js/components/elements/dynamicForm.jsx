import React, {Component} from 'react'

import Trigger from '../elements/trigger.jsx'
import NodeSearch from '../elements/nodeSearch.jsx'
import TagsInput from '../elements/tagsInput.jsx'
import ListInput from '../elements/listInput.jsx'
import SubQueue from '../elements/subQueue.jsx'
import {inject, observer} from 'mobx-react'

class DynamicForm extends React.Component {

	hasAdvanced = false

	constructor(props) {
		super(props)
		this.state = {}
	}


	showAdvanced() {
		this.setState({ showAdvanced: !this.state.showAdvanced }, () => {
			this.props.toggleAdvanced && this.props.toggleAdvanced(this.state.showAdvanced)
		})
	}


	render() {
		var form = this.props.form

		var advanced = { section: {} }

		Object.keys(form).map((fieldName) => {
			if (form[fieldName].advanced) {
				advanced.section[fieldName] = form[fieldName]
			} else if (form[fieldName].section) {
				Object.keys(form[fieldName].section).map((sectionFieldName) => {
					if (form[fieldName].section[sectionFieldName].advanced) {
						advanced.section[sectionFieldName] = form[fieldName].section[sectionFieldName]
						delete form[fieldName].section[sectionFieldName]
					}
				})
			}
		})

		if (Object.keys(advanced.section).length) {
			form.advanced = advanced
		}

		return (<div className={this.props.className || 'theme-form'}>
			{
				Object.keys(form).map((fieldName, index) => {
					return (<DynamicFormRow key={fieldName} resetOverrides={this.props.resetOverrides} id={this.props.id} fieldName={fieldName} field={form[fieldName]} defaults={this.props.defaults} setRequiredFields={this.props.setRequiredFields} showAdvanced={this.state.showAdvanced} onChange={this.props.onChange} />)
				})
			}
			{
				form.advanced
				? (<div>
					<label/>
					<button type="button" className="theme-button" onClick={this.showAdvanced.bind(this)}> {this.state.showAdvanced ? 'Hide' : 'Show'} Advanced Settings </button>
				</div>)
				: false
			}
		</div>)

	}

}


export default DynamicForm

@inject('dataStore')
@observer
class DynamicFormRow extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			field: this.props.field,
			fieldName: this.props.fieldName
		};
		this.dataStore = this.props.dataStore;
	}



	componentWillReceiveProps(props) {

		if (props != this.props) {
			this.setState({
				field: props.field,
				fieldName: props.fieldName
			})
		}

	}


	invocationTypeChange(event) {
		var field = this.state.field
		field.placeholder = event.currentTarget.value
		this.setState({ field: field })
		field.onChange && field.onChange(event.currentTarget.value)
	}


	render() {

		var field = this.state.field
			, fieldName = this.state.fieldName
			, defaults = this.props.defaults

		//var field = form[fieldName]
		switch(typeof field) {
			case 'string':
				field = {
					type: field,
					required: true
				}
			break

			case 'object':
				if (field.length) {
					field = {
						type: 'select',
						required: true,
						values: field
					}
				}
			break

			case 'boolean':
				return undefined
			break

			default:
				console.log('typeof', field, typeof field)
				return undefined
			break
		}

		field.name = field.name || fieldName
		field.label = field.label || fieldName
		field.type = field.type || 'text'
		field.onChange = field.onChange || this.props.onChange

		if (typeof field.value === 'object' && field.value != null) {
			if (field.value.constructor === Array) {
				field.value = field.value.toString()
			} else {
				field.value = JSON.stringify(field.value, null, 4)
			}
		}

		if (this.props.setRequiredFields) {
			if (field.required) {
				switch(field.type) {
					case 'trigger':
						this.props.setRequiredFields({
							triggers: { label: 'Trigger Source', type: 'text' },
							time: { label: 'Trigger Time', type: 'text' }
						}, true)
					break

					case 'auth':
						this.props.setRequiredFields({
							security: { label: 'Security', type: 'select' },
							policy: { label: 'Policy', type: 'json' }
						}, true)
					break

					case 'readonly':
						//skip
					break

					default:
						this.props.setRequiredFields({ [field.name]: field }, true)
					break
				}
			} else if (!field.group && !field.section) {
				this.props.setRequiredFields({ [field.name]: field }, false)
			}
		}

		if (field.type == 'auth') {

			field.group = $.extend(true, {}, field.group, {
				security: {
					required: field.required,
					type: 'select',
					values: {
						aws_signed: 'AWS Signed', token: 'Token', basic_auth: 'Basic Auth'
					},
					help: field.help,
					description: field.description
				},
				policy: {
					required: field.required,
					type: 'json'
				}
			})

			delete field.required
			delete field.help
			delete field.description
		}

		if (field.advanced && !this.props.showAdvanced) {
			return <input type="hidden" name={field.name} value={field.value || ''} readOnly />
		}

		field.label = (field.label || '').replace(/_/g, ' ')

		if (field.section && !Object.keys(field.section).length) {
			return false
		}

		if (defaults[field.name]) {
			if (field.group) {
				Object.keys(field.group).forEach((groupField) => {
					if (defaults[groupField]) {
						defaults[field.name][groupField] = defaults[groupField]
					}
				})
				defaults = defaults[field.name]
			} else {
				field.value = defaults[field.name]
			}
		}

		return (<div className={field.section ? 'theme-form-section' : (field.group ? 'theme-form-group' : (field.required ? 'theme-required' : ''))}>

			{
				field.section
				? [(<div key="0" className="theme-form-row theme-form-group-heading">
					<div>{field.label}</div><div>&nbsp;</div>
				</div>),
					<div key="1">&nbsp;</div>
				]
				: (field.type != 'hidden'
					? <label className="no-wrap">{field.label}</label>
					: false
				)
			}

			{
				field.group && field.description
				? (<span><small className="field-description" dangerouslySetInnerHTML={{__html: field.description}}></small></span>)
				: false
			}

			{
				field.group && field.help
				? (<span className="help-rollover"><i className="icon-help-circled"></i><span dangerouslySetInnerHTML={{__html: field.help}}></span></span>)
				: false
			}

			{
				field.section
				? (
					Object.keys(field.section).map((fieldName, index) => {
						return (<DynamicFormRow key={fieldName} resetOverrides={this.props.resetOverrides} fieldName={fieldName} field={field.section[fieldName]} defaults={defaults} setRequiredFields={this.props.setRequiredFields} showAdvanced={this.props.showAdvanced} onChange={this.props.onChange} />)
					})
				)
				: false
			}

			{
				field.group
				? (<div className="theme-form">
					{
						Object.keys(field.group).map((fieldName, index) => {
							return (<DynamicFormRow key={fieldName} resetOverrides={this.props.resetOverrides} fieldName={fieldName} field={field.group[fieldName]} defaults={defaults} setRequiredFields={this.props.setRequiredFields} showAdvanced={this.props.showAdvanced} onChange={this.props.onChange} />)
						})
					}
				</div>)
				: false
			}

			{
				field.label === 'overrides' && (field.section && field.section.consecutive_errors)
				? (<button type="button" className="button-reset-overrides" onClick={this.props.resetOverrides}> Reset Overrides </button>)
				:
				false
			}

			{
				field.group || field.section
				? false
				: (() => {

					field.value = field.defaultValue || field.value

					switch(field.type.toLowerCase()) {

						case 'readonly':
							return (<span>
								<span title={field.title} className={'no-wrap theme-color-' + (field.color || 'gray')}>{field.text || field.value}</span>
								{
									field.edit
									? (<a className="padding-10" onClick={field.edit}>edit</a>)
									: false
								}
								<input name={field.name} type="hidden" value={field.value || ''} readOnly />
							</span>)
						break

						case 'hidden':
							return <input name={field.name} type="hidden" value={field.value || ''} readOnly />
						break

						case 'json':
							if (typeof field.value == 'string') {
								try {
									field.value = JSON.parse(field.value)
								} catch(e) {}
							}
							return <textarea name={field.name} placeholder={field.placeholder || ''} title={field.title} value={JSON.stringify(field.value || {}, null, 4)} className="codeMirror theme-form-input" style={{height:200}} readOnly={field.readOnly} onChange={field.onChange}></textarea>
						break

						case 'textarea':
							return <textarea name={field.name} placeholder={field.placeholder || ''} title={field.title} value={field.value || ''} readOnly={field.readOnly} onChange={field.onChange} />
						break

						case 'checkbox':
							return <input type={field.type} value={field.value} id={field.id} onClick={field.onClick}/>
						break

						case 'tags': case 'tag':
							return <TagsInput name={field.name} placeholder={field.placeholder || ''} title={field.title} value={field.value || ''} readOnly={field.readOnly} pattern={field.pattern} onChange={field.onChange} />
						break

						case 'text': case 'number': case 'url':
							return <input name={field.name} type={field.type} placeholder={field.placeholder || ''} title={field.title} value={field.value || ''} readOnly={field.readOnly} pattern={field.pattern} onChange={field.onChange} />
						break

						case 'textoverrides':
							return (<div>
										<input type={field.type2} value={field.value} id={field.id} onClick={field.onClick} style={field.style2}/>
										<input disabled={!field.disabled} name={field.name} type={field.type} value={field.value || ''} onChange={field.onChange} style={field.style}/>
									</div>)
						break

						case 'errorpercent':
							return (
								<div>
									<input type={field.type2} value={field.value} id={field.id} onClick={field.onClick} style={field.style2}/>
									<input disabled={!field.disabled} name={field.name} type={field.valueType} min='0' max='100' value={field.value || ''} onChange={field.onChange} style={field.style}/>
									<span className="no-wrap text-middle">%</span>
								</div>
							)
						break

						case 'select': case 'selectbox':
							return (<select name={field.name} title={field.title} value={field.value} onChange={field.onChange}>
								{
									Object.keys(field.values || []).map((value, key) => {
										return (<option key={key} value={field.values.length ? field.values[value] : value}>{field.values[value]}</option>)
									})
								}
							</select>)
						break

						case 'trigger':
							return <Trigger values={field.values} value={field.value} onChange={field.onChange} />
						break

						case 'invocation':
							return [
								(<select key="0" name="invocationType" title={field.title} value={field.value} onChange={this.invocationTypeChange.bind(this)}>
									{
										Object.keys(field.values || []).map((value, key) => {
											return (<option key={key} value={field.values.length ? field.values[value] : value}>{field.values[value]}</option>)
										})
									}
								</select>),
								(<div key="1"><input name="lambdaName" placeholder={field.placeholder || (field.values || [])[0] || ''} title={field.title} value={field.lambdaName} readOnly={field.readOnly} pattern={field.pattern} onChange={field.onChange} /></div>)
							]
						break

						case 'autocomplete':
							return <NodeSearch name={field.name} value={field.value} className="display-inline-block" nodeType={field.nodeType} matches={field.matches} onChange={field.onChange} />
						break

						case 'list':
							return <ListInput name={field.name} placeholder={field.placeholder || ''} title={field.title} value={field.value || ''} readOnly={field.readOnly} pattern={field.pattern} onChange={field.onChange} />
						break

						case 'subqueue':
							return <SubQueue name={field.name} nodeType={field.nodeType || 'systems'} placeholder={field.placeholder || ''} title={field.title} value={field.value || ''} readOnly={field.readOnly} pattern={field.pattern} onChange={field.onChange} />
						break

						default:
							//console.log('default', field.type)
						break

					}
				})()
			}

			{
				!field.group && field.help
				? (<div className="help-rollover display-inline-block"><i className="icon-help-circled"></i><span dangerouslySetInnerHTML={{__html: field.help}}></span></div>)
				: false
			}

			{
				!field.group && field.description
				? (<div><small className="field-description" dangerouslySetInnerHTML={{__html: field.description}}></small></div>)
				: false
			}

		</div>)


	}

}
