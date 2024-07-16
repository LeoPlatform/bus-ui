import React, { Component } from 'react'
import { connect } from 'react-redux'
import { saveSettings } from '../../actions'
import { observer, inject } from 'mobx-react'

import Trunk from '../elements/trunk.jsx'
import { NodeImages } from '../elements/nodeIcon.jsx'
import NoSource, { noSourceMessage } from '../elements/noSource.jsx'
import _ from 'lodash';


var scales = [.25, .375, .5, .625, .75, .875, 1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0],
	ICON_SIZE = 30, //40
	TEXT_V_PADDING = 2, //6
	TEXT_H_PADDING = 6, //6
	MAX_DURATION = 750,
	NODE_SPREAD = 125


d3.selection.prototype.tspans2 = function(lines, lh) {
	return this.selectAll('tspan')
		.data(lines)
		.enter()
		.append('tspan')
		.text(function(d) {
			return (typeof d == 'object' && !d.length) ? '' : d
		})
		.attr('x', 0)
		.attr('dy', function(d, i) { return i ? lh || 15 : 0; })
		.filter(function(d) {
			return (typeof d == 'object' && !d.length)
		})
		.html(function(d) {
			return Object.keys(d).map((k) => {
				return '<tspan fill="' + ((['errors', 'error', 'red'].indexOf(k) != -1) ? 'red' : '') + '">' + d[k] + '</tspan>'
			}).join('')
		})
}


d3.wordwrap = function(line, maxCharactersPerLine, maxLines = 2) {
	var parts = line.split(/([^a-z][a-z]*)/), //split at non-words
		lines = [],
		words = [],
		maxChars = maxCharactersPerLine || 40

	parts.forEach(function(part) {
		if (part) {
			if (words.length > 0 && (words.join('').length + part.length) > maxChars) {
				lines.push(words.join(''))
				words = []
			}
			//if it's too long, chop it
			while (part.length > maxChars) {
				lines.push(part.slice(0, maxChars - 1) + '-')
				part = part.slice(maxChars - 1)
			}
			words.push(part)
		}
	})

	if (words.length) {
		lines.push(words.join(''))
	}

	if (lines.length > maxLines) {
		lines = lines.slice(0, maxLines)
		lines[1] += '...'
	}

	return lines
}


d3.selection.prototype.moveToFront = function() {
	return this.each(function() {
		this.parentNode && this.parentNode.appendChild(this)
	})
}

@inject('dataStore')
@observer
class Tree extends React.Component {

