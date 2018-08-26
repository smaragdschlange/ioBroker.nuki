/**
 *
 * nuki adapter
 *
 *
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var request = require('request');

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = new utils.Adapter('nuki');

// Global variables
var bridgeIp;
var bridgePort;
var bridgeToken;
var bridgeName;

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    var path = id.split('.',5);
    var nukiId = path[3];

    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    } else if (state) {
        if (state.val != 0) {
            setLockAction(nukiId, state.val);
        } 
    }
    getLockState(nukiId);
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function initNukiStates(_obj){
    var nukiState = _obj.lastKnownState;
    var nukiPath = bridgeName + '.' + _obj.nukiId;

    adapter.setObjectNotExists(nukiPath, {
        type: 'channel',
        common: {
            name: _obj.name
        },
        native: {}
    });

    adapter.setObjectNotExists(nukiPath + '.state', {
        type: 'state',
        common: {
            name: 'Status',
            type: 'number',
            role: 'value'
        },
        native: {}
    });
    
    adapter.setObjectNotExists(nukiPath + '.stateName', {
        type: 'state',
        common: {
            name: 'Statustext',
            type: 'string',
            role: 'text'
        },
        native: {}
    });
    
    adapter.setObjectNotExists(nukiPath + '.batteryCritical', {
        type: 'state',
        common: {
            name: 'Batterie schwach',
            type: 'boolean',
            role: 'indicator.lowbat'
        },
        native: {}
    });
    
    adapter.setObjectNotExists(nukiPath + '.timestamp', {
        type: 'state',
        common: {
            name: 'Zuletzt aktualisiert',
            type: 'string',
            role: 'time'
        },
        native: {}
    });

    adapter.setObjectNotExists(nukiPath + '.lockAction', {
        type: 'state',
        common: {
            name: 'Aktion',
            type: 'number',
            role: 'level'
        },
        native: {}
    });

    adapter.subscribeStates(nukiPath + '.lockAction');
    setLockState(_obj.nukiId, nukiState);
}

function setLockState(_nukiId, _nukiState) {
    var nukiPath = bridgeName + '.' + _nukiId;

    adapter.setState(nukiPath + '.state', {val: _nukiState.state, ack: true});
    adapter.setState(nukiPath + '.stateName', {val: _nukiState.stateName, ack: true});
    adapter.setState(nukiPath + '.batteryCritical', {val: _nukiState.batteryCritical, ack: true});
    adapter.setState(nukiPath + '.lockAction', {val: 0, ack: true});

    if (_nukiState.hasOwnProperty('timestamp')) {
        adapter.setState(nukiPath + '.timestamp', {val: _nukiState.timestamp, ack: true});
    } else {
        adapter.setState(nukiPath + '.timestamp', {val: Date.timestamp, ack: true});
    }
}

function getLockState(_nukiId) {
    var lockStateUrl = 'http://' + bridgeIp + ':' + bridgePort + '/lockState?nukiId=' + _nukiId + '&token=' + bridgeToken;

    request(
        {
            url: lockStateUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug('lock state requested: ' + lockStateUrl);

            if (!error && response.statusCode == 200) {
                if (content && content.hasOwnProperty('success')) {
                    if (content.success) {
                        setLockState(_nukiId, content);
                    } else {
                        adapter.log.warn('Lock state has not been retrieved. Check if lock is connected to bridge and try again.');
                    }
                } else {
                    adapter.log.warn('Response has no valid content. Check IP address and try again.');
                }
            } else {
                adapter.log.error(error);
            }
        }
    )
}

function setLockAction(_nukiId, _action) {
    var lockActionUrl = 'http://' + bridgeIp + ':' + bridgePort + '/lockAction?nukiId=' + _nukiId + '&action=' + _action + '&token=' + bridgeToken;

    request(
        {
            url: lockActionUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug('lock action requested: ' + lockActionUrl);

            if (!error && response.statusCode == 200) {
                if (content && content.hasOwnProperty('success')) {
                    if (!content.success) {
                        adapter.log.warn('lock action ' + _action + ' not successfully set!');
                    } else {
                        adapter.log.info('lock action ' + _action + ' set successfully');
                    }
                } else {
                    adapter.log.warn('Response has no valid content. Check IP address and try again.');
                }
            } else {
                adapter.log.error(error);
            }
        }
    )
}

function getLockList() {
    var lockListUrl = 'http://' + bridgeIp + ':' + bridgePort + '/list?token='+ bridgeToken;

    request(
        {
            url: lockListUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.info('Lock list requested: ' + lockListUrl);

            if (!error && response.statusCode == 200) {
                if (content) {

                    adapter.setObjectNotExists(bridgeName, {
                        type: 'device',
                        common: {
                            name: bridgeIp
                        },
                        native: {}
                    });
                    
                    for (var nukilock in content) {
                        var obj = content[nukilock];

                        initNukiStates(obj);
                    }
                } else {
                    adapter.log.warn('Response has no valid content. Check IP address and try again.');
                }
            } else {
                adapter.log.error(error);
            }
        }
    )
}

function main() {
    bridgeIp = adapter.config.bridge_ip;
    bridgePort = adapter.config.bridge_port;
    bridgeToken = adapter.config.token;
    bridgeName = (adapter.config.bridge_name === "") ? bridgeIp.replace(/\./g, '_') : adapter.config.bridge_name.replace(/\./g, '_');

    if (bridgeIp != '') {   
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // adapter.config:
        adapter.log.debug('config Nuki bridge name: '   + bridgeName);
        adapter.log.debug('config IP address: '         + bridgeIp);
        adapter.log.debug('config port: '               + bridgePort);
        adapter.log.debug('config token: '              + bridgeToken);

        getLockList();
    }
}
