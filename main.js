/**
 *
 * nuki adapter
 *
 *
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils = require('@iobroker/adapter-core'); // Get common adapter utils
var express     = require('express');        // call express
var bodyParser  = require("body-parser");
var request     = require('request');

// REST server
var app     = express();
var timer   = null;
var ipInfo  = require('ip');
var hostIp  = ipInfo.address();

// Global variables
var bridgeId    = null;
var bridgeType  = null;
var bridgeIp    = null;
var bridgePort  = null;
var bridgeToken = null;
var bridgeName  = null;
var interval    = null;
var hostCb      = null;
var cbSet       = false;
var callbackId  = null;
var hostPort    = null;
var timeOut     = 3000;

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
//var adapter = new utils.Adapter('nuki');
let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {name: 'nuki'});
    adapter = new utils.Adapter(options);

    //adapter.log.debug('Adapter generated');
    
//    adapter.useFormatDate = true;   // load from ;system.config the global date format

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
        // delay before request
        setTimeout(function() {
            main();
        }, timeOut);
    });

    // is called when adapter shuts down - callback has to be called under any circumstances!
    adapter.on('unload', function (callback) {
        try {
            if (timer) clearInterval(timer);
            if (cbSet) {
                hostCb = false;
                removeCallback(callbackId);
            }
            adapter.log.info('cleaned everything up...');
            // setTimeout(function() {
                callback();
            // }, timeOut); 
        } catch (e) {
            callback();
        }
    });

    // is called if a subscribed object changes
    adapter.on('objectChange', function (id, obj) {
        // Warning, obj can be null if it was deleted
        adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
    });

    // is called if a subscribed state changes
    adapter.on('stateChange', function (id, state) {
        var path = id.split('.',5);
        var nukiId = path[2];
        var actionState = path[4];

        // Warning, state can be null if it was deleted
        adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

        // you can use the ack flag to detect if it is status (true) or command (false)
        if (state && !state.ack) {
            if (actionState == 'action') {
                setLockAction(nukiId, state.val);
            } else {
                if (state.val == false) {
                    if (actionState == 'lockAction') {
                        setLockAction(nukiId, '2');
                    } else if (actionState == 'rtoAction') {
                        setLockAction(nukiId, '2');
                    }
                } else {
                    switch (actionState) {
                        case 'lockAction':
                            // fall through
                        case 'rtoAction':
                            setLockAction(nukiId, '1');
                            break;
                        case 'openAction':
                            setLockAction(nukiId, '3');
                            break;
                        case 'unlockLocknGoAction':
                            // fall through
                        case 'cmActiveAction':
                            setLockAction(nukiId, '4');
                            break;
                        case 'openLocknGoAction':
                            // fall through
                        case 'cmDeactiveAction':
                            setLockAction(nukiId, '5');
                            break;
                        default:
                            adapter.log.warn('unrecognized actionState (' + actionState + ')');
                            break;
                    }
                }
            }
        }
    });

    return adapter;
};

function initBridgeStates(_name, _token) {

    adapter.setObjectNotExists(bridgeId, {
        type: 'device',
        common: {
            name: _name
        },
        native: {}
    });

    adapter.setObjectNotExists(bridgeId + '.info', {
        type: 'channel',
        common: {
            name: 'Info'
        },
        native: {}
    });

    adapter.setObjectNotExists(bridgeId + '.info.bridgeType', {
        type: 'state',
        common: {
            name: 'Typ',
            type: 'string',
            write: false,
            states: {
                '1': 'Hardware Bridge',
                '2': 'Software Bridge',
            },
            def: bridgeType,
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(bridgeId + '.info.bridgeIp', {
        type: 'state',
        common: {
            name: 'IP-Adresse',
            type: 'string',
            write: false,
            role: 'info.ip',
            def: bridgeIp
        },
        native: {}
    });

    adapter.setObjectNotExists(bridgeId + '.info.bridgePort', {
        type: 'state',
        common: {
            name: 'Port',
            type: 'number',
            write: false,
            role: 'info.port',
            def: bridgePort
        },
        native: {}
    });

    adapter.setObjectNotExists(bridgeId + '.info.bridgeToken', {
        type: 'state',
        common: {
            name: 'Token',
            type: 'string',
            write: false,
            role: 'text',
            def: _token
        },
        native: {}
    });
}

function initNukiLockStates(_obj) {
    var nukiState = _obj.lastKnownState;
    var deviceType = 0;
    //var nukiPath = bridgeId + '.' + _obj.nukiId;

    if (_obj.hasOwnProperty('deviceType')) {
        deviceType = _obj.deviceType;
    }

    if (deviceType != 2 && deviceType != 1) {
        deviceType = 0;
    }
    
    // device
    adapter.setObjectNotExists(_obj.nukiId, {
        type: 'device',
        common: {
            name: _obj.name
        },
        native: {}
    });

    // device info
    adapter.setObjectNotExists(_obj.nukiId + '.info', {
        type: 'channel',
        /* parent: _obj.nukiId,
        children: [
            _obj.nukiId + '.info.deviceType',
            _obj.nukiId + '.info.batteryCritical'                     
        ], */
        common: {
            name: 'Information'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.info.deviceType', {
        type: 'state',
        // parent: _obj.nukiId + '.info',
        common: {
            name: 'Typ',
            type: 'string',
            write: false,
            states: {
                '0': 'Lock',
                '1': 'unknown device',
                '2': 'Opener',
            },
            def: deviceType,
            role: 'value'
        },
        native: {}
    });

    // adapter.setState(_obj.nukiId + '.info.deviceType', {val: deviceType, ack: true});

    adapter.setObjectNotExists(_obj.nukiId + '.info.batteryCritical', {
        type: 'state',
        // parent: _obj.nukiId + '.info',
        common: {
            name: 'Batterie schwach',
            type: 'boolean',
            write: false,
            role: 'indicator.lowbat'
        },
        native: {}
    });
    
    // states
    adapter.setObjectNotExists(_obj.nukiId + '.states', {
        type: 'channel',
        /* parent: _obj.nukiId,
        children: [
            _obj.nukiId + '.states.lockState',
            _obj.nukiId + '.states.state',            
            _obj.nukiId + '.states.timestamp'                    
        ], */
        common: {
            name: 'Status'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.states.lockState', {
        type: 'state',
        // parent: _obj.nukiId + '.states',
        common: {
            name: 'Nuki aufgeschlossen',
            type: 'boolean',
            write: false,
            role: 'sensor.lock'   
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.states.state', {
        type: 'state',
        // parent: _obj.nukiId + '.states',
        common: {
            name: 'Status',
            type: 'number',
            write: false,
            states: {
                '0': 'uncalibrated',
                '1': 'locked',
                '2': 'unlocking',
                '3': 'unlocked',
                '4': 'locking',
                '5': 'unlatched',
                '6': 'unlocked (lock n go)',
                '7': 'unlatching',
                '254': 'motor blocked',
                '255': 'undefined',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.states.timestamp', {
        type: 'state',
        // parent: _obj.nukiId + '.states',
        common: {
            name: 'Zuletzt aktualisiert',
            type: 'string',
            write: false,
            role: 'date'
        },
        native: {}
    });

    // actions
    adapter.setObjectNotExists(_obj.nukiId + '.actions', {
        type: 'channel',
        /* parent: _obj.nukiId,
        children: [
            _obj.nukiId + '.actions.action',
            _obj.nukiId + '.actions.lockAction',
            _obj.nukiId + '.actions.openAction',
            _obj.nukiId + '.actions.unlockLocknGoAction',            
            _obj.nukiId + '.actions.openLocknGoAction'                    
        ], */
        common: {
            name: 'Aktionen'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.action', {
        type: 'state',
        // parent: _obj.nukiId + '.actions',
        common: {
            name: 'Aktion',
            type: 'number',
            states: {
                '0': '',
                '1': 'unlock',
                '2': 'lock',
                '3': 'unlatch',
                '4': 'lock‘n’go',
                '5': 'lock‘n’go with unlatch',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.lockAction', {
        type: 'state',
        // parent: _obj.nukiId + '.actions',
        common: {
            name: 'Tür auf-/abschließen',
            type: 'boolean',
            write: true,
            role: 'switch.lock.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.openAction', {
        type: 'state', 
        // parent: _obj.nukiId + '.actions',
        common: {
            name:  'Tür öffnen',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.unlockLocknGoAction', {
        type: 'state', 
        // parent: _obj.nukiId + '.actions',
        common: {
            name:  'Tür aufschließen (lock‘n’go)',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.openLocknGoAction', {
        type: 'state', 
        // parent: _obj.nukiId + '.actions',
        common: {
            name:  'Tür öffnen (lock‘n’go)',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    // listen to changes
    adapter.subscribeStates(_obj.nukiId + '.actions.*Action');
    adapter.subscribeStates(_obj.nukiId + '.actions.action');
    adapter.subscribeStates(_obj.nukiId + '.info.batteryCritical');

    // set states
    setLockState(_obj.nukiId, nukiState);
}

function initNukiOpenerStates(_obj) {
    var nukiState = _obj.lastKnownState;
    var deviceType = 2;
    //var nukiPath = bridgeId + '.' + _obj.nukiId;

    if (_obj.hasOwnProperty('deviceType')) {
        deviceType = _obj.deviceType;
    }
    
    if (deviceType != 0 && deviceType != 1) {
        deviceType = 2;
    }
    
    // device info
    adapter.setObjectNotExists(_obj.nukiId + '.info', {
        type: 'channel',
        /* parent: _obj.nukiId,
        children: [
            _obj.nukiId + '.info.deviceType',
            _obj.nukiId + '.info.batteryCritical'                     
        ], */
        common: {
            name: 'Information'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.info.deviceType', {
        type: 'state',
        // parent: _obj.nukiId + '.info',
        common: {
            name: 'Typ',
            type: 'string',
            write: false,
            states: {
                '0': 'Lock',
                '1': 'unknown device',
                '2': 'Opener',
            },
            def : deviceType,
            role: 'value'
        },
        native: {}
    });

    // adapter.setState(_obj.nukiId + '.info.deviceType', {val: deviceType, ack: true});

    adapter.setObjectNotExists(_obj.nukiId + '.info.batteryCritical', {
        type: 'state',
        // parent: _obj.nukiId + '.info',
        common: {
            name: 'Batterie schwach',
            type: 'boolean',
            write: false,
            role: 'indicator.lowbat'
        },
        native: {}
    });
    
    // states
    adapter.setObjectNotExists(_obj.nukiId + '.states', {
        type: 'channel',
        /* parent: _obj.nukiId,
        children: [
            _obj.nukiId + '.states.lockState',
            _obj.nukiId + '.states.state',            
            _obj.nukiId + '.states.timestamp'                    
        ], */
        common: {
            name: 'Status'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.states.lockState', {
        type: 'state',
        // parent: _obj.nukiId + '.states',
        common: {
            name: 'Ring to Open aktiv',
            type: 'boolean',
            write: false,
            role: 'sensor.lock'   
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.states.state', {
        type: 'state',
        // parent: _obj.nukiId + '.states',
        common: {
            name: 'Status',
            type: 'number',
            write: false,
            states: {
                '0': 'untrained',
                '1': 'online',
                '3': 'rto active',
                '5': 'open',
                '7': 'opening',
                '253': 'boot run',
                '255': 'undefined',
            },
            role: 'value'
        },
        native: {}
    });
    
    adapter.setObjectNotExists(_obj.nukiId + '.states.timestamp', {
        type: 'state',
        // parent: _obj.nukiId + '.states',
        common: {
            name: 'Zuletzt aktualisiert',
            type: 'string',
            write: false,
            role: 'date'
        },
        native: {}
    });

    // actions
    adapter.setObjectNotExists(_obj.nukiId + '.actions', {
        type: 'channel',
        /* parent: _obj.nukiId,
        children: [
            _obj.nukiId + '.actions.action',
            _obj.nukiId + '.actions.rtoAction',
            _obj.nukiId + '.actions.openAction',
            _obj.nukiId + '.actions.cmActiveAction',            
            _obj.nukiId + '.actions.cmDeactiveAction'                    
        ], */
        common: {
            name: 'Aktionen'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.action', {
        type: 'state',
        // parent: _obj.nukiId + '.actions',
        common: {
            name: 'Aktion',
            type: 'number',
            states: {
                '0': '',
                '1': 'activate rto',
                '2': 'deactivate rto',
                '3': 'electric strike actuation',
                '4': 'activate continuous mode',
                '5': 'deactivate continuous mode',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.rtoAction', {
        type: 'state',
        // parent: _obj.nukiId + '.actions',
        common: {
            name: 'Ring to Open de-/aktivieren',
            type: 'boolean',
            write: true,
            role: 'switch.lock.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.openAction', {
        type: 'state', 
        // parent: _obj.nukiId + '.actions',
        common: {
            name:  'öffnen',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.cmActiveAction', {
        type: 'state', 
        // parent: _obj.nukiId + '.actions',
        common: {
            name:  'Dauermodus einschalten',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(_obj.nukiId + '.actions.cmDeactiveAction', {
        type: 'state', 
        // parent: _obj.nukiId + '.actions',
        common: {
            name:  'Dauermodus ausschalten',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    // listen to changes
    adapter.subscribeStates(_obj.nukiId + '.actions.*Action');
    adapter.subscribeStates(_obj.nukiId + '.actions.action');
    adapter.subscribeStates(_obj.nukiId + '.info.batteryCritical');

    // set states
    setLockState(_obj.nukiId, nukiState);
}

/* function setBridgeState(_obj, _token) {
    adapter.setState(bridgeId + '.info.bridgeIp', bridgeIp, true);
    adapter.setState(bridgeId + '.info.bridgePort', bridgePort, true);
    adapter.setState(bridgeId + '.info.bridgeToken', _token, true);
} */

function setLockState(_nukiId, _nukiState) {
    //var nukiPath = bridgeId + '.' + _nukiId;
    var deviceType = 0;
    let timeStamp = null;
    
    if (_nukiId.hasOwnProperty('deviceType')) {
        deviceType = _nukiId.deviceType;
    }
    
    // set action and lock state
    if (_nukiState != null) {
        switch(_nukiState.state) {
            case 1:
                // fall through
            case 4:
                adapter.setState(_nukiId + '.states.lockState', {val: false, ack: true});
                if (deviceType == 0) {
                    adapter.setState(_nukiId + '.actions.lockAction', {val: false, ack: true}); 
                } else if (deviceType == 2) {
                    adapter.setState(_nukiId + '.actions.rtoAction', {val: false, ack: true});
                } else {
                    adapter.setState(_nukiId + '.actions.lockAction', {val: false, ack: true});
                }
                setTimeout(function() {
                    adapter.setState(_nukiId + '.actions.action', {val: 0, ack: true});
                }, timeOut);
                break;
            case 2:
                // fall through
            case 3:
                // fall through
            case 5:
                // fall through
            case 6:
                // fall through
            case 7:
                adapter.setState(_nukiId + '.states.lockState', {val: true, ack: true});
                if (deviceType == 0) {
                    adapter.setState(_nukiId + '.actions.lockAction', {val: true, ack: true});
                } else if (deviceType == 2) {
                    adapter.setState(_nukiId + '.actions.rtoAction', {val: true, ack: true});
                } else {
                    adapter.setState(_nukiId + '.actions.lockAction', {val: true, ack: true});
                }
                setTimeout(function() {
                    adapter.setState(_nukiId + '.actions.action', {val: 0, ack: true});
                }, timeOut);
                break;
            default:
                adapter.setState(_nukiId + '.states.lockState', {val: true, ack: true});
                if (deviceType == 0) {
                    adapter.setState(_nukiId + '.actions.lockAction', {val: true, ack: true});
                } else if (deviceType == 2) {
                    adapter.setState(_nukiId + '.actions.rtoAction', {val: true, ack: true});
                } else {
                    adapter.setState(_nukiId + '.actions.lockAction', {val: true, ack: true});
                }
                adapter.setState(_nukiId + '.actions.action', {val: 0, ack: true});
                break;
        } 
            
        // set device type
        adapter.setState(_nukiId + '.info.deviceType', {val: deviceType, ack: true});
        // set status
        adapter.setState(_nukiId + '.states.state', {val: _nukiState.state, ack: true});
        // set battery status
        adapter.setState(_nukiId + '.info.batteryCritical', {val: _nukiState.batteryCritical, ack: true});
        // set timestamp
        if (_nukiState.hasOwnProperty('timestamp')) {
            adapter.setState(_nukiId + '.states.timestamp', {val: _nukiState.timestamp, ack: true});
        } else {
            timeStamp = new Date();
            adapter.setState(_nukiId + '.states.timestamp', {val: timeStamp, ack: true});
        }
    }
}

function updateAllLockStates(_content, _init) {
    var nukiState  = null;
    var obj        = null;
    
    if (_init) {
        for (var nukilock in _content) {
            obj = _content[nukilock];

            if (obj.hasOwnProperty('deviceType')) {
                switch(obj.deviceType) {
                    case 0:
                        initNukiLockStates(obj);
                        break;
                    case 2:
                        initNukiOpenerStates(obj);
                        break;
                }
            } else {
                initNukiLockStates(obj);
                break;
            }
        }
    } else {
        for (var nukilock in _content) {
            obj = _content[nukilock];
            nukiState = obj.lastKnownState;

            setLockState(obj.nukiId, nukiState);
        }
    }
}

function getLockState(_nukiId) {
    var deviceType = adapter.getState(adapter.name+'.'+adapter.instance+'.'+_nukiId+'.info.deviceType', function (err, state) { return state.val; });
    var lockStateUrl = null;

    if (deviceType != 2 && deviceType != 0) {
        lockStateUrl = 'http://' + bridgeIp + ':' + bridgePort + '/lockState?nukiId=' + _nukiId  + '&token=' + bridgeToken;
    } else {
        lockStateUrl = 'http://' + bridgeIp + ':' + bridgePort + '/lockState?nukiId=' + _nukiId + '&deviceType=' + deviceType + '&token=' + bridgeToken;
    }

    request(
        {
            url: lockStateUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug('state requested: ' + lockStateUrl);

            if (!error && response.statusCode == 200) {
                if (content && content.hasOwnProperty('success')) {
                    if (content.success) {
                        setLockState(_nukiId, content);
                    } else {
                        adapter.log.warn('State has not been retrieved. Check if device is connected to bridge and try again.');
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
    var deviceType = adapter.getState(adapter.name+'.'+adapter.instance+'.'+_nukiId+'.info.deviceType', function (err, state) { return state.val; }); 
    var lockActionUrl = null;

    if (deviceType != 2 && deviceType != 0) {
        lockActionUrl = 'http://' + bridgeIp + ':' + bridgePort + '/lockAction?nukiId=' + _nukiId + '&action=' + _action + '&token=' + bridgeToken;
    } else {
        lockActionUrl = 'http://' + bridgeIp + ':' + bridgePort + '/lockAction?nukiId=' + _nukiId + '&deviceType=' + deviceType + '&action=' + _action + '&token=' + bridgeToken;
    }

    request(
        {
            url: lockActionUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug('action requested: ' + lockActionUrl);

            if (!error && response.statusCode == 200) {
                if (content && content.hasOwnProperty('success')) {
                    if (!content.success) {
                        adapter.log.warn('action ' + _action + ' not successfully set!');
                    } else {
                        adapter.log.info('action ' + _action + ' set successfully');   
                        if (hostCb == false) {                  
                            // delay before request
                            setTimeout(function() {
                                getLockState(_nukiId);
                            }, timeOut);
                        } else {

                        }
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

function getBridgeList() {
    var bridgeListUrl = 'https://api.nuki.io/discover/bridges';
    var obj = null;

    if (adapter.config.bridge_ip == '' || adapter.config.bridge_port == '') {
        adapter.log.warn('please specify IP and port of bridge');
        return;
    }

    request(
        {
            url: bridgeListUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug('Bridge list requested: ' + bridgeListUrl);

            if (error || response.statusCode != 200) {
                adapter.log.error(error);
                return;
            }

            if (!content || !content.hasOwnProperty('errorCode')) {
                adapter.log.warn('Response has no valid content. Check if bridge ist pluged in and active and try again.');
                return;
            }

            if (content.errorCode != 0) {
                adapter.log.warn('Bridge respose has not been retrieved. Check if bridge ist pluged in and active and try again.');
                return;
            }

            for (var bridge in content.bridges) {
                obj = content.bridges[bridge];
                if (!obj) {
                    adapter.log.warn('Bridge respose has not been retrieved. Check if bridge ist pluged in and active and try again.');
                    return;
                }

                if (obj.hasOwnProperty('ip')) {
                    if (obj.ip == bridgeIp) {
                        // found bridge
                        bridgeId   = obj.bridgeId;
                        bridgeType = 1;
                        if (obj.port == bridgePort) {
                            // correct port
                            adapter.log.info('found hardware bridge: ' + bridgeId + ' (IP: ' + bridgeIp + '; Port: ' + bridgePort + ')');
                        } else {
                            // different port
                            adapter.log.warn('found hardware bridge (ID: ' + bridgeId + '; IP: ' + obj.ip + ') has different port than specified! (specified: ' + 
                            bridgePort + '; actual: ' + obj.port + '). Please specify correct port of bridge.');
                        }
                    } else if (obj.ip == '0.0.0.0' || obj.ip == '') {
                        adapter.log.warn('bridgeID ' + obj.bridgeId + ': no auto discovery possible. Has the HTTP API been activated and the token been set?');
                    } else {
                        adapter.log.info('found another hardware bridge: ' + obj.bridgeId + ' (IP: ' + obj.ip + '; Port: ' + obj.port + ')');
                    }
                } else {
                    // software bridge: doesn't come with IP
                    if (bridgeId == '' || bridgeId == null) {
                        bridgeId   = obj.bridgeId;
                        bridgeType = 2;
                    }
                    adapter.log.info('found software bridge: ' + obj.bridgeId);
                }
            }

            if (bridgeId == '' || bridgeId == null) {
                adapter.log.error('no bridge has been found');
                return;
            }
            initBridgeStates(bridgeName, bridgeToken);
        }
    )
}

function getLockList(_init) {
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
                    updateAllLockStates(content, _init);
                } else {
                    adapter.log.warn('Response has no valid content. Check IP address and try again.');
                }
            } else {
                adapter.log.error(error);
            }
        }
    )
    if (_init) {
        // delay before request
        setTimeout(function() {
            // check for callbacks on Nuki bridge
            checkCallback(hostCb);
        }, timeOut);
    }
}

function initServer(_ip, _port) {
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

    // routes will go here
    app.get('/api/:key', function(req, res) {
        res.send('Hello ' + req.params.key + ' ;-)');
    });

    // POST parameters sent with 
    app.post('/api/nuki.' + adapter.instance, function(req, res) {
        var nukiId = req.body.nukiId;
        var state = req.body.state;
        var stateName = req.body.stateName;
        var batteryCritical = req.body.batteryCritical;
        var nukiState = { "state": state, "stateName": stateName, "batteryCritical": batteryCritical };

        try {
            adapter.log.info('status change received for NukiID ' + nukiId + ': ' + nukiState.stateName);
            adapter.log.info('battery status received for NukiID ' + nukiId + ': ' + nukiState.batteryCritical);
            setLockState(nukiId, nukiState);

            res.sendStatus(200);
        } catch (e) {
            res.sendStatus(500);
			adapter.log.warn(e.message);
        }
    });

    // start the server
    app.listen(_port, _ip);
    adapter.log.info('Server listening to http://' + _ip + ':' + _port);
}

function checkCallback(_hostCb) {
    var cbListUrl = 'http://' + bridgeIp + ':' + bridgePort + '/callback/list?&token=' + bridgeToken;
    var cbUrl = 'http://' + hostIp + ':' + hostPort + '/api/nuki.' + adapter.instance;
    var cbExists = false;
    var cbId = null;

    request(
        {
            url: cbListUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug('Callback list requested: ' + cbListUrl);

            if (!error && response.statusCode == 200) {
                if (content && content.hasOwnProperty('callbacks')) {
                    for (var row in content.callbacks) {
                        cbId = content.callbacks[row];
                        if (cbId.url == cbUrl) {
                            cbExists = true;
                            if (_hostCb == false) {
                                adapter.log.debug('Callback should be removed: ' + cbUrl);
                                // delay after request
                                setTimeout(function() {
                                    removeCallback(cbId.id);
                                }, timeOut);
                            }
                        } 
                    }
                    if (_hostCb == true) {
                        if (cbId) {
                            callbackId = cbId.id;
                        } else {
                            callbackId = '0';
                        }
                        if (cbExists) {
                                cbSet = true;
                                adapter.log.info('Callback allready set: ' + cbUrl);
                                initServer(hostIp, hostPort);
                        } else {
                            if (callbackId == '3') {
                                cbSet = false;
                                adapter.log.warn('Too many Callbacks defined (3). First delete at least 1 Callback on your Nuki bridge.');
                            } else {
                                cbSet = true;
                                initServer(hostIp, hostPort);
                                // delay after request
                                setTimeout(function() {
                                    setCallback(cbUrl);
                                }, timeOut);
                            }
                        }
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

function removeCallback(_id) {
    var callbackRemoveUrl = 'http://' + bridgeIp + ':' + bridgePort + '/callback/remove?id=' + _id + '&token=' + bridgeToken;

    if (hostCb == false) {
        request(
            {
                url: callbackRemoveUrl,
                json: true
            },  
            function (error, response, content) {
                adapter.log.debug('Callback removal requested: ' + callbackRemoveUrl);

                if (!error && response.statusCode == 200) {
                    if (content && content.hasOwnProperty('success')) {
                        if (content.success) {
                            cbSet = false;
                            adapter.log.info('Callback-ID successfully removed: ' + _id);
                        } else {
                            adapter.log.warn('Callback-ID could not be removed: ' + _id);
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
}

function setCallback(_url) {
    var callbackString = _url.replace(':', '%3A');
    callbackString = callbackString.replace('/', '%2F');
    var callbackAddUrl = 'http://' + bridgeIp + ':' + bridgePort + '/callback/add?url=' + callbackString + '&token=' + bridgeToken;
    
    if (hostCb == true) {
        request(
            {
                url: callbackAddUrl,
                json: true
            },  
            function (error, response, content) {
                adapter.log.debug('Callback requested: ' + callbackAddUrl);

                if (!error && response.statusCode == 200) {
                    if (content && content.hasOwnProperty('success')) {
                        if (content.success) {
                            adapter.log.info('Callback successfully set: ' + _url);
                        } else {
                            adapter.log.warn('Callback could not be set: ' + _url);
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
}

function main() {
    bridgeIp = adapter.config.bridge_ip;
    bridgePort = adapter.config.bridge_port;
    bridgeToken = adapter.config.token;
    bridgeName = (adapter.config.bridge_name === "") ? bridgeIp.replace(/\./g, '_') : adapter.config.bridge_name.replace(/\./g, '_');
    interval = adapter.config.interval * 60000;
    hostPort = adapter.config.host_port;
    hostCb = adapter.config.host_cb;

    if (bridgeIp != '') {
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // adapter.config:
        adapter.log.debug('config Nuki bridge name: '   + bridgeName);
        adapter.log.debug('config IP address: '         + bridgeIp);
        adapter.log.debug('config port: '               + bridgePort);
        adapter.log.debug('config token: '              + bridgeToken);

        // delay before request
        setTimeout(function() {
            // get Nuki bridge
            getBridgeList();
        }, timeOut);
        
        // delay before request
        setTimeout(function() {
            // get all Nuki devices on bridge
            getLockList(true);

            if (adapter.config.autoupd) {
                adapter.log.debug('timer set: ' + interval + ' milliseconds');
                // update all states every x milliseconds
                timer = setInterval(getLockList, interval);
            }
        }, timeOut);
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
    //adapter.log.debug('Adapter started in compact mode');
} else {
    // or start the instance directly
    startAdapter();
    //adapter.log.debug('Adapter started in normal mode');
}