	nodeTree = {

		zoom: 1,
		scale: 6,
		duration: 0,
		isHidden: false,
		dragStart: false,
		offsetDistance: [0, 0],

		node_index: 0,
		root: null,
		width: null,
		height: null,
		center: null,
		middle: null,

		hovering: [],

		scaling: false,

		hoveringTimeouts: [],

		getBB: function(selection) {
			selection.each(function(d) {
				d.bbox = this.getBBox();
				if (d.bbox.width == 0 && d.bbox.height == 0) {
					d.bbox = {
						x: -16,
						y: -8,
						width: 34,
						height: 16
					}
				}
			})
		},

		left: {},
		right: {},
		hoverBoard: undefined,

		clickedSide: '',

		selected: null,
		toggle_stats: {},

		init: (selector) => {

			var me = this.nodeTree
			var thisComponent = this

			me.treeWrapper = $(selector)

			me.width = Math.floor(me.treeWrapper.width()) //1423, //
			me.height = Math.floor(me.treeWrapper.height()) //964, //

			me.center = Math.floor(me.width / 2)
			me.middle = Math.floor(me.height / 2)

			me.scale = scales.indexOf(me.zoom)

			me.svg = d3.select(selector + ' svg').attr("width", me.width).attr("height", me.height)

			_.map(window.dataStore.systems, (system) => {
				if (Object.keys(window.dataStore.nodes[system].link_to.parent).length > 1 && window.dataStore.urlObj.collapsed.left.indexOf(system) === -1) {
					window.dataStore.urlObj.collapsed.right.push(system);
				}
				if (Object.keys(window.dataStore.nodes[system].link_to.children).length > 1 && window.dataStore.urlObj.collapsed.left.indexOf(system) === -1) {
					window.dataStore.urlObj.collapsed.left.push(system);
				}
			});

			me.left = {
				name: 'left',
				flip: -1,
				diagonal: d3.svg.diagonal().projection(function(d) {
					return [(me.left.flip * d.y), d.x];
				}),
				tree: d3.layout.tree().children(function(d) {
					if (window.dataStore.urlObj.collapsed.left.indexOf(d.id) === -1 && d.leftCollapsed) {
						window.collapsedStart.push(d.id);
					}
					if (window.dataStore.urlObj.expanded.left.indexOf(d.id) !== -1) {
						return d.parents;
					}
					if (window.dataStore.urlObj.collapsed.left.indexOf(d.id) === -1 && d.leftCollapsed && !window.keepTrackLeft[d.id]) {
						window.dataStore.urlObj.collapsed.left.push(d.id);
						window.keepTrackLeft[d.id] = true;
					}
					if (window.dataStore.urlObj.collapsed.left.indexOf(d.id) !== -1 || !d.parents || d.parents.length === 0) {
						return null
					}
					return d.parents;
				}),
				g: d3.select(selector + ' .left-side')
			}

			me.right = {
				name: 'right',
				flip: 1,
				diagonal: d3.svg.diagonal().projection(function(d) {
					return [(me.right.flip * d.y), d.x];
				}),
				tree: d3.layout.tree().children(function(d) {
					if (window.dataStore.urlObj.collapsed.right.indexOf(d.id) === -1 && d.rightCollapsed) {
						window.collapsedStart.push(d.id);
					}
					if (window.dataStore.urlObj.expanded.right.indexOf(d.id) !== -1) {
						return d.kids;
					}
					if (window.dataStore.urlObj.collapsed.right.indexOf(d.id) === -1 && d.rightCollapsed && !window.keepTrackRight[d.id]) {
						window.dataStore.urlObj.collapsed.right.push(d.id);
						window.keepTrackRight[d.id] = true;
					}
					if (window.dataStore.urlObj.collapsed.right.indexOf(d.id) !== -1 || !d.kids || d.kids.length === 0) {
						return null
					}
					return d.kids;
				}),
				g: d3.select(selector + ' .right-side')
			}

			me.hoverBoard = d3.select('.hoverBoard')

			d3.select(self.frameElement).style('height', me.height);

			me.scaling = false

			if (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
				$('body').addClass('touch-device')
			}

			var wheelTimeout = undefined

			me.treeWrapper.bind('wheel', (event) => {
				if ($('.theme-autocomplete ul').length > 0) {
					return
				}

				if (!wheelTimeout) {
					wheelTimeout = setTimeout(() => {
						wheelTimeout = undefined
						if (event.originalEvent.deltaY < 0) {
							this.zoomIn({
								x: event.originalEvent.clientX,
								y: event.originalEvent.clientY
							})
						} else {
							this.zoomOut({
								x: event.originalEvent.clientX,
								y: event.originalEvent.clientY
							})
						}
					}, 5)
				}

			})

			me.pinch = (event) => {
				if (event.touches.length < 2 || me.pinching) {
					return
				}
				me.pinching = true
				var distance = (event.touches[0].clientX - event.touches[1].clientX) * (event.touches[0].clientX - event.touches[1].clientX) + (event.touches[0].clientY - event.touches[1].clientY) * (event.touches[0].clientY - event.touches[1].clientY)

				if (me.scaling) {
					if (me.scaling > distance) {
						this.zoomOut({
							x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
							y: (event.touches[0].clientY + event.touches[1].clientY) / 2
						})
					} else if (me.scaling < distance) {
						this.zoomIn({
							x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
							y: (event.touches[0].clientY + event.touches[1].clientY) / 2
						})
					}
					//me.scaling = distance
				} else {
					me.scaling = distance
				}

				me.pinching = false
			}

			me.treeWrapper.bind('mousedown touchstart', function(event) {
				if (event.button == 0 || event.type == 'touchstart') {
					event = event.originalEvent || event
					if (event.touches) {
						if (event.touches.length > 1) {
							me.pinch(event)
							return
						}
						event = event.touches[0]
					}
					me.dragStart = [event.pageX, event.pageY]
				}
			})

			me.treeWrapper.bind('mousemove touchmove', function(event) {
				event = event.originalEvent || event
				if (event.touches && event.touches.length > 1) {
					//if (me.scaling) {
					me.pinch(event)
				} else if (me.dragStart) {
					event = event.touches ? event.touches[0] : event
					me.offsetDistance = [
						event.pageX - me.dragStart[0] + me.offsetDistance[0],
						event.pageY - me.dragStart[1] + me.offsetDistance[1],
					]
					me.left.g.attr('transform', 'translate(' + (me.center + me.offsetDistance[0]) + ', ' + (me.middle + me.offsetDistance[1]) + ') scale(' + me.zoom + ')')
					me.right.g.attr('transform', 'translate(' + (me.center + me.offsetDistance[0]) + ', ' + (me.middle + me.offsetDistance[1]) + ') scale(' + me.zoom + ')')
					me.hoverBoard.attr('transform', 'translate(' + (me.center + me.offsetDistance[0]) + ', ' + (me.middle + me.offsetDistance[1]) + ') scale(' + me.zoom + ')')
					me.dragStart = [
						event.pageX,
						event.pageY
					]
				}
			})

			me.treeWrapper.bind('mouseup mouseleave touchend', function() {
				me.scaling = false
				me.dragStart = false

				thisComponent.props.saveSetting && thisComponent.props.dispatch(saveSettings({
					offset: me.offsetDistance
				}, true))

				me.updateDiagram(me.root, true)
			})
		},


		windowResized: () => {
			this.nodeTree.updateDiagram(this.nodeTree.root, true)
		},


		visibilityChange: () => {
			if (!document.hidden && this.nodeTree.isHidden) {
				this.nodeTree.isHidden = false
				this.nodeTree.updateDiagram(this.nodeTree.root, true)
			}
		},


		updateDiagram: (new_root, force) => {

			var me = this.nodeTree
			var thisComponent = this

			if (document.hidden) {
				me.isHidden = true
				//console.log('hidden')
				return
			}

			me.duration = (force && (me.lastRoot == me.root)) ? 0 : MAX_DURATION

			if (me.root !== new_root || force) {
				if (me.lastRoot && me.lastRoot != new_root) {
					me.duration = MAX_DURATION
					this.hideHover()
				}

				me.root = new_root
				me.selected = this.props.settings.selected || []

				me.update(me.left)
				me.update(me.right)

				me.svg.attr('width', me.width).attr('height', me.height)

				me.left.g
					.transition().duration(me.duration)
					.attr('transform', 'translate(' + (me.center + me.offsetDistance[0]) + ', ' + (me.middle + me.offsetDistance[1]) + ') scale(' + me.zoom + ')')
				me.right.g
					.transition().duration(me.duration)
					.attr('transform', 'translate(' + (me.center + me.offsetDistance[0]) + ', ' + (me.middle + me.offsetDistance[1]) + ') scale(' + me.zoom + ')')
				me.hoverBoard
					.transition().duration(me.duration)
					.attr('transform', 'translate(' + (me.center + me.offsetDistance[0]) + ', ' + (me.middle + me.offsetDistance[1]) + ') scale(' + me.zoom + ')')

				setTimeout(() => {
					me.lastRoot = me.root
				}, 1000)

			}

		},


		update: (which) => {
			let side;
			if (which.name === 'left') {
				side = window.dataStore.urlObj.collapsed.left;
			} else {
				side = window.dataStore.urlObj.collapsed.right;
			}

			var thisComponent = this
				, me = this.nodeTree
				, source = JSON.parse(JSON.stringify(this.props.source)) //getData(me.root);

			me.width = Math.floor(me.treeWrapper.width())
			me.height = Math.floor(me.treeWrapper.height())

			$('.no-data-message').hide()

			var [noDataMessage, noDataIcon] = noSourceMessage({ userSettings: { view: 'node' }, root: me.root, hasData: true }, this.dataStore)

			if (noDataMessage) {
				source = {}
				$('.no-data-message').show()
			}

			var parentLevels = 1
			var parentCount = function(level, n) {
				if (window.dataStore.urlObj.collapsed.left.indexOf(n.id) === -1) {
					if (n.parents && n.parents.length > 0) {
						parentLevels += (n.parents.length - 1)
						n.parents.forEach(function(d) {
							parentCount(level + 1, d)
						})
					}
				}
			}
			parentCount(0, source);

			var levelHeight = 1;
			var childCount = function(level, n) {
				if (window.dataStore.urlObj.collapsed.right.indexOf(n.id) === -1) {
					if (n.kids && n.kids.length > 0) {
						levelHeight += (n.kids.length - 1);
						n.kids.forEach(function(d) {
							childCount(level + 1, d)
						})
					}
				}
			};
			childCount(0, source)

			levelHeight = Math.max(levelHeight, parentLevels)

			me.middle = -((me.zoom - 1) * me.height / 2) - ICON_SIZE

			if ((levelHeight * NODE_SPREAD) > me.height) {
				me.middle += (me.height * me.zoom - (levelHeight * NODE_SPREAD) * me.zoom) / 2
			}

			me.height = Math.max(me.height, (levelHeight * NODE_SPREAD))

			which.tree.size([me.height, me.width])

			source.x0 = me.height / 2
			source.y0 = 0
			source.is_root = true

			var hasParents = !!(source.parents && source.parents.length > 0)
			var hasKids = !!(source.kids && source.kids.length > 0)

			if (!hasKids && hasParents) {
				me.center = me.width - (ICON_SIZE * 3)
			} else if (!hasParents && hasKids) {
				me.center = ICON_SIZE * 3
			} else {
				me.center = me.width / 2
			}

			var nodes = which.tree.nodes(source), //.reverse(),
				links = which.tree.links(nodes),
				flip = which.flip,
				offset = 0

			nodes.forEach(function(d, i) {
				if (d.depth === 0) {
					offset = (me.height / 2 - d.x)
					d.x = me.height / 2
				} else {
					d.x += offset
				}
				// Normalize for fixed-depth.
				d.y = d.depth * 250 //BRANCH_WIDTH
			})

			var middle = me.middle + me.offsetDistance[1]

			nodes = nodes.filter((d) => {

				//vertical lazy load
				if (
					((d.x * me.zoom + middle) < 0 && ((d.parent || {}).x * me.zoom + middle) < 0)
					|| ((d.x * me.zoom + middle) > me.height && ((d.parent || {}).x * me.zoom + middle) > me.height)
				) {
					return false
				}

				//lazy load
				return (
					(flip === -1 && (me.center + me.offsetDistance[0] - d.y * me.zoom + NODE_SPREAD * 2 * me.zoom) > 0) //left side
					|| (flip === 1 && (me.center + me.offsetDistance[0] + d.y * me.zoom - NODE_SPREAD * 2 * me.zoom) < me.width) //right side
				)
			})

			// Update the nodes…
			var node = which.g.selectAll('g.node')
				.data(nodes, function(d) {
					return d.node_index || (d.node_index = ++me.node_index);
				})

			// Enter any new nodes at the parent's previous position.
			var nodeEnter = node.enter().append('g')
				.filter(function(d) {
					return d.icon //no icon, no node
				})
				.attr('class', function(d) {
					let collapsedSide = window.dataStore.urlObj.collapsed.right.indexOf(d.id);
					if (window.dataStore.urlObj.expanded.right.indexOf(d.id) !== -1) {
						collapsedSide = false;
					}
					if (which.name === 'left') {
						collapsedSide = window.dataStore.urlObj.collapsed.left.indexOf(d.id);
						if (window.dataStore.urlObj.expanded.left.indexOf(d.id) !== -1) {
							collapsedSide = false;
						}
					}
					return 'node' + (d.is_root ? ' center' : '') + (me.selected.join('-') === d.id ? ' active' : '') + (collapsedSide ? ' collapsed' : '') + (d.status === "paused" ? ' paused' : '')
				})
				.attr('data-id', function(d) { return d.id })
				.attr('data-icon', function(d) { return d.type })
				.attr('transform', function(d) { return 'translate(' + 0 + ',' + me.height / 2 + ')'; })
				.on('click', function(data) {
					if (data.id !== 'add' && data.id !== 'infinite') {
						me.selected = [data.id]
						thisComponent.props.onNodeClick && thisComponent.props.onNodeClick(data)
					}
				})
				.on('dblclick', function(data) {
					if (data.id !== 'add' && data.id !== 'infinite') {
						thisComponent.props.onNodeDblClick && thisComponent.props.onNodeDblClick(data, which, me)
					}
					setTimeout(thisComponent.hideHover.bind(thisComponent), 250)
				})

			var nodeEnterCollapsed = nodeEnter.filter(function(d) {
				let show = side.indexOf(d.id) !== -1;
				if (which.name === 'right' && window.dataStore.urlObj.expanded.right.indexOf(d.id) !== -1) {
					show = false;
				}
				if (which.name === 'left' && window.dataStore.urlObj.expanded.left.indexOf(d.id) !== -1) {
					show = false;
				}
				return show
			})

			nodeEnterCollapsed.append('circle').attr('data-shape', 'circle').attr('r', 1e-6).style({ opacity: .5, transform: 'translate(-5px, -12px)' }).attr('class', 'stroked')
			nodeEnterCollapsed.append('circle').attr('data-shape', 'circle').attr('r', 1e-6).style({ opacity: .5, transform: 'translate(7px, -8px)' }).attr('class', 'stroked')

			var shapes = {

				circle: [
					'M 0,0 m -1e-6,0 a 1e-6,1e-6 0 1,0 1e-6,0 a 1e-6,1e-6 0 1,0 -1e-6,0',
					'M 0,0 m -21,0 a 21,21 0 1,0 42,0 a 21,21 0 1,0 -42,0',
					'M 0,0 m -30,0 a 30,30 0 1,0 60,0 a 30,30 0 1,0 -60,0'
				],

				delta: [
					'M 2.8,0.1 C 2.8,0.1 6.2,0.1 6.2,0.1 7.14,0.1 7.88,0.39 7.79,1.5 7.74,2.05 7.27,2.73 6.98,3.2 6.98,3.2 5.02,6.39 5.02,6.39 4.7,6.79 4.31,6.94 3.8,6.89 2.97,6.81 2.64,6.03 2.26,5.4 2.26,5.4 0.88,3.1 0.88,3.1 0.69,2.79 0.26,2.11 0.17,1.8 -0.05,1.08 0.26,0.51 0.9,0.17 1.44,0.04 2.23,0.1 2.8,0.1 Z',

					'M -6.32,-19.44 C -6.32,-19.44 12.72,-19.44 12.72,-19.44 17.98,-19.43 22.14,-17.8 21.62,-11.6 21.36,-8.54 18.7,-4.73 17.09,-2.08 17.09,-2.08 6.12,15.78 6.12,15.78 4.33,18.01 2.11,18.84 -0.72,18.58 -5.37,18.15 -7.22,13.77 -9.34,10.24 -9.34,10.24 -17.07,-2.64 -17.07,-2.64 -18.11,-4.38 -20.56,-8.18 -21.08,-9.92 -22.28,-13.94 -20.53,-17.14 -16.96,-19.03 -13.93,-19.76 -9.53,-19.44 -6.32,-19.44 Z',

					'M -9.1,-26.7 C -9.1,-26.7 18.1,-26.7 18.1,-26.7 25.61,-26.68 31.56,-24.36 30.81,-15.5 30.44,-11.12 26.64,-5.69 24.34,-1.9 24.34,-1.9 8.68,23.62 8.68,23.62 6.11,26.8 2.94,27.99 -1.1,27.61 -7.75,27 -10.39,20.75 -13.42,15.7 -13.42,15.7 -24.46,-2.7 -24.46,-2.7 -25.95,-5.19 -29.44,-10.62 -30.18,-13.1 -31.9,-18.84 -29.4,-23.41 -24.3,-26.11 -19.97,-27.16 -13.69,-26.7 -9.1,-26.7 Z'
				],

				hexagon: [
					'M 0,-1 -1,-1 -1,0 0,1 0,1 1,0 z',
					'M 11.25,-20.25 -12.37,-20.25 -23.62,0 -11.25,20.25 11.25,20.25 23.63,0 z',
					'M 15,-26 -15,-26 -30,0 -15,26 15,26 30,0 z'
				],

				octogon: [
					'M 0,-1 0,-1 -1,0 -1,0 0,1 0,1 1,0 1,0 z',
					'M 8,-19 -8,-19 -19,-8 -19,8 -8,19 8,19 19,8 19,-8 z',
					'M 11,-28 -11,-28 -28,-11 -28,11 -11,28 11,28 28,11 28,-11 z'
				],
			}

			nodeEnter.append('path')
				.attr('data-shape', function(d) {
					d.shape = { danger: 'delta', blocked: 'octogon', rogue: 'octogon' }[d.status || (window.nodes[d.id] || {}).status] || 'circle'
					return d.shape
				}).attr('d', function(d) {
					return shapes[$(this).attr('data-shape')][0]
				}).attr('class', function(d) {
					return ((d.type == 'bot' || d.type == 'event' || d.type == 'queue') ? 'stroked' : 'empty') + (d.status === 'danger' ? ' stroked-danger' : '') + (d.is_root ? ' root-node' : '');
				})

			var nodeText = nodeEnter.append("text")
				.attr("transform", function(d) {
					return 'translate(0,' + (d.is_root ? ICON_SIZE * 1.5 : ICON_SIZE * 1.125) + ')';
				})
				.attr('width', ICON_SIZE)
				.style({
					'text-anchor': 'middle',
					opacity: 1e-6
				})

			nodeText.tspans2(function(d) {
				return d3.wordwrap((d.label || '').toString().replace(/_/ig, ' '), 20) //12
			})

			nodeText.call(me.getBB)

			var nodeQueue = nodeEnter.filter(function(d) {
				return (d.type == 'event' || d.type == 'queue')
			})
			var nodeBot = nodeEnter.filter(function(d) {
				return (d.type == 'bot' || d.type == 'system')
			})

			nodeQueue.append('text')
				.attr("class", 'stat')
				.attr("transform", function(d) {
					return "translate(" + 0 + "," + ((d.is_root ? ICON_SIZE * 1.5 : ICON_SIZE * 1.125) + d.bbox.height + 0) + ")";
				})
				.text(function(d) {
					return d.below || []
				})
				.style("opacity", 1e-6)

			var countText = nodeBot.append('text')
				.attr("class", 'stat')
				.attr("transform", function(d) {
					return "translate(" + 0 + "," + ((d.is_root ? ICON_SIZE * 1.5 : ICON_SIZE * 1.125) + d.bbox.height + 0) + ")";
				})
				.style("opacity", 1e-6)

			countText.tspans2(function(d) {
				return d.below || []
			})

			nodeEnter.append('svg').filter(function(d) { return d.icon })
				.html(node => NodeImages(node.id, this.dataStore, node.iconOverrides))
				.attr('x', function(d) {
					return (d.is_root ? -ICON_SIZE * 2 : -ICON_SIZE * 1.5) / 2
				})
				.attr('y', function(d) {
					return (d.is_root ? -ICON_SIZE * 2 : -ICON_SIZE * 1.5) / 2
				})
				.attr('width', function(d) {
					return (d.is_root) ? ICON_SIZE * 2 : ICON_SIZE * 1.5
				})
				.attr('height', function(d) {
					return (d.is_root) ? ICON_SIZE * 2 : ICON_SIZE * 1.5
				})
				.on('mouseenter', function(d) {
				})
				.on('click', function(d) {
					if (d.id === 'add') {
						$('.hoverBoard').toggle()
					}
				})

			var rotatorG = nodeEnter.filter(function(d) { return d.type !== 'add' && d.type !== 'infinite' }).append('g')
				.attr('class', 'rotator-g')
				.on('mouseenter', function(d) {

					var clientX = d3.event.clientX
						, clientY = d3.event.clientY

					me.mouseEnterTimeout = setTimeout(() => {
						clearTimeout(me.mouseEnterTimeout)
						clearTimeout(me.hoveringTimeouts[d.id])

						if (d.details) {
							var isMobile = (window.innerWidth < 800)
								, lineHeight = (isMobile ? 20 : 30)
								, mx = (isMobile ? 400 : 0)
								, my = (isMobile ? -100 : 0)
								, y = 0
								, side = (isMobile ? 'top' : ((window.innerWidth - clientX) < 500) ? 'left' : 'right')
								, x = (isMobile || (window.innerWidth - clientX) < 500) ? -530 : 80
								, dx = (isMobile ? 105 : 140)
								, g = me.hoverBoard.html('').append('g').attr({ transform: 'translate(' + (mx + flip * d.y) + ',' + (my + d.x) + ')', 'class': side + ' node-details' })
								, background = g.append('rect').attr({ 'class': 'background', x: x, y: -30 })
								, arrow = g.append('rect').attr({ 'class': 'arrow ' + side })
								, text = g.append('text').attr({ y: -25 })
							Object.keys(d.details).forEach((detail) => {
								if (y < 400) {
									var row = text.append('tspan').attr({ dy: y })
									row.append('tspan').attr({ 'class': 'label', x: x, dx: dx, dy: lineHeight }).text(detail.replace(/_/g, ' ').capitalize())
									var detailText = d.details[detail] || ['']
									if (typeof detailText === 'string') {
										detailText = detailText.split(/[\r\n]/)
									} else if (detailText.constructor !== Array) {
										detailText = [detailText]
									}
									detailText.forEach((text, index) => {
										if (typeof text === 'string') {
											text = text.slice(0, 40) + (text.length > 40 ? '...' : '')
										}
										if (y < 400) {
											row.append('tspan').attr({ 'class': 'span', x: x, dx: (dx + 10), dy: (!index ? 0 : lineHeight) }).text(text)
											y += lineHeight
										}
									})
								}
							})
							background.attr({ height: (y + lineHeight) })
							if (isMobile || (window.innerHeight - clientY) < 500) {
								background.attr('y', - y)
								text.attr('y', - y)
							}
							$('.hoverBoard').show()
						}

						$('.rotator-g').removeClass('hover rollover-below')
						$(this).addClass('hover ' + (clientY < 500 ? 'rollover-below' : ''))
					}, 300)
				})
				.on('mouseleave', (d) => {
					clearTimeout(me.mouseEnterTimeout)
					this.hideHover()
					me.hoveringTimeouts[d.id] = setTimeout(() => {
						$(this).removeClass('hover rollover-below')
					}, 400)
				})

			rotatorG.append('circle')
				.attr('class', 'hover-circle')

			var rotators = thisComponent.rotators || []

			rotators.forEach((r, index) => {

				rotatorG.append('g')
					.attr('class', 'div')
					.append('g')
					.attr('class', 'i')
					.each(function(data) {
						var bubble = d3.select(this)

						var input = (data.parent ? data.parent.payload : undefined)
						var output = (data.children && data.children[0] ? data.children[0].payload : undefined)

						data.has_parents = (data.parents ? data.parents.length : 0)
						data.has_kids = (data.kids ? data.kids.length : 0)
						data.input = (which.name == 'left' ? output : input)
						data.output = (which.name == 'left' ? input : output)

						var rotator
						if (rotators[index] && (rotator = rotators[index](data, which, me))) {
							bubble.append('circle')
							bubble.append('text').html(
								{
									'icon-target': '&#xE80E;',
									'icon-cog': '&#xE828;',
									'icon-left-open': '&#xE822;',
									'icon-right-open': '&#xE823;',
									'icon-plus': '&#xE800;',
									'icon-exclamation': '&#xF12A;'
								}[Object.keys(rotator)[0]]
							)
							bubble.on('click', rotator[Object.keys(rotator)[0]])
						}
					})

			})

			rotatorG.append('g')
				.attr('class', 'div')
				.append('g')
				.attr('class', 'i')
				.append('circle')


			//payload rollover
			var foreignObject = rotatorG.filter(function(d) {
				return d.payload
			}).append('foreignObject')
				.attr('x', function(d) { return (d.is_root ? -ICON_SIZE * 1.5 : -ICON_SIZE) })
				.attr('y', function(d) { return (d.is_root ? -ICON_SIZE * 1.5 : -ICON_SIZE) })
				.attr('width', function(d) { return (d.is_root ? ICON_SIZE * 3 : ICON_SIZE * 2) })
				.attr('height', function(d) { return (d.is_root ? ICON_SIZE * 3 : ICON_SIZE * 2) })

				.append('xhtml:div')
				.attr('class', function(d) {
					return 'rollover-info rollover-' + (d.is_root ? 'is-root' : 'not-root')
				})
				.append('div')
				.text('payload')
				.append('pre')
				.text(function(d) {
					return JSON.stringify(d.payload, null, 4)
				})

			// Transition nodes to their new position.
			var nodeUpdate = node
				.transition()
				.delay(me.duration / 2)
				.duration(me.duration)
				.attr("transform", function(d) {

					if (d.is_root) {
						me.rootX = flip * d.y
						me.rootY = d.x
					}

					return "translate(" + (flip * d.y) + "," + d.x + ")";
				})
				.attr("class", function(d) {
					let collapsedSide = window.dataStore.urlObj.collapsed.right.indexOf(d.id);
					if (window.dataStore.urlObj.expanded.right.indexOf(d.id) !== -1) {
						collapsedSide = false;
					}
					if (which.name === 'left') {
						collapsedSide = window.dataStore.urlObj.collapsed.left.indexOf(d.id);
						if (window.dataStore.urlObj.expanded.left.indexOf(d.id) !== -1) {
							collapsedSide = false;
						}
					}
					return 'node' + (d.is_root ? ' center' : '') + (me.selected.join('-') == d.id ? ' active' : '') + (collapsedSide ? ' collapsed' : '') + (d.status == "paused" ? ' paused' : '')
				})

			nodeUpdate.selectAll('circle')
				.attr('r', function(d) {
					return (d.is_root) ? ICON_SIZE : ICON_SIZE * .7
				})

			for (var shape in shapes) {
				nodeUpdate.selectAll('path[data-shape="' + shape + '"]')
					.attr('d', function(d) {
						return shapes[shape][d.is_root ? 2 : 1]
					})
			}

			nodeUpdate.select('text')
				.attr("transform", function(d) {
					return 'translate(0,' + (d.is_root ? ICON_SIZE * 1.5 : ICON_SIZE * 1.125) + ')';
				})

			nodeUpdate.selectAll('text, image, rect')
				.style("opacity", '');

			// Transition exiting nodes to the parent's new position.
			var nodeExit = node.exit()
				.transition().duration(function(d) {
					return (me.selected.join('-') == d.id && me.clickedSide === which.name ? me.duration : 0)
				})
				.attr("transform", function(d) {
					return "translate(" + (flip * source.y) + "," + source.x + ")";
				})
				.remove();

			///////////////////////////////// LINKS

			// Update the links…
			var link = which.g.selectAll('g.link')
				.data(links, function(d) {
					return d.target.node_index;
				});

			// Enter any new links at the parent's previous position.
			var linkEnter = link.enter().insert('g', 'g')
				.attr('data-id', function(d) {
					return d.target.id + '-' + d.source.id
				})
				.attr('class', function(d, index) {
					return 'link' + (me.selected.indexOf(d.target.id) != -1 && me.selected.indexOf(d.source.id) != -1 ? ' active' : '')
				})
				.on('mouseenter', function(d, index) {
					me.mouseEnterTimeout = setTimeout(() => {
						clearTimeout(me.mouseEnterTimeout)
						d3.selectAll('g[data-id="' + d.target.id + '-' + d.source.id + '"]').classed('hover', true).moveToFront()
					}, 300)
				})
				.on('mouseleave', function(d, index) {
					clearTimeout(me.mouseEnterTimeout)
					d3.selectAll('g[data-id="' + d.target.id + '-' + d.source.id + '"]').classed('hover', false)
				})


			linkEnter.append('path')
				.attr('data-line', 'solid')
				.attr('class', function(d) {
					return ((d.target.relation || {}).fill || 'stroked') + (d.target.relation.status === 'danger' ? ' stroked-danger' : '')
				})
				.attr('stroke-dasharray', function(d) {
					return {
						dashed: '6,6',
						dashed_gray: '6',
						dotted: '2,2',
						solid: '1,0'
					}[d.target.relation.line || 'solid']
				})
				.attr("d", function(d) {
					var o = {
						x: me.height / 2,
						y: 0
					};
					return which.diagonal({
						source: o,
						target: o
					});
				});

			// Transition links to their new position.
			var linkUpdate = link
				.transition().delay(me.duration / 2).duration(me.duration)

			linkUpdate.selectAll('path[data-line="solid"]')
				.attr("d", which.diagonal)

			link.exit().remove()

			// link text
			var linkTextEnter = link.enter().insert('g', 'g.node')
				.attr('data-id', function(d) {
					return d.target.id + '-' + d.source.id
				})
				.attr('class', function(d, index) {
					return 'link' + (me.selected.indexOf(d.target.id) != -1 && me.selected.indexOf(d.source.id) != -1 ? ' active' : '')
				})
				.on('mousedown', function(d) {
					me.selected = [d.target.id, d.source.id]
					thisComponent.props.onLinkClick && thisComponent.props.onLinkClick([d.target.id, d.source.id], d)
				})
				.on('mouseenter', function(d, index) {
					me.mouseEnterTimeout = setTimeout(() => {
						clearTimeout(me.mouseEnterTimeout)
						d3.selectAll('g[data-id="' + d.target.id + '-' + d.source.id + '"]').classed('hover', true)
						d3.select(this).moveToFront()
					}, 300)
				})
				.on('mouseleave', function(d, index) {
					clearTimeout(me.mouseEnterTimeout)
					d3.selectAll('g[data-id="' + d.target.id + '-' + d.source.id + '"]').classed('hover', false)
				})

			linkTextEnter.append('path')
				.attr('data-line', 'solid')
				.attr('class', 'unstroked')
				.attr('d', function(d) {
					var o = {
						x: me.height / 2,
						y: 0
					};
					return which.diagonal({
						source: o,
						target: o
					});
				});

			var linkRead = linkTextEnter.filter(function(d) {
				return d.target.relation && d.target.relation.type == "read";
			})

			var linkWrite = linkTextEnter.filter(function(d) {
				return d.target.relation && d.target.relation.type == "write";
			})

			var linkText = linkRead.append('text')
				.attr("class", 'stat')
				.attr("transform", function(d) {
					return "translate(" + (flip * d.source.y) + "," + d.source.x + ")";
				})
				.attr('y', '-1em')
				.style("opacity", 1e-6)

			linkText.tspans2(function(d) {
				return d.target.relation.above || []
			})
			linkText.call(me.getBB)

			linkRead.insert('rect', 'text').filter(function(d) {
				return (d.target.relation && d.target.relation.above != null && d.target.relation.above != '' && d.target.relation.above != [])
			})
				.attr('class', function(d) {
					return 'rect ' + (d.target.relation.fill || 'stroked')
				})
				.attr('rx', 6).attr('ry', 6)
				.attr("transform", function(d) {
					return "translate(" + (flip * d.source.y) + "," + d.source.x + ")";
				})
				.attr('x', function(d) { return d.bbox.x - TEXT_H_PADDING })
				.attr('y', function(d) { return d.bbox.y - TEXT_V_PADDING })
				.attr('width', function(d) { return d.bbox.width + TEXT_H_PADDING * 2 })
				.attr('height', function(d) { return d.bbox.height + TEXT_V_PADDING * 2 })
				.style("opacity", 1e-6)

			var linkText = linkWrite.append('text')
				.attr("class", 'stat')
				.attr("transform", function(d) {
					return "translate(" + (flip * d.source.y) + "," + d.source.x + ")";
				})
				.attr('y', '-1em')
				.style("opacity", 1e-6)

			linkText.tspans2(function(d) {
				return d.target.relation.above || []
			})
			linkText.call(me.getBB)

			linkWrite.insert('rect', 'text').filter(function(d) {
				return (d.target.relation && d.target.relation.above != null && d.target.relation.above != '' && d.target.relation.above != [])
			})
				.attr('class', function(d) {
					return 'rect ' + (d.target.relation.fill || 'stroked')
				})
				.attr('rx', 6).attr('ry', 6)
				.attr("transform", function(d) {
					return "translate(" + (flip * d.source.y) + "," + d.source.x + ")";
				})
				.attr('x', function(d) { return d.bbox.x - TEXT_H_PADDING })
				.attr('y', function(d) { return d.bbox.y - TEXT_V_PADDING })
				.attr('width', function(d) { return d.bbox.width + TEXT_H_PADDING * 2 })
				.attr('height', function(d) { return d.bbox.height + TEXT_V_PADDING * 2 })
				.style("opacity", 1e-6)

			if (!this.props.hideLinkBelow) {

				var lagText = linkRead.append('text')
					.attr('class', function(d) {
						return 'stat' + (d.target.relation.status === 'danger' ? ' stat-danger' : '')
					})
					.attr("transform", function(d) {
						return "translate(" + (flip * d.source.y) + "," + d.source.x + ")";
					})
					.attr('y', '1.5em')
					.style("opacity", 1e-6)

				lagText.tspans2(function(d) {
					return d.target.relation.below || []
				})
				lagText.call(me.getBB)

				linkRead.insert('rect', 'text').filter(function(d) {
					return (d.target.relation && d.target.relation.below != null && d.target.relation.below != '' && d.target.relation.below != [])
				})
					.attr('class', function(d) {
						return 'rect ' + (d.target.relation.fill || 'stroked') + (d.target.relation.status === 'danger' ? ' stroked-danger' : '')
					})
					.attr('rx', 6).attr('ry', 6)
					.attr("transform", function(d) { return "translate(" + (flip * d.source.y) + "," + d.source.x + ")" })
					.attr('x', function(d) { return d.bbox.x - TEXT_H_PADDING })
					.attr('y', function(d) { return d.bbox.y - TEXT_V_PADDING })
					.attr('width', function(d) { return d.bbox.width + TEXT_H_PADDING * 2 })
					.attr('height', function(d) { return d.bbox.height + TEXT_V_PADDING * 2 })
					.style("opacity", 1e-6)

				var lagText = linkWrite.append('text')
					.attr("class", 'stat')
					.attr("transform", function(d) {
						return "translate(" + (flip * d.source.y) + "," + d.source.x + ")";
					})
					.attr('y', '1.5em')
					.style("opacity", 1e-6)

				lagText.tspans2(function(d) {
					return d.target.relation ? d.target.relation.below : []
				})
				lagText.call(me.getBB)

				linkWrite.insert('rect', 'text').filter(function(d) {
					return (d.target.relation && d.target.relation.below != null && d.target.relation.below != '' && d.target.relation.below != [])
				})
					.attr('class', function(d) {
						return 'rect ' + (d.target.relation.fill || 'stroked')
					})
					.attr('rx', 6).attr('ry', 6)
					.attr("transform", function(d) { return "translate(" + (flip * d.source.y) + "," + d.source.x + ")" })
					.attr('x', function(d) { return d.bbox.x - TEXT_H_PADDING })
					.attr('y', function(d) { return d.bbox.y - TEXT_V_PADDING })
					.attr('width', function(d) { return d.bbox.width + TEXT_H_PADDING * 2 })
					.attr('height', function(d) { return d.bbox.height + TEXT_V_PADDING * 2 })
					.style("opacity", 1e-6)
			}

			// Transition links to their new position.
			var linkUpdate = link
				.transition().delay(me.duration / 2).duration(me.duration)

			linkUpdate.selectAll('path[data-line="solid"]')
				.attr("d", which.diagonal)

			linkUpdate.selectAll('text, rect')
				.attr("transform", function(d) {
					return "translate(" + (((flip * d.source.y) + (flip * d.target.y)) / 2) + "," + ((d.source.x + d.target.x) / 2) + ")";
				})
				.style("opacity", 1)

			link.exit().remove()

			// Stash the old positions for transition.
			nodes.forEach(function(d) {
				d.x0 = d.x;
				d.y0 = d.y;
			})

		},

	}


