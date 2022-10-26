import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import TimePicker from '../elements/timePicker.jsx';

var timeFormat = '/YYYY/MM/DD/HH/mm/';

@inject('dataStore')
@observer
export default class PayloadSearch extends React.Component {

	constructor(props) {
		super(props);
		this.dataStore = this.props.dataStore;
		this.state = this.init(props);
		this.continueSearch = this.continueSearch.bind(this);
	}


	init(props) {
		let timestamp = '';
		let timeFrame = props.timeFrames ? props.timeFrames[0] : '5m';
		let searchText = '';

		if (props.eventId) {
			timestamp = searchText = props.eventId;
			timeFrame = '';
		} else if (!window.timePeriod.begin || this.props.forceNow) { //now
			timestamp = '';
			timeFrame = (!props.timeFrames || props.timeFrames.indexOf('5m') !== -1 ? '5m' : props.timeFrames[0]);
			if (props.lastWrite) {
				let lastWrite = (Date.now() - props.lastWrite);
				if (lastWrite > (7 * 60 * 60 * 1000)) {
					timestamp = 'z' + moment.utc(props.lastWrite).format(timeFormat) + moment.utc();
				} else if (lastWrite > (24 * 60 * 60 * 1000)) {
					timeFrame = '1w';
				} else if (lastWrite > (6 * 60 * 60 * 1000)) {
					timeFrame = '1d';
				} else if (lastWrite > (60 * 60 * 1000)) {
					timeFrame = '6h';
				} else if (lastWrite > (5 * 60 * 1000)) {
					timeFrame = '1h';
				}
			}
		} else {
			timestamp = 'z' + moment.utc(window.timePeriod.startTimestamp).format(timeFormat) + moment(window.timePeriod.startTimestamp).valueOf();
			timeFrame = '';
		}

		return {
			serverId: props.serverId,
			timestamp: timestamp,
			timeFrame: timeFrame,
			events: false,
			eventIndex: -1,
			isSearching: true,
			searchText: searchText,
			searchEndTime: undefined,
			searchedEventsCount: 0,
			searchAttempts: 0
		}
	}


	componentDidMount() {
		this.startPayloadSearch();
	}


	componentWillReceiveProps(props) {
		if (props.serverId !== this.state.serverId) {
			this.setState(this.init(props), this.startPayloadSearch);
		}
	}


	componentWillUnmount() {
		if (this.currentRequest) {
			this.currentRequest.abort();
		}
	}


	selectTimeFrame(timeFrame) {
		this.setState({
			timeFrame: timeFrame,
			searchEndTime: moment(),
			timestamp: undefined
		}, () => {
			this.startPayloadSearch()
		})
	}


	customTimeFrame(customTime) {
		customTime = moment.utc(customTime, 'MM/DD/YYYY h:mm A')
		this.setState({
			timestamp: 'z' + customTime.format(timeFormat) + customTime.valueOf(),
			searchEndTime: moment.utc(customTime),
			timeFrame: ''
		}, () => {
			this.startPayloadSearch()
		})
	}


	saveSearchText(event) {
		this.setState({ searchText: event.currentTarget.value })
	}


	clearPayloadSearch() {
		this.setState({
			resumptionToken: undefined,
			events: false,
			eventIndex: -1,
			isSearching: true,
			searchText: '',
			searchEndTime: ''
		}, () => {
			this.returnEvents(false)
			this.startPayloadSearch()
		})
	}


	runPayloadSearchOnEnter(event) {
		if (event.keyCode == 13) {
			event.preventDefault()
			var searchText = event.currentTarget.value.trim()
			if (searchText.match(/(z\/.*?)(?:$|\s)/g)) {
				let token = searchText.match(/(z\/.*?)(?:$|\s)/g)[0];
				token = token.replace(/\s/g, '');
				this.setState({
					timestamp: token,
					timeFrame: ''
				}, () => {
					this.startPayloadSearch()
				})
			} else {
				this.setState({ searchText: event.currentTarget.value }, () => {
					this.startPayloadSearch()
				})
			}
		}
	}


	startPayloadSearch() {
		if (this.props.serverId) {
			this.setState({ events: false, searchedEventsCount: 0, eventIndex: -1, isSearching: true, resumptionToken: undefined, searchAttempts: 0, returnedEventsCount: 0 }, () => {
				this.returnEvents([])
			})
			if (this.state.timestamp) {
				var resumptionToken = this.state.timestamp
				if (resumptionToken.match(/^z\/\d{4}(\/\d{2}){4}\/\d{13}-\d{1,8}$/)) {
					if (resumptionToken.slice(-1) == '0') {
						resumptionToken = resumptionToken.slice(0, -1)
					} else {
						resumptionToken = resumptionToken.slice(0, -1) + (resumptionToken.slice(-1) - 1)
					}
				}
			} else if (this.state.timeFrame == 'all') {
				var resumptionToken = ''
			} else {
				var startTime = moment.utc().subtract(this.state.timeFrame.split(/[^\d]/)[0], this.state.timeFrame.slice(-1));
				var resumptionToken = 'z' + startTime.format('/YYYY/MM/DD/HH/mm/') + startTime
			}
			this.runPayloadSearch(this.props.serverId, this.state.searchText, resumptionToken)
		}
	}


