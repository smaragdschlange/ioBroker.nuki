/**
 *
 * nuki server functions
 *
 *
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

import {nukiState, setLockState} from './device';
import {adapter} from './nuki';


function initServer(_ip, _port) {
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

    // routes will go here
    app.get('/api/:key', function(req, res) {
        res.send(`Hello ${req.params.key} ;-)`);
    });

    // POST parameters sent with 
    app.post(`/api/nuki.${adapter.instance}`, function(req, res) {
        let nukiId = req.body.nukiId;
        let deviceType = 1;

        if (req.body.hasOwnProperty('deviceType')) {
            deviceType = req.body.deviceType
        } else {
            // default to Nuki lock
            deviceType = 0;
        }

        nukiState.state = req.body.state;
        nukiState.stateName = req.body.stateName;
        nukiState.batteryCritical = req.body.batteryCritical;

        if (req.body.hasOwnProperty('mode')) {
            nukiState.mode = req.body.mode;
        } else {
            // default to door mode
            nukiState.mode = '2';
        }

        if (req.body.hasOwnProperty('batteryCharging')) {
            nukiState.batteryCharging = req.body.batteryCharging;
        }

        if (req.body.hasOwnProperty('batteryChargeState')) {
            nukiState.batteryChargeState = req.body.batteryChargeState;
        }

        if (req.body.hasOwnProperty('keypadBatteryCritical')) {
            nukiState.keypadBatteryCritical = req.body.keypadBatteryCritical;
        }

        if (req.body.hasOwnProperty('doorsensorState')) {
            nukiState.doorsensorState = req.body.doorsensorState;
            nukiState.doorsensorStateName = req.body.doorsensorStateName;
        }

        if (req.body.hasOwnProperty('ringactionState')) {
            nukiState.ringactionState = req.body.ringactionState;
            nukiState.ringactionTimestamp = req.body.ringactionTimestamp;
        }

        try {
            adapter.log.info(`status change received for NukiID ${nukiId}: ${nukiState.stateName}`);
            adapter.log.info(`battery status received for NukiID ${nukiId}: ${nukiState.batteryCritical}`);
            setLockState(nukiId, deviceType, nukiState);

            res.sendStatus(200);
        } catch (e) {
            res.sendStatus(500);
			adapter.log.warn(e.message);
        }
    });
}