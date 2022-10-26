import { observable, computed, action } from 'mobx';
import autoBind from 'react-autobind';
import _ from 'lodash';
import moment from 'moment';
import refUtil from "leo-sdk/lib/reference.js";

export default class DataStore {

    @observable action = {};
    @observable active = null;
    @observable activeBotCount = 0;
    @observable alarmed = [];
    @observable alarmedCount = 0;
    @observable availableTags = {};
    @observable authenticated = null;
    @observable bots = [];
    @observable config = null;
    @observable changeLog = null;
    @observable checksums = {};
    @observable cronInfo = null;
    @observable dashboard = null;
    @observable displayState = null;
    @observable eventSettings = null;
    @observable fetchTimeout = undefined;
    @observable fetchTimeout2 = undefined;
    @observable filterByTag = '';
    @observable gotInitialChangeLog = false;
    @observable hasData = false;
    @observable logDetails = null;
    @observable logId = null;
    @observable logSettings = null;
    @observable logs = null;
    @observable nodes = {};
    @observable queues = [];
    @observable rangeCount = null;
    @observable refreshDashboard = true;
    @observable reloadTimeout = null;
    @observable runNow = null;
    @observable savedSettings = null;
    @observable sdkConfig = {};
    @observable sdkPick = 'node';
    @observable settings = null;
    @observable sortBy = '';
    @observable sortDir = 'desc';
    @observable tableData = null;
    @observable tags = [];
    @observable tagCards = JSON.parse(localStorage.getItem('tagCards') || '{}');
    @observable topicInfo = {};
    @observable totalEvents = null;
    @observable updatingStats = false;
    @observable urlObj = { "timePeriod": { "interval": "minute_15" }, "selected": [], "view": "dashboard", "collapsed": { "left": [], "right": [] }, "expanded": { "left": [], "right": [] } };
    @observable stats = null;
    @observable systemTypes = null;
    @observable systems = [];

    constructor() {
        autoBind(this);
        window.dataStore = this;
    }

    @action
    setupURL() {
        let urlHash = decodeURIComponent(window.location.hash.substr(1));
        let parsed = JSON.parse(urlHash);
        this.urlObj = Object.assign(this.urlObj, parsed);
    };


