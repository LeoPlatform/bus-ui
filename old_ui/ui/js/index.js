import React, {
	Component
} from 'react';
import {
	Provider,
	connect
} from 'react-redux';
import {
	createStore,
	applyMiddleware
} from 'redux';
import thunkMiddleware from 'redux-thunk';
//import createLogger from 'redux-logger';
import rootReducer from './reducers.js';

//import watcher from 'leo-sdk/ui/watcher.js';

import moment from 'moment';
import momenttz from 'moment-timezone';
//var config = require('leo-sdk/leoConfigure.js');

window.registry = {
	tabs: {},
	systems: {
		csv: {
			'Bob the Builder': 'EventViewer'
		}
	}
};

window.moment = moment;

if (window.botmon.timezone) {
    moment.tz.setDefault(window.botmon.timezone);
} else if (localStorage.getItem("defaultBotmonTimezone")){
	moment.tz.setDefault(localStorage.getItem("defaultBotmonTimezone"))
}

/*
const loggerMiddleware = createLogger();

var preloadedState = {
	state: {
		running: true,
	},
	navigation: {
		tab: 'micro'
	},
	window: {
		period: "day",
		start: moment().utc().startOf('day').valueOf(),
		end: moment.now(),
	},
	data: []
};
*/

var store = createStore(
	rootReducer,
	//preloadedState,
	applyMiddleware(
		thunkMiddleware,
		//loggerMiddleware
	)
);

//window.store = store

//watcher.setStore(store);

var App = require("./components/main.jsx").default;
class Root extends Component {
	render() {
		return ( 
			<Provider store={store}>
				<App />
			</Provider>
		);
	}
}

//Set up CSS required
import "../css/main.less";

import "../static/js/data.js";
import "../static/js/dialogs.js";
$(function () {
    LEOCognito.start(window.leoAws.cognitoId, (window.leo && window.leo.getToken) || false, {apiUri: "api/", region: window.leoAws.region, cognito_region: window.leoAws.cognito_region}, function () {
        require("react-dom").render( < Root /> , document.getElementById('EventBus'));
    })
})