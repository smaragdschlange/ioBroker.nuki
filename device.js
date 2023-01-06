/**
 *
 * nuki device functions
 *
 *
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

import {adapter, timeOut} from './nuki';

// Nuki device (common)
export class nukiDevice {
    constructor(nukiId, deviceType) {
        let device = null;

        this.id = nukiId;
        if (deviceType) {
            this.type = deviceType;
        } else {
            this.type = 1;
        };
        this.state =  {
            mode: 2,
            state: 255,
            stateName: '',
            batteryCritical: false
        };

        switch (this.type) {
            case 0:
                device = new nukiLock(nukiId, this.type);
                break;
            case 2:
                device = new nukiOpener(nukiId, this.type);
                break;
            case 3:
                device = new nukiSmartDoor(nukiId, this.type);
                break;
            case 4:
                device = new nukiLock3(nukiId, this.type);
                break;
            default:
                adapter.log.error(`Unknown device type (${this.type}). Setting minimal states.`);
                device = this;
                break;
        };

        return device;
    }

    initStates(scanResult) {
        // device
        adapter.setObjectNotExists(`${this.id}`, {
            type: 'device',
            common: {
                name: scanResult.name
            },
            native: {}
        });

        // name
        adapter.setObjectNotExists(`${this.id}.name`, {
            type: 'state',
            common: {
                name: 'Name',
                type: 'string',
                write: false,
                role: 'info.name'
            },
            native: {}
        });

        // device info
        adapter.setObjectNotExists(`${this.id}.info`, {
            type: 'channel',
            common: {
                name: 'Information'
            },
            native: {}
        });

        // device states
        adapter.setObjectNotExists(`${this.id}.states`, {
            type: 'channel',
            common: {
                name: 'Status'
            },
            native: {}
        });

        // device actions
        adapter.setObjectNotExists(`${this.id}.actions`, {
            type: 'channel',
            common: {
                name: 'Aktionen'
            },
            native: {}
        });

        // device type
        adapter.setObjectNotExists(`${this.id}.info.deviceType`, {
            type: 'state',
            common: {
                name: 'Typ',
                type: 'number',
                write: false,
                states: {
                    0: 'Nuki Smart Lock 1.0/2.0',
                    1: 'unknown device',
                    2: 'Nuki Opener',
                    3: 'Nuki Smart Door',
                    4: 'Nuki Smart Lock 3.0 (Pro)',
                },
                def:  this.type,
                role: 'value'
            },
            native: {}
        });

        // firmware version
        adapter.setObjectNotExists(`${this.id}.info.firmwareVersion`, {
            type: 'state',
            common: {
                name: 'Firmware',
                type: 'string',
                write: false,
                role: 'text'
            },
            native: {}
        });
    
        // battery indicator
        adapter.setObjectNotExists(`${this.id}.info.batteryCritical`, {
            type: 'state',
            common: {
                name: 'Batterie schwach',
                type: 'boolean',
                write: false,
                role: 'indicator.maintenance.lowbat'
            },
            native: {}
        });

        // rssi
        adapter.setObjectNotExists(`${this.id}.info.rssi`, {
            type: 'state',
            common: {
                name: 'RSSI-Wert',
                type: 'number',
                write: false,
                def:  scanResult.rssi,
                role: 'value'
            },
            native: {}
        });

        // paired
        adapter.setObjectNotExists(`${this.id}.info.paired`, {
            type: 'state',
            common: {
                name: 'Pairing mit der Bridge',
                type: 'boolean',
                write: false,
                def:  scanResult.paired,
                role: 'indicator.reachable'
            },
            native: {}
        });

        // timestamp
        adapter.setObjectNotExists(`${this.id}.states.timestamp`, {
            type: 'state',
            common: {
                name: 'Zuletzt aktualisiert',
                type: 'string',
                write: false,
                role: 'date'
            },
            native: {}
        });

        // listen to changes
        adapter.subscribeStates(`${this.id}.info.batteryCritical`);
    }

    setState(nukiState) {
        this.state = nukiState;
    }
};

// Nuki smartlock
class nukiLock extends nukiDevice {
    constructor(nukiId, deviceType) {
        this.id = nukiId;
        this.type = deviceType;
    }

    initStates(scanResult, nukiInfo) {
        let nukiState = null;

        super.initStates(scanResult);

        if (scanResult.paired == false) {
            return;
        }
        
        adapter.setObjectNotExists(`${this.id}.info.mode`, {
            type: 'state',
            common: {
                name: 'Modus',
                type: 'number',
                write: false,
                states: {
                    2: 'door mode',
                    3: '-',
                },
                role: 'value',
                def: 2
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.states.lockState`, {
            type: 'state',
            common: {
                name: 'Nuki aufgeschlossen',
                type: 'boolean',
                write: false,
                role: 'sensor.lock'   
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.states.state`, {
            type: 'state',
            common: {
                name: 'Status',
                type: 'number',
                write: false,
                states: {
                    0: 'uncalibrated',
                    1: 'locked',
                    2: 'unlocking',
                    3: 'unlocked',
                    4: 'locking',
                    5: 'unlatched',
                    6: 'unlocked (lock n go)',
                    7: 'unlatching',
                    253: '-',
                    254: 'motor blocked',
                    255: 'undefined',
                },
                role: 'value'
            },
            native: {}
        });

        if (nukiInfo) {
            if (nukiInfo.hasOwnProperty('lastKnownState')) {
                nukiState = nukiInfo.lastKnownState;

                if (nukiState.hasOwnProperty('batteryCharging')) {
                    adapter.setObjectNotExists(`${this.id}.info.batteryCharging`, {
                        type: 'state',
                        common: {
                            name: 'Batterie wird geladen',
                            type: 'boolean',
                            write: false,
                            role: 'indicator.lowbat'
                        },
                        native: {}
                    });
                }
            
                if (nukiState.hasOwnProperty('batteryChargeState')) {
                    adapter.setObjectNotExists(`${this.id}.info.batteryChargeState`, {
                        type: 'state',
                        common: {
                            name: 'Batterie Ladestatus',
                            type: 'number',
                            write: false,
                            role: 'value.battery'
                        },
                        native: {}
                    });
                }
            
                if (nukiState.hasOwnProperty('doorState')) {
                    adapter.setObjectNotExists(`${this.id}.states.doorState`, {
                        type: 'state',
                        common: {
                            name: 'Türsensor',
                            type: 'number',
                            write: false,
                            states: {
                                1: 'deactivated',
                                2: 'door closed',
                                3: 'door opened',
                                4: 'door state unknown',
                                5: 'calibrating',
                                16: 'uncalibrated',
                                240: 'removed',
                                255: 'unknown',
                            },
                            role: 'value',
                            def: 255
                        },
                        native: {}
                    }); 
                }
            } 
        }
    
        // device actions
        adapter.setObjectNotExists(`${this.id}.actions.action`, {
            type: 'state',
            common: {
                name: 'Aktion',
                type: 'number',
                states: {
                    0: '',
                    1: 'unlock',
                    2: 'lock',
                    3: 'unlatch',
                    4: 'lock`n`go',
                    5: 'lock`n`go with unlatch',
                },
                role: 'value'
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.lockAction`, {
            type: 'state',
            common: {
                name: 'Tür auf-/abschließen',
                type: 'boolean',
                write: true,
                role: 'switch.lock.door',
                def: false
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.openAction`, {
            type: 'state', 
            common: {
                name:  'Tür öffnen',
                type:  'boolean',
                write: true,
                read:  false,
                role:  'button.open.door',
                def: false
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.unlockLocknGoAction`, {
            type: 'state', 
            common: {
                name:  'Tür aufschließen (lock`n`go)',
                type:  'boolean',
                write: true,
                read:  false,
                role:  'button.open.door',
                def: false
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.openLocknGoAction`, {
            type: 'state', 
            common: {
                name:  'Tür öffnen (lock`n`go)',
                type:  'boolean',
                write: true,
                read:  false,
                role:  'button.open.door',
                def: false
            },
            native: {}
        });
    
        // listen to changes
        adapter.subscribeStates(`${this.id}.actions.*Action`);
        adapter.subscribeStates(`${this.id}.actions.action`);
    }
};

//Nuki smart door
class nukiSmartDoor extends nukiLock {
    constructor(nukiId, deviceType) {
        device = new nukiLock(nukiId, deviceType);
        return device;
    }
};

// Nuki smartlock 3.0 (pro)
class nukiLock3 extends nukiLock {
    constructor(nukiId, deviceType) {
        device = new nukiLock(nukiId, deviceType);
        return device;
    }
};

// Nuki opener
class nukiOpener extends nukiDevice {
    constructor(nukiId, deviceType) {
        this.id = nukiId;
        this.type = deviceType;
    }

    initStates(scanResult, nukiInfo) {
        let nukiState = null;

        super.initStates(scanResult);

        if (scanResult.paired == false) {
            return;
        }
        
        adapter.setObjectNotExists(`${this.id}.info.mode`, {
            type: 'state',
            common: {
                name: 'Modus',
                type: 'number',
                write: false,
                states: {
                    2: 'door mode',
                    3: 'continuous mode',
                },
                role: 'value'
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.states.lockState`, {
            type: 'state',
            common: {
                name: 'Ring to Open aktiv',
                type: 'boolean',
                write: false,
                role: 'indicator',
                def: false
            },
            native: {}
        });
        
        adapter.setObjectNotExists(`${this.id}.states.state`, {
            type: 'state',
            common: {
                name: 'Status',
                type: 'number',
                write: false,
                states: {
                    0: 'untrained',
                    1: 'online',
                    2: '-',
                    3: 'rto active',
                    4: '-',
                    5: 'open',
                    6: '-',
                    7: 'opening',
                    253: 'boot run',
                    254: '-',
                    255: 'undefined',
                },
                role: 'value',
                def: 255
            },
            native: {}
        });
        
        // device actions
        adapter.setObjectNotExists(`${this.id}.actions.action`, {
            type: 'state',
            common: {
                name: 'Aktion',
                type: 'number',
                states: {
                    0: '',
                    1: 'activate rto',
                    2: 'deactivate rto',
                    3: 'electric strike actuation',
                    4: 'activate continuous mode',
                    5: 'deactivate continuous mode',
                },
                role: 'value',
                def: 0
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.rtoAction`, {
            type: 'state',
            common: {
                name: 'Ring to Open de-/aktivieren',
                type: 'boolean',
                write: true,
                role: 'switch.lock.door',
                def: false
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.openAction`, {
            type: 'state', 
            common: {
                name:  'öffnen',
                type:  'boolean',
                write: true,
                read:  false,
                role:  'button.open.door',
                def: false
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.cmActiveAction`, {
            type: 'state', 
            common: {
                name:  'Dauermodus einschalten',
                type:  'boolean',
                write: true,
                read:  false,
                role:  'button.open.door',
                def: false
            },
            native: {}
        });
    
        adapter.setObjectNotExists(`${this.id}.actions.cmDeactiveAction`, {
            type: 'state', 
            common: {
                name:  'Dauermodus ausschalten',
                type:  'boolean',
                write: true,
                read:  false,
                role:  'button.open.door',
                def: false
            },
            native: {}
        });
    
        // listen to changes
        adapter.subscribeStates(`${this.id}.actions.*Action`);
        adapter.subscribeStates(`${this.id}.actions.action`);
    }
};

let nukiId = '';
let deviceType = 1;
let nukiState = {
    mode                    : 0,
    state                   : 255,
    stateName               : '',
    batteryCritical         : false,
    batteryCharging         : false,
    batteryChargeState      : 0,
    keypadBatteryCritical   : false,
    doorsensorState         : 255,
    doorsensorStateName     : '',
    ringactionTimestamp     : '',
    ringactionState         : false,
    firmwareVersion         : ''
};

let nukiDevice = {
    nukiId      : nukiId,
    deviceType  : deviceType,
    nukiState   : nukiState,
    getNew      : getNew(),
    init        : initNukiDeviceStates(),
    setState    : setLockState()
};

export function getNew(_nukiId, _deviceType) {
    let newDevice = nukiDevice;

    newDevice.nukiId = _nukiId;
    newDevice.deviceType = _deviceType;

    return newDevice;
}

function initNukiDeviceStates(_obj) {
    let deviceType = 1;
    let firmwareVersion = '';
    let nukiState = nukiState;

    if (!_obj || !(_obj.hasOwnProperty('lastKnownState'))) {
        adapter.log.error('No state received. Please check your Nuki connection.');
        return;
    }
    
    nukiState.state = _obj.lastKnownState.state;
    nukiState.stateName = _obj.lastKnownState.stateName;
    nukiState.batteryCritical = _obj.lastKnownState.batteryCritical;

    // device
    adapter.setObjectNotExists(`${_obj.nukiId}`, {
        type: 'device',
        common: {
            name: _obj.name
        },
        native: {}
    });

    // device info
    adapter.setObjectNotExists(`${_obj.nukiId}.info`, {
        type: 'channel',
        common: {
            name: 'Information'
        },
        native: {}
    });

    // device states
    adapter.setObjectNotExists(`${_obj.nukiId}.states`, {
        type: 'channel',
        common: {
            name: 'Status'
        },
        native: {}
    });

    if (_obj.hasOwnProperty('deviceType')) {
        deviceType = _obj.deviceType;
    } else {
        deviceType = get_devicetype_by_statename(_obj.lastKnownState.stateName)
    }
    
    adapter.setObjectNotExists(`${_obj.nukiId}.info.deviceType`, {
        type: 'state',
        common: {
            name: 'Typ',
            type: 'number',
            write: false,
            states: {
                0: 'Nuki Smart Lock 1.0/2.0',
                1: 'unknown device',
                2: 'Nuki Opener',
                3: 'Nuki Smart Door',
                4: 'Nuki Smart Lock 3.0 (Pro)',
            },
            def: deviceType,
            role: 'value'
        },
        native: {}
    });

    if (_obj.hasOwnProperty('firmwareVersion')) {
        firmwareVersion = _obj.firmwareVersion
        adapter.setObjectNotExists(`${_obj.nukiId}.info.firmwareVersion`, {
            type: 'state',
            common: {
                name: 'Firmware',
                type: 'string',
                write: false,
                role: 'text',
                def: firmwareVersion
            },
            native: {}
        });
    }

        if (_obj.lastKnownState.hasOwnProperty('ringactionState')) {
            adapter.setObjectNotExists(`${_obj.nukiId}.states.ringactionState`, {
                type: 'state',
                common: {
                    name: 'Klingel betätigt',
                    type: 'boolean',
                    write: false,
                    role: 'indicator'   
                },
                native: {}
            });

            // listen to changes
            adapter.subscribeStates(`${_obj.nukiId}.states.ringactionState`);
        }

    if (nukiState) {
        if (nukiState.hasOwnProperty('ringactionTimestamp')) {
            adapter.setObjectNotExists(`${_obj.nukiId}.states.ringactionTimestamp`, {
                type: 'state',
                common: {
                    name: 'Letzte Klingelbetätigung',
                    type: 'string',
                    write: false,
                    role: 'date'
                },
                native: {}
            });
        }
    }

    if (nukiState) {
        adapter.setObjectNotExists(`${_obj.nukiId}.info.batteryCritical`, {
            type: 'state',
            common: {
                name: 'Batterie schwach',
                type: 'boolean',
                write: false,
                role: 'indicator.lowbat'
            },
            native: {}
        });
    }

    if (nukiState) {
        if (nukiState.hasOwnProperty('keypadBatteryCritical')) {
            adapter.setObjectNotExists(`${_obj.nukiId}.info.keypadBatteryCritical`, {
                type: 'state',
                common: {
                    name: 'KeyPad-Batterie schwach',
                    type: 'boolean',
                    write: false,
                    role: 'indicator.lowbat'
                },
                native: {}
            });

            // listen to changes
            adapter.subscribeStates(`${_obj.nukiId}.info.keypadBatteryCritical`);
        }
    }
    
    adapter.setObjectNotExists(`${_obj.nukiId}.states.timestamp`, {
        type: 'state',
        common: {
            name: 'Zuletzt aktualisiert',
            type: 'string',
            write: false,
            role: 'date'
        },
        native: {}
    });

    switch(deviceType) {
        case 0:
            initNukiLockStates(_obj.nukiId);
            break;
        case 2:
            initNukiOpenerStates(_obj.nukiId);
            break;
        case 3:
            initNukiLockStates(_obj.nukiId);
            break;
        case 4:
            initNukiLockStates(_obj.nukiId);
            break;
        default:
            adapter.log.error(`Unknown device type (${deviceType}). Setting minimal states.`);
            deviceType = 1; 
            break;
    }

    // listen to changes
    adapter.subscribeStates(`${_obj.nukiId}.info.batteryCritical`);

    // set states
    setLockState(_obj.nukiId, deviceType, nukiState, firmwareVersion);
}

export function setLockState(_nukiState, _firmWare) {
    let timeStamp = null;

    if (_nukiState == null) {
        // no state set
        return;
    }
 
    // set device type
    adapter.setState(`${_nukiId}.info.deviceType`, {val: _deviceType, ack: true});
    // set battery status
    adapter.setState(`${_nukiId}.info.batteryCritical`, {val: _nukiState.batteryCritical, ack: true});

    if (_nukiState.hasOwnProperty('keypadBatteryCritical')) {
        if (_nukiState.keypadBatteryCritical != null) {
            // set keypad battery status
            adapter.setState(`${_nukiId}.info.keypadBatteryCritical`, {val: _nukiState.keypadBatteryCritical, ack: true});
        }
    }

    // set timestamp
    if (_nukiState.hasOwnProperty('timestamp')) {
        timeStamp =  _nukiState.timestamp;
    } else {
        timeStamp = new Date().toISOString().substr(0,19) + '+00:00';
    }
    adapter.setState(`${_nukiId}.states.timestamp`, {val: timeStamp, ack: true});

    // lock or opener?
    if (_deviceType == 0 || _deviceType == 3 || _deviceType == 4) {
        // set lock action and state
        switch(_nukiState.state) {
            case 1:
                // fall through
            case 4:
                adapter.setState(`${_nukiId}.states.lockState`, {val: false, ack: true});
                adapter.setState(`${_nukiId}.actions.lockAction`, {val: false, ack: true}); 
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
                adapter.setState(`${_nukiId}.states.lockState`, {val: true, ack: true});
                adapter.setState(`${_nukiId}.actions.lockAction`, {val: true, ack: true});
                break;
            default:
                adapter.setState(`${_nukiId}.states.lockState`, {val: true, ack: true});
                adapter.setState(`${_nukiId}.actions.lockAction`, {val: true, ack: true});
                break;
        }   
    } else if (_deviceType == 2) {
        // set opener action and state
        switch(_nukiState.state) {
            case 1:
                // fall through
            case 4:
                adapter.setState(`${_nukiId}.states.lockState`, {val: false, ack: true});
                adapter.setState(`${_nukiId}.actions.rtoAction`, {val: false, ack: true});
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
                adapter.setState(`${_nukiId}.states.lockState`, {val: true, ack: true});
                adapter.setState(`${_nukiId}.actions.rtoAction`, {val: true, ack: true});
                break;
            default:
                adapter.setState(`${_nukiId}.states.lockState`, {val: true, ack: true});
                adapter.setState(`${_nukiId}.actions.rtoAction`, {val: true, ack: true});
                break;
        }   
    } else {
        // unknown device
        return;
    }
    
    // reset action state after delay
    actionTimeOut = setTimeout(function() {
        adapter.setState(`${_nukiId}.actions.action`, {val: 0, ack: true});
    }, timeOut);

    // set mode
    let mode = 0;
    mode = _nukiState.mode;
    adapter.setState(`${_nukiId}.info.mode`, {val: mode, ack: true});
    // set status
    let state = 0;
    state = _nukiState.state;
    adapter.setState(`${_nukiId}.states.state`, {val: state, ack: true});

    if (_nukiState.hasOwnProperty('ringactionState') && _nukiState.ringactionState != null) {
        // set doorsensor status
        adapter.setState(`${_nukiId}.states.ringactionState`, {val: _nukiState.ringactionState, ack: true});
    }

    if (_nukiState.hasOwnProperty('ringactionTimestamp') && _nukiState.ringactionTimestamp != '') {
        // set doorsensor status
        adapter.setState(`${_nukiId}.states.ringactionTimestamp`, {val: _nukiState.ringactionTimestamp, ack: true});
    }

    if (_nukiState.hasOwnProperty('doorsensorState')) {
        // set doorsensor status
        let doorState = 0;
        doorState = _nukiState.doorsensorState;
        adapter.setState(`${_nukiId}.states.doorState`, {val: doorState, ack: true});
    }

    if (_firmWare != null && _firmWare != '') {
        // set firmware version
        adapter.setState(`${_nukiId}.info.firmwareVersion`, {val: _firmWare, ack: true});
    }
}

function initNukiLockStates(_nukiId) {
    let doorsensorState = 4;

    adapter.setObjectNotExists(`${_nukiId}.info.mode`, {
        type: 'state',
        common: {
            name: 'Modus',
            type: 'number',
            write: false,
            states: {
                2: 'door mode',
                3: '-',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.states.lockState`, {
        type: 'state',
        common: {
            name: 'Nuki aufgeschlossen',
            type: 'boolean',
            write: false,
            role: 'sensor.lock'   
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.states.state`, {
        type: 'state',
        common: {
            name: 'Status',
            type: 'number',
            write: false,
            states: {
                0: 'uncalibrated',
                1: 'locked',
                2: 'unlocking',
                3: 'unlocked',
                4: 'locking',
                5: 'unlatched',
                6: 'unlocked (lock n go)',
                7: 'unlatching',
                253: '-',
                254: 'motor blocked',
                255: 'undefined',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.states.doorState`, {
        type: 'state',
        common: {
            name: 'Türsensor',
            type: 'number',
            write: false,
            states: {
                1: 'deactivated',
                2: 'door closed',
                3: 'door opened',
                4: 'door state unknown',
                5: 'calibrating',
            },
            role: 'value',
            def: doorsensorState
        },
        native: {}
    });

    // device actions
    adapter.setObjectNotExists(`${_nukiId}.actions`, {
        type: 'channel',
        common: {
            name: 'Aktionen'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.action`, {
        type: 'state',
        common: {
            name: 'Aktion',
            type: 'number',
            states: {
                0: '',
                1: 'unlock',
                2: 'lock',
                3: 'unlatch',
                4: 'lock‘n’go',
                5: 'lock‘n’go with unlatch',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.lockAction`, {
        type: 'state',
        common: {
            name: 'Tür auf-/abschließen',
            type: 'boolean',
            write: true,
            role: 'switch.lock.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.openAction`, {
        type: 'state', 
        common: {
            name:  'Tür öffnen',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.unlockLocknGoAction`, {
        type: 'state', 
        common: {
            name:  'Tür aufschließen (lock‘n’go)',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.openLocknGoAction`, {
        type: 'state', 
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
    adapter.subscribeStates(`${_nukiId}.actions.*Action`);
    adapter.subscribeStates(`${_nukiId}.actions.action`);
}

function initNukiOpenerStates(_nukiId) {

    adapter.setObjectNotExists(`${_nukiId}.info.mode`, {
        type: 'state',
        common: {
            name: 'Modus',
            type: 'number',
            write: false,
            states: {
                2: 'door mode',
                3: 'continuous mode',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.states.lockState`, {
        type: 'state',
        common: {
            name: 'Ring to Open aktiv',
            type: 'boolean',
            write: false,
            role: 'indicator'   
        },
        native: {}
    });
    
    adapter.setObjectNotExists(`${_nukiId}.states.state`, {
        type: 'state',
        common: {
            name: 'Status',
            type: 'number',
            write: false,
            states: {
                0: 'untrained',
                1: 'online',
                2: '-',
                3: 'rto active',
                4: '-',
                5: 'open',
                6: '-',
                7: 'opening',
                253: 'boot run',
                254: '-',
                255: 'undefined',
            },
            role: 'value'
        },
        native: {}
    });
    
    // device actions
    adapter.setObjectNotExists(`${_nukiId}.actions`, {
        type: 'channel',
        common: {
            name: 'Aktionen'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.action`, {
        type: 'state',
        common: {
            name: 'Aktion',
            type: 'number',
            states: {
                0: '',
                1: 'activate rto',
                2: 'deactivate rto',
                3: 'electric strike actuation',
                4: 'activate continuous mode',
                5: 'deactivate continuous mode',
            },
            role: 'value'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.rtoAction`, {
        type: 'state',
        common: {
            name: 'Ring to Open de-/aktivieren',
            type: 'boolean',
            write: true,
            role: 'switch.lock.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.openAction`, {
        type: 'state', 
        common: {
            name:  'öffnen',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.cmActiveAction`, {
        type: 'state', 
        common: {
            name:  'Dauermodus einschalten',
            type:  'boolean',
            write: true,
            read:  false,
            role:  'button.open.door'
        },
        native: {}
    });

    adapter.setObjectNotExists(`${_nukiId}.actions.cmDeactiveAction`, {
        type: 'state', 
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
    adapter.subscribeStates(`${_nukiId}.actions.*Action`);
    adapter.subscribeStates(`${_nukiId}.actions.action`);
}

function updateAllLockStates(_content, _init) {
    let obj             = null;
    let deviceType      = 0;
    let firmwareVersion = ``;
    let nukilock        = 0;
    
    if (_content == null) {
        adapter.log.error('no content');
        return;
    }
    
    for (nukilock in _content) {
        obj = _content[nukilock];
        if (obj) {
            if (_init) {
                adapter.log.debug(`found Nuki device: ${obj.nukiId}`);
                initNukiDeviceStates(obj);
            } else {
                adapter.log.debug(`updating Nuki device: ${obj.nukiId}`);
                if (obj.hasOwnProperty('deviceType')) {
                    deviceType = obj.deviceType;
                }

                if (obj.hasOwnProperty('firmwareVersion')) {
                    firmwareVersion = obj.firmwareVersion;
                }

                
                    
                setLockState(obj.nukiId, deviceType, obj.lastKnownState, firmwareVersion);
            }
        }
    }
}