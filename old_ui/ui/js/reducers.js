
import { combineReducers } from 'redux'

import * as constants from './constants'


const isAuthenticated = (state = false, action) => {
	return (action.type === 'SET_IS_AUTHENTICATED') || state
}


const hasData = (state = false, action) => {
	return (action.type === 'SET_HAS_DATA') || state
}


const displayPaused = (state = false, action) => {
	switch(action.type) {
		case 'SET_DISPLAY_STATE':
			return !!action.state
		break

		default:
			return state
		break
	}
}


const userSettings = (state = { view: 'dashboard', selected: [], timePeriod: { interval: 'hour_6'} }, action, replace) => {

	switch(action.type) {
		case 'SET_PAGE_VIEW':
			return Object.assign({}, state, {
				view: action.view
			})
		break

		case 'SAVE_SETTINGS':
			try {
				var values = $.extend({}, JSON.parse(decodeURI(document.location.hash.slice(1)) || '{}'), action.settings)
			} catch(e) {
				values = {}
			}
			delete values.detailsPeriod
			if (action.replace) {
				document.location.replace(document.location.href.split('#')[0] + '#' + JSON.stringify(values).replace(/ /g, '%20'))
			} else {
				document.location.hash = JSON.stringify(values)
			}
			return values

		break

		default:
			return state
		break
	}
}


export default combineReducers(Object.assign({}, constants, {
	isAuthenticated,
	hasData,
	userSettings,
	displayPaused
}))