	runPayloadSearch(serverId, searchText, resumptionToken, agg) {
		var getSearchText = (searchText === resumptionToken || searchText.match(/^z\/\d{4}\//)) ? '' : searchText;

		if (searchText.match(/(^z\/.*?)(?:$|\s)/g)) {
			let token = searchText.match(/(^z\/.*?)(?:$|\s)/g)[0];
			getSearchText = searchText.replace(token, '')
		}

		
		if (resumptionToken.match(/^z\/\d{4}-/)) {
			let startTime = moment.utc(resumptionToken.replace(/^z\//, ""));
			if (!startTime.isValid()){
				window.messageLogNotify('Invalid ISO 8601 date', 'error', resumptionToken.replace(/^z\//, ""));
				this.setState({
					isSearching: false,
				});
				return;
			}
			resumptionToken = 'z' + startTime.format('/YYYY/MM/DD/HH/mm/') + startTime;
		}
		

		this.currentRequest = $.get('api/search/' + encodeURIComponent(serverId) + '/' + encodeURIComponent(resumptionToken) + '/' + encodeURIComponent(getSearchText) + (agg ? `?agg=${encodeURIComponent(JSON.stringify(agg || {}))}` : ""), (result) => {
			var events = (this.state.events || []).concat(result.results)
			var searchedEventsCount = (this.state.searchedEventsCount || 0) + result.count;
			var returnedEventsCount = (this.state.returnedEventsCount || 0) + result.results.length;
			var searchAttempts = this.state.searchAttempts + 1
			if (searchAttempts >= 6) {
				this.setState({
					events: events,
					searchedEventsCount: searchedEventsCount,
					resumptionToken: result.resumptionToken || false,
					isSearching: false,
					searchAttempts: 0,
					returnedEventsCount: 0,
					agg: result.agg,
				}, () => {
					this.returnEvents(events)
				});
			} else if (returnedEventsCount < 30) {
				this.setState({
					events: events,
					searchedEventsCount: searchedEventsCount,
					resumptionToken: result.resumptionToken || false,
					isSearching: !!result.resumptionToken,
					searchEndTime: result.last_time,
					searchAttempts: searchAttempts,
					returnedEventsCount: returnedEventsCount,
					agg: result.agg
				}, () => {
					if (result.resumptionToken) {
						this.runPayloadSearch(serverId, searchText, result.resumptionToken, result.agg)
					}
					this.returnEvents(events)
				});
			} else {
				this.setState({
					events: events,
					searchedEventsCount: searchedEventsCount,
					searchEndTime: result.last_time,
					isSearching: false,
					resumptionToken: result.resumptionToken || false,
					searchAttempts: 0,
					returnedEventsCount: 0,
					agg: result.agg
				}, () => {
					this.returnEvents(events)
				});
			}

		}).fail((result, status) => {
			if (result.responseText === 'invalid filter expression') {
				window.messageLogNotify('Invalid Filter Expression', 'error', result);
			} else if (status !== "abort" && status !== "canceled") {
				result.call = 'api/search/' + encodeURIComponent(serverId) + '/' + encodeURIComponent(resumptionToken) + '/' + encodeURIComponent(getSearchText);
				window.messageLogNotify('Failure searching events on "' + this.dataStore.nodes[this.props.serverId].label + '"', 'error', result);
			}
		}).always(() => {
			this.currentRequest = null;
		})
	}


	continueSearch() {
		if (this.state.resumptionToken && !this.state.isSearching) {
			this.resumeSearch()
		}
	}


	resumeSearch() {
		this.setState({ isSearching: true, searchAttempts: 0, returnedEventsCount: 0 }, () => {
			this.returnEvents()
		})
		this.runPayloadSearch(this.props.serverId, this.state.searchText, this.state.resumptionToken, this.state.agg)
	}


	findRecent() {
		var timestamp = moment.utc(this.props.lastWrite).subtract(5, 'minutes')
			, customTimeFrame = timestamp.format()//'YYYY-MM-DDTHH:MM:SS')
		timestamp = 'z' + timestamp.format(timeFormat) + timestamp.valueOf()
		this.setState({ customTimeFrame: customTimeFrame, timeFrame: '', timestamp: timestamp }, this.startPayloadSearch)
	}


	returnEvents(events) {

		var status = ((this.state.resumptionToken || this.state.isSearching)
			? <div>{
				this.state.searchEndTime
					? 'Looked through ' + this.state.searchedEventsCount + ' events until ' + moment(this.state.searchEndTime).format('YYYY-MM-DD HH:mm:ss') + ' '
					: ''
			}
				{
					this.state.isSearching
						? (<span>
							{(this.state.searchEndTime ? ' and ' : '')}
							searching <span className="theme-spinner-tiny margin-30" />
						</span>)
						: (
							this.state.resumptionToken
								? <button type="button" className="theme-button" onClick={this.resumeSearch.bind(this)}>Continue</button>
								: false
						)
				}
			</div>
			: (
				events.length
					? <div>No more events found</div>
					: (
						this.props.lastWrite
							? <div>
								<button type="button" className="theme-button" onClick={this.findRecent.bind(this)}>Find most recent events</button>
							</div>
							: <div>No events found</div>
					)
			)
		);

		this.props.returnEvents && this.props.returnEvents(events, status);
	}


	render() {

		return (<div className="timeframe-search-bar">
			{
				this.props.hideSearch
					? <div className="left-side"></div>
					: (<div className="left-side">
						<input name="search" placeholder="search" value={this.state.searchText} onChange={this.saveSearchText.bind(this)} onKeyDown={this.runPayloadSearchOnEnter.bind(this)} onBlur={this.runPayloadSearchOnEnter.bind(this)} autoComplete="off" />
						{
							this.state.searchText
								? <i className="icon-cancel clear-search-text" onClick={this.clearPayloadSearch.bind(this)} />
								: false
						}
					</div>)
			}
			<div className="right-side">

				<TimePicker timeFrames={this.props.timeFrames} active={this.state.timeFrame} customTimeFrame={this.state.customTimeFrame} onClick={this.selectTimeFrame.bind(this)} datePicker={this.customTimeFrame.bind(this)} />

			</div>
		</div>)

	}

}