	zoomReset() {
		var me = this.nodeTree
		me.scale = 6
		me.zoom = scales[me.scale]
		me.offsetDistance = [0, 0]

		this.props.saveSetting && this.props.dispatch(saveSettings({
			offset: me.offsetDistance,
			zoom: me.zoom
		}, true))
		this.dataStore.changeZoomAndOffset(me.zoom, me.offsetDistance);

		this.setState({ zoom: me.zoom })
	}


	zoomIn(focus) {
		var me = this.nodeTree

		if (!focus) {
			focus = {
				x: me.treeWrapper.width() / 2,
				y: me.treeWrapper.height() / 2
			}
		}

		if (++me.scale >= scales.length) {
			me.scale = (scales.length - 1)
		}
		me.oldZoom = me.zoom
		me.zoom = scales[me.scale]

		this.setZoomOffset(focus)

		this.setState({ zoom: me.zoom })
	}


	setZoomOffset(focus) {
		var me = this.nodeTree
		this.hideHover()
		if (focus && focus.x && focus.y && (me.scale <= scales.length - 1 && me.scale >= 0)) {
			var delta = (me.zoom / me.oldZoom) - 1
			var x = (focus.x - 64) - (me.center + me.offsetDistance[0] + ((me.rootX) * me.oldZoom))
			var y = (focus.y - 64) - (me.middle + me.offsetDistance[1] + ((me.rootY) * me.oldZoom))
			me.offsetDistance[0] -= Math.round(x * delta)
			me.offsetDistance[1] -= Math.round(y * delta)
		}

		this.props.saveSetting && this.props.dispatch(saveSettings({
			offset: me.offsetDistance,
			zoom: me.zoom
		}, true))

		this.dataStore.changeZoomAndOffset(me.zoom, me.offsetDistance);
	}


