"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (milliseconds, showMilliseconds) => {
    if (showMilliseconds && milliseconds < 1000) {
        return Math.round(milliseconds) + 'ms';
    }
    var seconds = Math.round(milliseconds / (1000));
    if (seconds < 60) {
        return seconds + 's';
    }
    else {
        var minutes = Math.floor(milliseconds / (1000 * 60));
        if (minutes < 60) {
            return minutes + 'm' + (seconds % 60 ? ', ' + (seconds % 60) + 's' : '');
        }
        else {
            var hours = Math.floor(milliseconds / (1000 * 60 * 60));
            if (hours < 24) {
                return hours + 'h' + (minutes % 60 ? ', ' + (minutes % 60) + 'm' : '');
            }
            else {
                var days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
                //return days + 'd' + (hours % 24 ? ', ' + (hours % 24) + 'h' : '')
                return days + 'd, ' + (hours % 24) + 'h, ' + (minutes % 60) + "m";
            }
        }
    }
};
//# sourceMappingURL=humanize.js.map