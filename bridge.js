/**
 *
 * nuki bridge functions
 *
 *
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const request = require('request');

import {adapter, hostIp, hostPort, forcePlainToken, timeOut} from './nuki';

export var bridge = {
    id      : '',
    type    : 0,
    HwId    : '',
    ip      : '',
    port    : 8080,
    token   : '',
    name    : 'Nuki bridge'
};
export var cb = {
    id      : '',
    host    : false,
    set     : false
};

export function get_token() {
    let apendix = '';

    if (forcePlainToken != '' || bridge.type != 1) {
        apendix = `token=${bridge.token}`
    } else {
        let ts = `${new Date().toISOString().substr(0, 19)}Z`; // YYY-MM-DDTHH:MM:SSZ
        let rnr = Math.floor(Math.random() * (65535-0) + 0); // Math.random() * (max - min) + min; // uint16 up to 65535
        let hash = crypto.createHash('sha256').update(`${ts},${rnr},${bridge.token}`).digest('hex');
        apendix = `ts=${ts}&rnr=${rnr}&hash=${hash}`;       
    }
    return apendix;
}

export function getBridgeInfo(_init) {
    let bridgeInfoUrl = `http://${bridge.ip}:${bridge.port}/info?${get_token()}`;

    if (bridge.ip === '' || bridge.port === 0) {
        adapter.log.warn('please specify IP and port of bridge');
        return;
    }

    request(
        {
            url: bridgeInfoUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.info(`Bridge Info requested: ${bridgeInfoUrl}`);

            if (error) {
                adapter.log.error(error);
                return;
            }

            if (response.statusCode != 200) {
                switch (response.statusCode) {
                    case 401:
                        adapter.log.error('Given token is invalid.');
                        break;

                    default:
                        adapter.log.error(`HTTP-response: ${response.statusCode}`);
                        break;
                }
                return;
            }

            if (content) {
                if (_init) {
                    bridge.type = content.bridgeType;
                    bridge.id = content.ids.serverId;
                    if (bridge.type === 1) {
                        bridge.HwId = content.ids.hardwareId.toString();
                    }

                    // initialize Nuki bridge
                    initBridgeStates();

                    if (content.hasOwnProperty('scanResults')) {
                        // initialize found Nuki devices
                        //updateAllLockStates(content.scanResults, _init);
                    }
                }
    
                setBridgeState(content);
            } else {
                adapter.log.error('Unable access the bridge with specified IP address and port.');
                
                // Nuki bridge discovery
                getBridgeList();
            }
        }
    )
}

export function getLockList(_init) {
    let lockListUrl = `http://${bridge.ip}:${bridge.port}/list?${get_token()}`;
   
    request(
        {
            url: lockListUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.info(`Lock list requested: ${lockListUrl}`);

            if (error) {
                adapter.log.error(error);
                return;
            }

            if (response.statusCode != 200) {
                switch (response.statusCode) {
                    case 401:
                        adapter.log.error('Given token is invalid.');
                        break;
                
                    default:
                        adapter.log.error(`HTTP-response: ${response.statusCode}`);
                        break;
                }
                return;
            }

            if (content) {
                //updateAllLockStates(content, _init);
            } else {
                adapter.log.warn('Response has no valid content. Check IP address and port and try again.');
            }
        }
    )

    if (_init) {
        // delay before next request
        await sleep(timeOut);

        // check for callbacks on Nuki bridge
        checkCallback(hostCb);
    }
}

function checkCallback() {
    let cbListUrl = `http://${bridge.ip}:${bridge.port}/callback/list?&${get_token()}`;
    let cbUrl = `http://${hostIp}:${hostPort}/api/nuki.${adapter.instance}`;
    let cbExists = false;
    let cbId = null;

    request(
        {
            url: cbListUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug(`Callback list requested: ${cbListUrl}`);

            if (error) {
                adapter.log.error(error);
                return;
            }

            if (response.statusCode != 200) {
                switch (response.statusCode) {
                    case 401:
                        adapter.log.error('Given token is invalid.');
                        break;
                
                    default:
                        adapter.log.error(`HTTP-response: ${response.statusCode}`);
                        break;
                }
                return;
            }

            if (content && content.hasOwnProperty('callbacks')) {
                for (let row in content.callbacks) {
                    cbId = content.callbacks[row];
                    if (cbId.url == cbUrl) {
                        cbExists = true;
                        if (cb.host === false) {
                            adapter.log.debug(`Callback will be removed: ${cbUrl}`);
                            removeCallback(cbId.id);
                            return;
                        }
                    } 
                }

                if (cb.host === true) {
                    if (cbId) {
                        cb.id = cbId.id;
                    } else {
                        cb.id = '0';
                    }
                    if (cbExists) {
                            cb.set = true;
                            adapter.log.info(`Callback allready set: ${cbUrl}`);
                            initServer(hostIp, hostPort);
                    } else {
                        if (cb.id == '3') {
                            cb.set = false;
                            adapter.log.warn('Too many Callbacks defined (3). First delete at least 1 Callback on your Nuki bridge.');
                        } else {
                            initServer(hostIp, hostPort);
                            setCallback(cbUrl);
                        }
                    }
                }
            } else {
                adapter.log.warn('Response has no valid content. Check IP address and try again.');
            }
        }
    )
}

async function removeCallback(_id) {
    let callbackRemoveUrl = `http://${bridge.ip}:${bridge.port}/callback/remove?id=${_id}&${get_token()}`;

    if (hostCb === false) {
        // delay before next request
        await sleep(timeOut);

        request(
            {
                url: callbackRemoveUrl,
                json: true
            },  
            function (error, response, content) {
                adapter.log.debug(`Callback removal requested: ${callbackRemoveUrl}`);

                if (error) {
                    adapter.log.error(error);
                    return;
                }
    
                if (response.statusCode != 200) {
                    switch (response.statusCode) {
                        case 400:
                            adapter.log.error('Given url is invalid or too long.');
                            break;
                    
                        case 401:
                            adapter.log.error('Given token is invalid.');
                            break;
                    
                        default:
                            adapter.log.error(`HTTP-response: ${response.statusCode}`);
                            break;
                    }
                    return;
                }
    
                if (content && content.hasOwnProperty('success')) {
                    if (content.success) {
                        cb.set = false;
                        adapter.log.info(`Callback-ID successfully removed: ${_id}`);
                    } else {
                        adapter.log.warn(`Callback-ID could not be removed: ${_id}`);
                        if (content.hasOwnProperty('message')) {
                            adapter.log.warn(content.message);
                        }
                    }
                } else {
                    adapter.log.warn('Response has no valid content. Check IP address and try again.');
                }
            }
        )
    }
}

async function setCallback(_url) {
    let callbackString = _url.replace(':', '%3A');
    callbackString = callbackString.replace('/', '%2F');
    let callbackAddUrl = `http://${bridge.ip}:${bridge.port}/callback/add?url=${callbackString}&${get_token()}`;
    
    if (hostCb === true) {
        // delay before next request
        await sleep(timeOut);

        request(
            {
                url: callbackAddUrl,
                json: true
            },  
            function (error, response, content) {
                adapter.log.debug(`Callback requested: ${callbackAddUrl}`);
                
                if (error) {
                    adapter.log.error(error);
                    return;
                }

                if (response.statusCode != 200) {
                    switch (response.statusCode) {
                        case 400:
                            adapter.log.error('Given url is invalid or too long.');
                            break;
                    
                        case 401:
                            adapter.log.error('Given token is invalid.');
                            break;
                    
                        default:
                            adapter.log.error(`HTTP-response: ${response.statusCode}`);
                            break;
                    }
                    return;
                }

                if (content && content.hasOwnProperty('success')) {
                    if (content.success) {
                        cb.set = true;
                        adapter.log.info(`Callback successfully set: ${_url}`);
                    } else {
                        adapter.log.warn(`Callback could not be set: ${_url}`);
                        if (content.hasOwnProperty('message')) {
                            adapter.log.warn(content.message);
                        }
                    }
                } else {
                    adapter.log.warn('Response has no valid content. Check IP address and try again.');
                }
            }
        ) 
    }
}

function initBridgeStates() {
    adapter.setObjectNotExists(`${bridge.id}`, {
        type: 'device',
        common: {
            name: bridge.name
        },
        native: {}
    });

    adapter.setObjectNotExists(`${bridge.id}.info`, {
        type: 'channel',
        common: {
            name: 'Info'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${bridge.id}.info.bridgeIp`, {
        type: 'state',
        common: {
            name: 'IP-Adresse',
            type: 'string',
            write: false,
            role: 'info.ip',
            def: bridge.ip
        },
        native: {}
    });

    adapter.setObjectNotExists(`${bridge.id}.info.bridgePort`, {
        type: 'state',
        common: {
            name: 'Port',
            type: 'string',
            write: false,
            role: 'info.port',
            def: bridge.port
        },
        native: {}
    });

    adapter.setObjectNotExists(`${bridge.id}.info.bridgeToken`, {
        type: 'state',
        common: {
            name: 'Token',
            type: 'string',
            write: false,
            role: 'text',
            def: bridge.token
        },
        native: {}
    });

    adapter.setObjectNotExists(`${bridge.id}.info.bridgeType`, {
        type: 'state',
        common: {
            name: 'Typ',
            type: 'number',
            write: false,
            states: {
                1: 'Hardware Bridge',
                2: 'Software Bridge',
            },
            role: 'value',
            def: bridge.type
        },
        native: {}
    });

    if (bridge.type === 1) {
        adapter.setObjectNotExists(`${bridge.id}.info.hardwareId`, {
            type: 'state',
            common: {
                name: 'HardwareID',
                type: 'string',
                write: false,
                role: 'info.serial',
                def: bridge.HwId
            },
            native: {}
        });
        
        adapter.setObjectNotExists(`${bridge.id}.info.firmwareVersion`, {
            type: 'state',
            common: {
                name: 'Firmware',
                type: 'string',
                write: false,
                role: 'info.firmware'
            },
            native: {}
        });

        adapter.setObjectNotExists(`${bridge.id}.info.wifiFirmwareVersion`, {
            type: 'state',
            common: {
                name: 'WiFi Firmware',
                type: 'string',
                write: false,
                role: 'info.firmware'
            },
            native: {}
        });
    } else {
        adapter.setObjectNotExists(`${bridge.id}.info.appVersion`, {
            type: 'state',
            common: {
                name: 'App Version',
                type: 'string',
                write: false,
                role: 'info.firmware'
            },
            native: {}
        });
    }

    adapter.setObjectNotExists(`${bridge.id}.info.uptime`, {
        type: 'state',
        common: {
            name: 'Betriebszeit der Bridge in Sekunden',
            type: 'number',
            write: false,
            role: 'date'
        },
        native: {}
    });
    
    adapter.setObjectNotExists(`${bridge.id}.info.serverConnected`, {
        type: 'state',
        common: {
            name: 'Verbunden mit Nuki-Server',
            type: 'boolean,',
            write: false,
            role: 'indicator.reachable'
        },
        native: {}
    });
    
    adapter.setObjectNotExists(`${bridge.id}.info.timestamp`, {
        type: 'state',
        common: {
            name: 'Zuletzt aktualisiert',
            type: 'string',
            write: false,
            role: 'date'
        },
        native: {}
    });
}

function setBridgeState(_content) {
    let versions = _content.versions;

    if (bridge.type === 1) {
        // set firmware version
        adapter.setState(`${bridge.id}.info.firmwareVersion`, {val: versions.firmwareVersion, ack: true});
        // set WiFi firmware version
        adapter.setState(`${bridge.id}.info.wifiFirmwareVersion`, {val: versions.wifiFirmwareVersion, ack: true});
    } else if (bridge.type === 2) {
        // set app version
        adapter.setState(`${bridge.id}.info.appVersion`, {val: versions.appVersion, ack: true});
    }

    // set uptime
    adapter.setState(`${bridge.id}.info.uptime`, {val: _content.uptime, ack: true});

    // set connetion state
    adapter.setState(`${bridge.id}.info.serverConnected`, {val: _content.serverConnected, ack: true});

    // set timestamp
    adapter.setState(`${bridge.id}.info.timestamp`, {val: _content.currentTime, ack: true});

    if (_content.hasOwnProperty('scanResults')) {
        // initialize found Nuki devices
        //updateAllLockStates(_content.scanResults, false);
    }
}

function getBridgeList() {
    let bridgeListUrl = 'https://api.nuki.io/discover/bridges';
    let obj = null;

    request(
        {
            url: bridgeListUrl,
            json: true
        },  
        function (error, response, content) {
            adapter.log.debug(`Bridge list requested: ${bridgeListUrl}`);

            if (error) {
                adapter.log.error(error);
                return;
            }

            if (response.statusCode != 200) {
                adapter.log.error(`HTTP-response: ${response.statusCode}`);
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

            for (let bridgeNr in content.bridges) {
                obj = content.bridges[bridgeNr];
                if (!obj) {
                    adapter.log.warn('Bridge respose has not been retrieved. Check if bridge ist plugged in and active and try again.');
                    return;
                }

                if (obj.hasOwnProperty('ip')) {
                    if (obj.ip === bridge.ip) {
                        // found bridge
                        bridge.id   = obj.bridgeId;
                        bridge.type = 1;
                        if (obj.port == bridge.port) {
                            // correct port
                            adapter.log.info(`found hardware bridge: ${bridge.id} (IP: ${bridge.ip}; Port: ${bridge.port})`);
                        } else {
                            // different port
                            adapter.log.warn(`found hardware bridge (ID: ${bridge.id}; IP: ${obj.ip}) has different port than specified! (specified: ${bridge.port}; actual: ${obj.port}). Please specify correct port of bridge.`);
                        }
                    } else if (obj.ip === '0.0.0.0' || obj.ip === '') {
                        adapter.log.warn(`bridgeID ${obj.bridgeId}: no auto discovery possible. Has the HTTP API been activated and the token been set?`);
                    } else {
                        adapter.log.info(`found another hardware bridge: ${obj.bridgeId} (IP: ${obj.ip}; Port: ${obj.port})`);
                    }
                } else {
                    // software bridge: doesn't come with IP
                    if (bridge.id === '') {
                        bridge.id   = obj.bridgeId;
                        bridge.type = 2;

                        adapter.log.info(`found software bridge: ${obj.bridgeId}`);
                    } else {
                        adapter.log.info(`found another software bridge: ${obj.bridgeId}`);
                    }
                }
            }

            if (bridge.id == '') {
                adapter.log.error('no bridge has been found');
                return;
            }
        }
    )
}