	zoomOut(focus) {
		var me = this.nodeTree

		if (!focus) {
			focus = {
				x: me.treeWrapper.width() / 2,
				y: me.treeWrapper.height() / 2
			}
		}

		if (--me.scale < 0) {
			me.scale = 0
		}
		me.oldZoom = me.zoom
		me.zoom = scales[me.scale]

		this.setZoomOffset(focus)

		this.setState({ zoom: me.zoom })
	}


	constructor(props) {
		super(props)
		this.dataStore = this.props.dataStore;

		this.state = {
			zoom: this.props.settings.zoom || 1
		}

		var thisComponent = this

		this.nodeTree.zoom = this.props.settings.zoom || 1
		this.nodeTree.selected = this.props.settings.selected || []
		this.nodeTree.offsetDistance = this.props.settings.offset || [0, 0]

		this.zoomIn = this.zoomIn.bind(this)
		this.zoomReset = this.zoomReset.bind(this)
		this.zoomOut = this.zoomOut.bind(this)
		this.hideHover = this.hideHover.bind(this)

		this.rotators = this.props.rotators

		if (this.rotators[2] === 'tree-collapse-right') {
			this.rotators[2] = function(data, which, me) {
				return (
					(which.name === 'right' || data.is_root) && data.has_kids
						? {
							[((window.dataStore.urlObj.collapsed.right.indexOf(data.id) === -1 || window.dataStore.urlObj.expanded.right.indexOf(data.id) !== -1) ? 'icon-left-open' : 'icon-right-open')]: function(data, which, me) {
								return function() {
									if (window.dataStore.urlObj.collapsed.right.indexOf(data.id) === -1) {
										if (window.collapsedStart.indexOf(data.id) !== -1) {
											if (window.dataStore.urlObj.expanded.right.indexOf(data.id) !== -1) {
												window.dataStore.urlObj.expanded.right.splice(window.dataStore.urlObj.expanded.left.indexOf(data.id), 1)
											}
										}
										window.dataStore.urlObj.collapsed.right.push(data.id);
									} else {
										if (window.collapsedStart.indexOf(data.id) !== -1) {
											if (window.dataStore.urlObj.expanded.right.indexOf(data.id) === -1) {
												window.dataStore.urlObj.expanded.right.push(data.id);
											}
										}
										window.dataStore.urlObj.collapsed.right.splice(window.dataStore.urlObj.collapsed.right.indexOf(data.id), 1);
									}
									me.updateDiagram(me.root, true);
									thisComponent.props.onCollapse && thisComponent.props.onCollapse({ left: window.dataStore.urlObj.collapsed.left, right: window.dataStore.urlObj.collapsed.right }, { left: window.dataStore.urlObj.expanded.left, right: window.dataStore.urlObj.expanded.right })
								}
							}(data, which, me)
						}
						: false
				)
			}
		}

		if (this.rotators[5] === 'tree-collapse-left') {
			this.rotators[5] = function(data, which, me) {
				return (
					(which.name === 'left' || data.is_root) && data.has_parents
						? {
							[((window.dataStore.urlObj.collapsed.left.indexOf(data.id) === -1 || window.dataStore.urlObj.expanded.left.indexOf(data.id) !== -1) ? 'icon-right-open' : 'icon-left-open')]: function(data, which, me) {
								return function() {
									if (window.dataStore.urlObj.collapsed.left.indexOf(data.id) === -1) {
										if (window.collapsedStart.indexOf(data.id) !== -1) {
											if (window.dataStore.urlObj.expanded.left.indexOf(data.id) !== -1) {
												window.dataStore.urlObj.expanded.left.splice(window.dataStore.urlObj.expanded.left.indexOf(data.id), 1)
											}
										}
										window.dataStore.urlObj.collapsed.left.push(data.id);
									} else {
										if (window.collapsedStart.indexOf(data.id) !== -1) {
											if (window.dataStore.urlObj.expanded.left.indexOf(data.id) === -1) {
												window.dataStore.urlObj.expanded.left.push(data.id);
											}
										}
										window.dataStore.urlObj.collapsed.left.splice(window.dataStore.urlObj.collapsed.left.indexOf(data.id), 1);
									}
									me.updateDiagram(me.root, true);
									thisComponent.props.onCollapse && thisComponent.props.onCollapse({ left: window.dataStore.urlObj.collapsed.left, right: window.dataStore.urlObj.collapsed.right }, { left: window.dataStore.urlObj.expanded.left, right: window.dataStore.urlObj.expanded.right })
								}
							}(data, which, me)
						}
						: false
				)
			}
		}
	}


