import React from 'react';
import {observer, inject} from 'mobx-react';

@inject('dataStore')
@observer
export default class TagsInput extends React.Component {
	constructor(props) {
		super(props);
        this.dataStore = this.props.dataStore;

        this.state = {
			tags: (props.value || props.defaultValue || '').toString().split(','),
			tag: ''
		}
	}

    componentWillReceiveProps(nextProps){
		let bool = (nextProps.alerts) || false;
		if (bool) {
			let obj = nextProps.tags && nextProps.tags.tags || {};
			let tags = [];
			Object.keys(obj).map((tag) => {
				if (obj[tag].indexOf(nextProps.arn) > -1) {
					tags.push(tag);
				}
			});
            this.setState({
                tags: tags
            });
		}
    }

	onClick(event) {
		$(event.currentTarget).find('input[type="text"]').focus()
	}


	addTag(tag) {
        let bool = (this.props.alerts) || false;
        if (bool) {
            let tags = this.state.tags
            tags = tags.concat(tag.split(',').filter(t => t.trim()))
            let body = Object.assign({}, {"delete": false, "addedTag": tag}, this.props.tags);
            $.post(`api/sns_save/tags/${this.props.arn}`, JSON.stringify(body), (response) => {
                if (this.dataStore.topicInfo && this.dataStore.topicInfo.tags) {
                    this.dataStore.topicInfo.tags.tags = response;
                }
                this.setState({ tags: tags, tag: '' })
            }).fail((result) => {
                window.messageLogModal('Unable to update tags', 'error', result)
            });
        } else {
            if (tag !== '') {
                var tags = this.state.tags;
                tags = tags.concat(tag.split(',').filter(t => t.trim()));
                this.setState({ tags: tags, tag: '' })
            }
        }
	}


	onChange(event) {
		var tag = event.currentTarget.value
		if (tag.indexOf(',') !== -1) {
			this.addTag(tag)
		} else {
			this.setState({ tag: tag }, () => {
				this.props.onChange && this.props.onChange()
			})
		}
	}


	onKeyDown(event) {
		if (event.keyCode === 13) {
			this.addTag(event.currentTarget.value)
		}
	}


	onBlur(event) {
		this.addTag(event.currentTarget.value)
	}


    removeTag(index, event) {
        let bool = (this.props.alerts) || false;
        if (bool) {
            let tags = this.state.tags;
            tags.splice(index, 1);
            let body = Object.assign({"delete": true, "tagsToKeep": tags}, this.props.tags);
            $.post(`api/sns_save/tags/${this.props.arn}`, JSON.stringify(body), (response) => {
            	if (this.dataStore.topicInfo && this.dataStore.topicInfo.tags) {
                    this.dataStore.topicInfo.tags.tags = response;
                }
                this.setState({ tags: tags })
            }).fail((result) => {
                window.messageLogModal('Unable to update tags', 'error', result)
            });
        } else {
            let inputTag = $(event.currentTarget).closest('div').next();
            let tags = this.state.tags;
            tags.splice(index, 1)
            this.setState({ tags: tags }, () => {
                inputTag.focus()
                this.props.onChange && this.props.onChange()
            })
        }
    }


	render() {

		var props = this.props

		return (<div className="theme-tags" title={props.title} onClick={this.onClick.bind(this)}>
			<input type="hidden" name={this.props.name} value={this.state.tags.join(',') || ''} readOnly="true" />
			<div className="flex-row">
				<div>
				{
					this.state.tags
					? this.state.tags.map((tag, index) => {
						return (tag !== ''
							? (<span key={index}>
								{tag}
								<i className="icon-cancel" onClick={this.removeTag.bind(this, index)} />
							</span>)
							: false
						)
					})
					: false
				}
				</div>
				{
					!props.readOnly
					? <input type="text" placeholder={props.placeholder || 'type new tag'} value={this.state.tag || ''} onChange={this.onChange.bind(this)} onKeyDown={this.onKeyDown.bind(this)} onBlur={this.onBlur.bind(this)} />
					: false
				}
			</div>
		</div>)
	}
}