import React, {Component} from 'react';
import {inject, observer} from 'mobx-react';


function getImages(node, dataStore, overwrites) {

	if (node == null) {
		return ''
	}

	if (node === 'add') {
		node = { type: 'add' }
	}

	if (node === 'infinite') {
		node = { type: 'infinite' }
	}

	if (typeof node !== 'object') {
		node = dataStore.nodes[node] || {};
	}

	if (overwrites) {
		node = $.extend(true, {}, node, overwrites)
		if (overwrites.paused === true && node.status === 'running') {
			node.status = 'paused'
		} else if (overwrites.paused === false && node.status === 'paused') {
			node.status = 'running'
		}
	}

	switch(node.type) {

		case 'add':
			return [window.leostaticcdn + 'images/icons/addNode.png']
		break

		case 'infinite':
			return [window.leostaticcdn + 'images/icons/infinite.png']
		break

		case 'system':
		case 'queue':
			var icon = (node.icon || (node.type + (node.archived ? '-archived' : '') + '.png'))
			return [(!icon.match(/^https?:/) ? window.leostaticcdn + 'images/' + (icon.indexOf('/') !== -1 ? '' : 'nodes/') : '') + icon]
		break

		case 'icon':
			return [node.icon]
		break;

		default:
		case 'bot':

			var templateIcon = false
			switch(node.templateId) {
				case 'Leo_core_aip_request':
				case 'Leo_core_api_request':
				case 'Leo_core_checksum_core':
				case 'Leo_core_cron_template':
				case 'Leo_core_dw_mapper':
				case 'Leo_core_custom_lambda_bot':
				case 'Leo_core_es_mapper':
				case 'Leo_core_mongodb':
				case 'Leo_core_text_handler':
				case 'Leo_core_webhook_handler':
				case 'Leo_core_function_queue':
				case 'Leo_core_queue_function':
					//var templateIcon = window.leostaticcdn + 'images/templates/' + (window.templates[node.templateId].icon.replace(/^templates\//, ''))
				break

				case 'Leo_core_queue_mapper':
				case 'Leo_core_queue_mapper-async':
				default:
					//var templateIcon = window.leostaticcdn + 'images/templates/empty.png'
				break
			}

			var mainIcon = (node.icon || ((node.type || 'bot') + (!node.status || node.status === 'running' ? '' : '-' + node.status) + (node.paused && (node.status !== 'paused') ? '-paused' : '') + '.png').replace('-archived-paused', '-archived'))
			mainIcon = ((!mainIcon.match(/^https?:/) ? window.leostaticcdn + 'images/' + (mainIcon.indexOf('/') !== -1 ? '' : 'nodes/') : '') + mainIcon)

			return [
				mainIcon,
				(
					node.paused
					? false //window.leostaticcdn + 'images/templates/paused.png'
					: false
				),
				(
					templateIcon || false
				)
			]
		break
	}

}


export function NodeImages(node, dataStore, overwrites) {

	let images = getImages(node, dataStore, overwrites);

	return `<image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${images[0]}" width="100%" height="100%"></image>`
	+ (
		images[1]
		? `<image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${images[1]}" width="33%" height="33%"></image>`
		: ''
	)
	+ (
		images[2]
		? `<image xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="${images[2]}" x="66%" y="66%" width="33%" height="33%"></image>`
		: ''
	)
}

@inject('dataStore')
@observer
export default class nodeIcon extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;

		this.state = {}
	}


	render() {
		let images = getImages(this.props.node, this.dataStore);

		return (<svg className={this.props.className} width={this.props.width || this.props.size} height={this.props.height || this.props.size}>
			<image xmlnsXlink="http://www.w3.org/1999/xlink" xlinkHref={images[0]} width="100%" height="100%"></image>
			{
				images[1]
				? <image xmlnsXlink="http://www.w3.org/1999/xlink" xlinkHref={images[1]} width="33%" height="33%"></image>
				: false
			}
			{/*{*/}
				{/*images[2]*/}
				{/*? <image xmlnsXlink="http://www.w3.org/1999/xlink" xlinkHref={images[2]} x="66%" y="66%" width="33%" height="33%"></image>*/}
				{/*: false*/}
			{/*}*/}
		</svg>)

	}

}