	componentDidMount() {

		this.nodeTree.init('#' + this.props.id)
		this.nodeTree.updateDiagram(this.props.root, this.props.force)

		window.addEventListener('resize', this.nodeTree.windowResized)
		document.addEventListener('visibilitychange', this.nodeTree.visibilityChange)
	}


	componentDidUpdate(props, state) {

		if (this.props.settings.offset && !this.nodeTree.dragStart) {
			this.nodeTree.offsetDistance = this.props.settings.offset
		}

		if (
			this.props.root !== props.root
			|| this.props.source !== props.source
			|| (JSON.stringify(this.props.settings) !== JSON.stringify(props.settings))
		) {
			this.nodeTree.updateDiagram(this.props.root, this.props.force)
			this.needsUpdated = false
		}

	}


	componentWillUnmount() {

		window.removeEventListener('resize', this.nodeTree.windowResized)
		document.removeEventListener('visibilitychange', this.nodeTree.visibilityChange)

	}


	hideHover(event) {
		if (!event || event.target.tagName.toLowerCase() === 'svg') {
			$('.hoverBoard').hide()
		}
	}


	render() {
		return (<div id={this.props.id} className="tree-wrapper" onClick={this.hideHover.bind(this)}>
			<div className="tree-buttons top-controls">
				<div>
					{
						this.props.nodeSearch || false
					}
					<div className="theme-icon-group control">
						<i className={'icon-zoom-in' + (this.nodeTree.zoom > 1 ? ' active' : '')} onClick={this.zoomIn.bind(this, false)}></i>
						<i className={'icon-target' + (this.nodeTree.zoom == 1 ? ' active' : '')} onClick={this.zoomReset.bind(this)}></i>
						<i className={'icon-zoom-out' + (this.nodeTree.zoom < 1 ? ' active' : '')} onClick={this.zoomOut.bind(this, false)}></i>
					</div>
					{
						this.props.treeButtons || false
					}
				</div>
				{
					this.props.treeButtonsRight || false
				}
			</div>
			<svg>
				<clipPath id="clipCircle30">
					<circle r="25" cx="0" cy="0" />
				</clipPath>
				<clipPath id="clipCircle21">
					<circle r="16" cx="0" cy="0" />
				</clipPath>
				<Trunk className="left-side" />
				<Trunk className="right-side" />
				<Trunk className="hoverBoard" style={{ filter: 'url(#hoverDropshadow)', display: 'none' }} />
				<filter id="hoverDropshadow" height="130%">
					<feGaussianBlur in="SourceAlpha" stdDeviation="4" />
					<feOffset dx="2" dy="2" result="offsetblur" />
					<feMerge>
						<feMergeNode />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
				<NoSource root={this.nodeTree.root} transform={'translate(' + (this.nodeTree.width / 2) + ',' + (this.nodeTree.height / 2 + 125) + ')'} />
			</svg>
		</div>)

	}

}

export default connect(store => store)(Tree)