    // Functions used to setup and change values in this.urlObj
    @action
    changeView = (view) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            view: view
        })
    };

    @action
    changeSelected = (selected) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            selected: [selected]
        })
    };

    @action
    changeTimePeriod = (begin, end, interval) => {
        this.urlObj.timePeriod = Object.assign({}, this.urlObj.timePeriod, {
            begin: begin,
            end: end,
            interval: interval
        });
        if (this.urlObj.timePeriod.begin === undefined) {
            delete this.urlObj.timePeriod.begin;
        }
        if (this.urlObj.timePeriod.end === undefined) {
            delete this.urlObj.timePeriod.end;
        }
    };

    @action
    changeNode = (nodeId, view, offset) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            node: nodeId,
            selected: [nodeId],
            view: view,
            offset: offset
        })
    };

    @action
    changeDetailsBool = (bool) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            details: bool
        })
    };

    @action
    resetState = () => {
        this.urlObj = { "timePeriod": { "interval": "minute_15" }, "selected": [] };
    };

    @action
    changeCollapsed = (collapsed, expanded) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            collapsed: collapsed,
            expanded: expanded
        })
    };

    @action
    changeZoomAndOffset = (zoom, offset) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            zoom: zoom,
            offset: offset
        });
        if (this.urlObj.zoom === undefined) {
            delete this.urlObj.zoom;
        }
        if (this.urlObj.offset === undefined) {
            delete this.urlObj.offset;
        }
    };

    @action
    changeAllStateValues = (selected, timePeriod, view, offset, node, zoom, details) => {
        this.urlObj = Object.assign({}, this.urlObj, {
            selected: selected,
            timePeriod: timePeriod,
            view: view,
            offset: offset,
            node: node,
            details: details
        });
        if (this.urlObj.timePeriod === undefined) {
            delete this.urlObj.timePeriod;
        }
        if (_.has(this.urlObj, 'timeperiod.begin')) {
            if (this.urlObj.timePeriod.begin === undefined) {
                delete this.urlObj.timePeriod.begin;
            }
        }
        if (_.has(this.urlObj, 'timeperiod.end')) {
            if (this.urlObj.timePeriod.end === undefined) {
                delete this.urlObj.timePeriod.end;
            }
        }
        if (this.urlObj.offset === undefined) {
            delete this.urlObj.offset;
        }
        if (this.urlObj.node === undefined) {
            delete this.urlObj.node;
        }
        if (this.urlObj.zoom === undefined) {
            delete this.urlObj.zoom;
        }
        if (this.urlObj.view === undefined) {
            delete this.urlObj.view;
        }
        if (this.urlObj.details === undefined) {
            delete this.urlObj.details;
        }
        if (this.urlObj.selected === undefined) {
            delete this.urlObj.selected;
        }
    };

    // *******************************************************************
    // API CALLS
    @action
    getAccessConfig() {
        $.get('api/accessConfig', (config) => {
            this.config = config;
        }).fail((result) => {
            window.messageLogNotify('Failure Retrieving Access Config', 'warning', result);
        })
    }

    @action
    getChangeLog() {
        this.gotInitialChangeLog = true;
        let node = this.nodes["queue:BotChangeLog"];
        let timePeriodMinutes = 2;
        let latestWrite = node.latest_write;
        this.timestamp = moment.utc(latestWrite).subtract(timePeriodMinutes, 'minutes');
        let timeFormat = '/YYYY/MM/DD/HH/mm/';
        this.timestamp = 'z' + this.timestamp.format(timeFormat) + this.timestamp.valueOf();

        $.get('api/search/' + encodeURIComponent('queue:BotChangeLog') + '/' + encodeURIComponent(this.timestamp), (result) => {
            this.changeLog = result.results;
        }).fail((result, status) => {
            if (status !== "abort" && status != "canceled") {
                window.messageLogNotify('Failure searching events on "' + this.nodes["queue:BotChangeLog"].label + '"', 'error', result);
            }
        }).always(() => {
            if (this.fetchTimeout2) {
                clearTimeout(this.fetchTimeout2);
                this.fetchTimeout2 = false
            }
            this.fetchTimeout2 = setTimeout(this.getChangeLog, (timePeriodMinutes * 60000));
        });
    }

    @action
    getChecksums(nodeData, nodes) {
        let botIds = { ids: [] };
        if (nodeData.type === 'system') {
            _.map(this.nodes, (node) => {
                let system = node.system || false;
                if (system && system === nodeData.id) {
                    botIds.ids.push(refUtil.botRef(node.id).id);
                }
            });
        }
        else {
            botIds.ids.push(refUtil.botRef(nodeData.id).id)
        }
        $.post("api/bot", JSON.stringify(botIds), (response) => {
            if (nodeData.type === 'system') {
                let checksums = {};
                for (let x in response) {
                    checksums[response[x].id] = response[x].checksum;
                }
                for (let i in checksums) {
                    checksums[i].label = refUtil.botRef(i).id;
                    checksums[i].bot_id = i;
                    checksums[i].log = checksums[i].log || {};
                    checksums[i].totals = checksums[i].totals || {};
                    checksums[i].sample = checksums[i].sample || { 'extra': [], 'missing': [], 'incorrect': [] };
                    if (checksums[i].bot_id === this.runNow) {
                        if (['running', 'initializing'].indexOf(checksums[i].status) !== -1) {
                            this.runNow = false
                        } else {
                            checksums[i].status = 'starting'
                        }
                    }
                }
                this.checksums = checksums;
            } else {
                let checksum = response[0].checksum;
                checksum.label = checksum.label || (nodes[nodeData.id] || {}).label || nodeData.id;
                checksum.bot_id = nodeData.id;
                if (checksum.bot_id === this.runNow) {
                    if (['running', 'initializing'].indexOf(checksum.status) !== -1) {
                        this.runNow = false
                    } else {
                        checksum.status = 'starting'
                    }
                }
                let obj = {};
                obj[nodeData.id] = checksum;
                this.checksums = obj;
            }
        }).fail((response) => {
            if (response.statusText !== 'abort') {
                window.messageLogNotify('Failure getting checksums', 'error', response);
            }
        })
    }

    @action
    getDashboard(id, range_count, timestamp) {
        if (this.refreshDashboard === false) {
            return;
        }
        $.get(`api/dashboard/${id}?range=${range_count[0]}&count=${range_count[1] || 1}&timestamp=${timestamp}`, (result) => {
            this.dashboard = result;
        }).always((xhr, status) => {
            if (status !== "abort" && status != "canceled") {
                clearTimeout(this.refreshDashboard);
                this.refreshDashboard = setTimeout(this.getDashboard, 1000);
            }
        });
    }

    @action
    getCron(id) {
        $.get(`api/cron/${encodeURIComponent(id)}`, (result) => {
            this.cronInfo = result || {};
        }).fail((result, status) => {
            if (status !== "abort" && status != "canceled") {
                window.messageLogModal('Failure retrieving settings ' + this.nodes[id].label, 'warning', result)
            }
        })
    }

    @action
    getEventSettings() {
        $.get('api/eventSettings', (eventSettings) => {
            this.eventSettings = eventSettings;
        }).fail((result) => {
            window.messageLogNotify('Failure Retrieving Event Settings', 'warning', result);
        })
    }

    @action
    getLogs(botId, result, customTimeFrame) {
        let settings = result || {};
        this.logSettings = result || {};
        this.logId = settings.lambdaName || (settings.templateId !== 'Leo_core_custom_lambda_bot' ? settings.templateId : null) || refUtil.botRef(botId).id;
        this.logs = false;
        let timeFrame = '5m';

        let queryString = {
            start: (customTimeFrame ? customTimeFrame : moment().subtract(timeFrame.slice(0, 1), timeFrame.slice(-1)).valueOf()
            )
        };
        $.get(`api/logs/${this.logId}/${settings.isTemplated ? encodeURIComponent(settings.id) : 'all'}`, queryString, (result) => {
            result.forEach((log) => {
                log.timeAgo = this.formatTime(log.timestamp);
                if (log.details) {
                    log.details.logs.forEach((detail) => {
                        detail.timeAgo = this.formatTime(detail.timestamp, log.timestamp)
                    })
                }
            });
            this.logs = result;
            this.logDetails = (result[0] || {}).details || {};
            this.active = 0;
        }).fail((result) => {
            if (result.statusText !== 'abort') {
                window.messageLogModal('Failure retrieving logs', 'warning', result);
                this.logs = [];
            }
        })
    }

    @action
    getSdkConfig() {
        $.get('api/sdkConfig', (config) => {
            this.sdkConfig = config;
        }).fail((result) => {
            //window.messageLogNotify('Failure Retrieving SDK Config', 'warning', result);
        })
    }

    @action
    getSettings() {
        $.get('api/settings', (settings) => {
            this.settings = settings;
        }).fail((result) => {
            window.messageLogNotify('Failure Retrieving Settings', 'warning', result);
        })
    }

    @action
    getStats() {
        let range = ((this.urlObj.timePeriod || {}).interval || 'minute_15').split('_');
        let timestamp = window.timePeriod.endFormatted();

        let statsPromise = $.Deferred();

        let call = $.ajax({
            url: 'api/stats_v2',
            data: {
                range: range[0],
                count: range[1] || 1,
                timestamp: timestamp
            },
            success: (result) => {
                statsPromise.resolve(result);
            },
            error: (err) => {
                window.messageLogNotify('Failure retrieving Stats', 'warning')
                statsPromise.reject(err);
            }
        });

        statsPromise.abort = () => {
            call.abort();
        };

        statsPromise.always(() => {
            if (this.fetchTimeout) {
                if (statsPromise) {
                    statsPromise.abort()
                }
                clearTimeout(this.fetchTimeout)
                this.fetchTimeout = false
            }
            this.fetchTimeout = setTimeout(this.getStats, 10000)
        });

        Promise.all([statsPromise]).then((result) => {
            let data = result[0];
            let thisnodes = Object.assign({}, data.nodes.bot, data.nodes.queue, data.nodes.system);

            // Needed for workflow to work

            for (let id in thisnodes) {
                let node = thisnodes[id];
                postProcess(node);
                let isOrphan = !(node.type === "system");
                Object.keys(node.link_to.children).forEach((id) => {
                    let child = thisnodes[id] || {};
                    if (child.status !== 'archived' && !child.archived) {
                        isOrphan = false
                    }
                    postProcess(node.link_to.children[id])
                });
                Object.keys(node.link_to.parent).forEach((id) => {
                    let parent = thisnodes[id] || {};
                    if (parent.status !== 'archived' && !parent.archived) {
                        isOrphan = false
                    }
                    postProcess(node.link_to.parent[id])
                });
                node.isOrphan = isOrphan;
            }
            this.nodes = thisnodes;
            this.bots = Object.keys(data.nodes.bot);
            this.queues = Object.keys(data.nodes.queue);
            this.systems = Object.keys(data.nodes.system);
            this.updateStatsDashboard(this.bots, this.nodes);
            if (!this.gotInitialChangeLog) {
                this.getChangeLog();
            }
            this.hasData = true;

            // Commented down to if statement
            //this.props.dispatch({ type: 'SET_HAS_DATA', value: true })

            // if (!this.props.displayPaused) {
            //     var userSettings = this.props.userSettings
            //     if (!data.errorMessage) {
            //         switch(userSettings.view || 'list') {
            //             case 'node':
            //                 window.nodeTree.updateDiagram(null, true)
            //                 break
            //
            //             case 'list':
            //             case 'trace':
            //             default:
            //                 window.updatedStats && window.updatedStats()
            //                 break
            //         }
            //         window.updateSlaCount()
            //         window.updateHealthCheck()
            //     } else {
            //         window.messageLogNotify('Failure retrieving stats', 'warning', data)
            //     }
            //     this.fetchTimeout = setTimeout(this.fetchData.bind(this), (userSettings.view === 'dashboard' ? 300000 : 15000))
            // }

            function postProcess(node) {

                let units = numeral(node.units).format('0,0');

                node.icon = (!node.icon || node.icon === node.type + '.png') ? undefined : node.icon;
                node.paused = (node.paused || node.status === 'paused' || node.status === 'archived');
                node.archived = (node.archived || node.status === 'archived');

                if (node.logs && node.logs.errors && node.logs.errors.length) {
                    node.status = 'blocked';
                    node.errored = true;
                }
                if (node.rogue === true) {
                    node.status = 'rogue';
                    node.errored = true;
                }

                let status = {
                    danger: 'SLA Triggered',
                    running: 'Normal',
                    blocked: 'In Error',
                    paused: 'Paused'
                }[node.status] || node.status;

                node.logs = node.logs || {};
                node.logs.errors = node.logs.errors || [];

                let errors = {};
                if (node.logs.errors.length !== 0) {
                    errors = node.logs.errors[0];
                }

                node.details = {
                    name: node.label,
                    id: (localStorage.getItem('enableBetaFeatures') === 'alpha' ? node.id : undefined),
                    status: status,
                    schedule: node.frequency || undefined,
                    description: node.description || undefined,
                    last_run_time: node.last_run && node.last_run.start ? moment(node.last_run.start).format('MMM D, Y h:mm:ss a') : undefined,

                    last_write_time: node.latest_write ? moment(node.latest_write).format('MMM D, Y h:mm:ss a') : undefined,
                    latest_checkpoint: node.latest_checkpoint || undefined,

                    system: node.system,

                    template: window.templates && node.templateId ? (window.templates[node.templateId] || {}).name : undefined,

                    executions: node.executions || undefined,
                    errors: node.errors || undefined,
                    message: node.message || undefined,
                    error_message: (errors).msg
                        || (errors).message
                        || node.logs.errors.toString().trim()
                        || undefined,
                    error_stack: node.logs.errors.length > 0 ? node.logs.errors[0].stack : undefined
                };

                switch (node.type) {
                    case "bot":
                        if (node.owner === 'leo' && (node.tags ? node.tags.indexOf('leo-core') === -1 : true)) {
                            node.tags = node.tags ? node.tags + ', leo-core' : 'leo-core';
                        }
                        node.display = {
                            above: [],
                            below: [{
                                executions: node.executions + ' / ',
                                errors: node.errors
                            }]
                        };
                        if (node.isAlarmed && (node.status === 'running' || node.status === 'paused')) {
                            node.status = 'danger';
                        }
                        break;

                    case "write":
                        if (node.last_write === null || node.last_write === undefined) {
                            node.display = {
                                above: [`${units}`],
                                below: [`N/A`]
                            };
                        } else {
                            node.display = {
                                above: [`${units}`],
                                below: [`${humanize(moment.duration(node.last_write_lag))} ago`]
                            };
                        }
                        break;

                    case "read":
                        if (node.last_read === null || node.last_read === undefined) {
                            node.display = {
                                above: [`${units}`],
                                below: [`N/A`]
                            };
                        } else if (node.event_source_lag < 100 /*ms*/) {
                            node.display = {
                                above: [`${units}`],
                                below: [`-`]
                            };
                        } else {
                            node.display = {
                                above: [`${units}`],
                                below: [`lag: ${humanize(moment.duration(node.event_source_lag))}`]
                            };
                        }
                        break;

                    case "link":
                        node.display = {
                            line: 'dashed',
                            above: [],
                            below: []
                        };
                        break;

                    case "event": case 'queue':
                        node.type = 'queue';
                        node.display = {
                            above: [],
                            below: []
                        };
                        break;

                    case "system":
                        node.display = {
                            above: [],
                            below: []
                        };
                        break;
                }
            } //end postProcess
        })
    }


    // *******************************************************************
    // Dashboard page stuff
    @action
    countEvents(node) {
        this.totalEvents = 0;
        if (node && node.link_to) {
            Object.keys(node.link_to.children).forEach((id) => {
                this.totalEvents += Number(node.link_to.children[id].units * 1)
            })
            Object.keys(node.link_to.parent).forEach((id) => {
                this.totalEvents += Number(node.link_to.parent[id].units)
            })
        }
        return this.totalEvents
    }

    @action
    sortAlarmed(alarmed) {
        alarmed = alarmed || this.alarmed;
        return alarmed.sort((a, b) => {
            if (this.sortDir === 'asc') {
                [a, b] = [b, a]
            }
            switch (this.sortBy) {
                case 'tags':
                    if (a.tags.toString() === '') {
                        return 1
                    }
                    if (b.tags.toString() === '') {
                        return -1
                    }
                    return a.tags.toString().localeCompare(b.tags.toString()) || a.label.localeCompare(b.label)
                    break

                default:

                case 'name':
                    return a.label.localeCompare(b.label)
                    break

                case 'readLag':
                case 'writeLag':
                //case 'execTime':
                case 'execCount':
                case 'errorCount':
                case 'writeCount':
                case 'readCount':
                    return ((b[this.sortBy] ? b[this.sortBy].value : -1) - (a[this.sortBy] ? a[this.sortBy].value : -1)) || (a.label.localeCompare(b.label))
                    break
            }
        })
    }

    @action
    updateStatsDashboard(bots, nodes) {

        for (let tag in this.tagCards) {
            this.tagCards[tag] = {
                alarmed: 0,
                active: 0
            }
        }

        try {
            this.activeBotCount = 0;
            this.totalEvents = 0;
            this.alarmedCount = 0;
            this.alarmed = [];
            bots.forEach((botId) => {
                let bot = nodes[botId];
                if (!bot) {
                    return false
                }
                this.totalEvents += Number(this.countEvents(bot));
                if (bot.archived === false) {
                    this.activeBotCount++;
                }
                if (bot.last_run.start >= (moment().subtract(6, 'h').valueOf())) {
                    (bot.tags || '').toString().split(/,\s*/).sort().filter(tag => tag).forEach((tag) => {
                        if (tag.toUpperCase() in this.tagCards) {
                            this.tagCards[tag.toUpperCase()].active++
                        }
                    })
                }

                (bot.tags || '').toString().split(/,\s*/).filter(tag => tag).forEach((tag) => {
                    if (!(tag.toUpperCase() in this.tagCards)) {
                        this.tags.push(tag.toUpperCase())
                    }
                })


                if (bot.isAlarmed) {
                    this.alarmedCount += 1;
                    this.alarmed.push({
                        id: bot.id,
                        type: bot.type,
                        tags: (bot.tags || '').toString().split(/,\s*/).sort().filter(tag => tag),
                        label: bot.label,
                        executions: bot.executions,
                        errorCount: bot.alarms.errors && {
                            timeIndex: 0,
                            value: 0,
                            red: bot.alarms.errors.value,
                            gray: bot.alarms.errors.limit,
                            title: {
                                msgs: [{
                                    type: "errors",
                                    msg: "Error Count 21 > 0",
                                    errors: 21,
                                    operator: ">",
                                    expected: 0
                                }]
                            }
                        },
                        readLag: bot.alarms.source_lag && {
                            timeIndex: 0,
                            value: 0,
                            red: bot.alarms.source_lag.value,
                            gray: bot.alarms.source_lag.limit,
                            title: {
                                msgs: [{
                                    type: "errors",
                                    msg: "Error Count 21 > 0",
                                    errors: 21,
                                    operator: ">",
                                    expected: 0
                                }]
                            }
                        },
                        writeLag: bot.alarms.write_lag && {
                            timeIndex: 0,
                            value: 0,
                            red: bot.alarms.write_lag.value,
                            gray: bot.alarms.write_lag.limit,
                            title: {
                                msgs: [{
                                    type: "errors",
                                    msg: "Error Count 21 > 0",
                                    errors: 21,
                                    operator: ">",
                                    expected: 0
                                }]
                            }
                        }
                    })
                } else {
                    if (bot.health.mute !== undefined && bot.health.mute !== false && !bot.archived) {
                        if (bot.health.mute === true) {
                            this.alarmed.push({
                                id: bot.id,
                                type: bot.type,
                                tags: (bot.tags || '').toString().split(/,\s*/).sort().filter(tag => tag),
                                label: bot.label
                            });
                        } else if (bot.health.mute >= moment.now()) {
                            this.alarmed.push({
                                id: bot.id,
                                type: bot.type,
                                tags: (bot.tags || '').toString().split(/,\s*/).sort().filter(tag => tag),
                                label: bot.label
                            });
                        }
                    }
                }
            });
            this.alarmed = this.sortAlarmed(this.alarmed);
        } catch (e) { }

        this.tags.sort().forEach((tag) => {
            this.availableTags[tag] = tag
        })
    }


    @action
    formatTime(timestamp, baseTime) {
        let milliseconds = (baseTime
            ? moment(timestamp).diff(baseTime)
            : moment().diff(timestamp)
        );

        return [
            (milliseconds >= 1000 ? window.humanize(milliseconds) : numeral((milliseconds / 1000) % 1).format('.0') + 's'),
            ''
        ];
    }
    // *******************************************************************
}
