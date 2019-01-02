'use strict';
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = utils.Adapter('nuki');

const _request = require('request');
const _http = require('express')();
const _parser = require('body-parser');
const _ip = require('ip');

/*
 * internal libraries
 */
const Library = require(__dirname + '/lib/library.js');
const Nuki = require('nuki-bridge-api');

/*
 * variables initiation
 */
var library = new Library(adapter);

const LOCK_STATES = Object.assign({}, ...Object.values(Nuki.lockState).map(function (n, index) {if (Number.isInteger(n)) return {[n]: Object.keys(Nuki.lockState)[index]}}));
const LOCK_ACTIONS = Object.assign({0: 'NO ACTION'}, ...Object.values(Nuki.lockAction).map(function (n, index) {if (Number.isInteger(n)) return {[n]: Object.keys(Nuki.lockAction)[index]}}));
var bridges = {}, doors = {};
var callback = false, refresh = null;

var NODES = {};
NODES.BRIDGE = [
	{'state': 'bridgeType', 'description': 'Type of bridge', 'status': 'bridgeType', 'type': 'number', 'role': 'value', 'common': {'states': {'1': 'Hardware Bridge', '2': 'Software Bridge'}}},
	{'state': 'bridgeId', 'description': 'ID of the bridge / server', 'status': 'ids.serverId', 'role': 'value'},
	{'state': 'bridgeIp', 'description': 'IP address of the bridge', 'status': 'ip', 'role': 'info.ip'},
	{'state': 'bridgePort', 'description': 'Port of the bridge', 'status': 'port', 'role': 'info.port'},
	{'state': 'hardwareId', 'description': 'ID of the hardware bridge', 'status': 'ids.hardwareId', 'role': 'value'},
	
	{'state': 'uptime', 'description': 'Uptime of the bridge in seconds', 'status': 'uptime', 'role': 'value'},
	{'state': 'refreshed', 'description': 'Timestamp of last update', 'status': 'currentTime', 'role': 'date'},
	{'state': '_connected', 'description': 'Flag indicating whether or not the bridge is connected to the Nuki server', 'status': 'serverConnected', 'type': 'boolean', 'role': 'indicator.reachable'},
	
	{'state': 'versFirmware', 'description': 'Version of the bridges firmware (hardware bridge only)', 'status': 'versions.firmwareVersion', 'role': 'text'},
	{'state': 'versWifi', 'description': 'Version of the WiFi modules firmwarehardware bridge only', 'status': 'versions.wifiFirmwareVersion', 'role': 'text'},
	{'state': 'versApp', 'description': 'Version of the bridge appsoftware bridge only', 'status': 'versions.appVersion', 'role': 'text'},
];

NODES.LOCK = [
	{'state': 'id', 'description': 'ID of the Nuki', 'status': 'nukiId', 'role': 'value'},
	{'state': 'name', 'description': 'Name of the Nuki', 'status': 'name', 'role': 'text'},
	{'state': 'bridge', 'description': 'Bridge of the Nuki', 'status': 'bridge', 'role': 'text'},
	{'state': 'action', 'description': 'Trigger an action on %name%', 'action': true, 'type': 'number', 'role': 'value', 'common': {'write': true, 'states': LOCK_ACTIONS}},
	
	// STATUS
	{'state': 'status', 'description': 'Current status of %name%', 'role': 'channel'},
	{'state': 'status.batteryCritical', 'description': 'States critical battery level', 'status': 'lastKnownState.batteryCritical', 'role': 'indicator.lowbat', 'type': 'boolean'},
	{'state': 'status.refreshed', 'description': 'Timestamp of last update', 'status': 'lastKnownState.timestamp', 'role': 'date'},
	{'state': 'status.state', 'description': 'Current lock-state of the Nuki', 'status': 'lastKnownState.state', 'type': 'number', 'role': 'value', 'common': {'states': LOCK_STATES}},
	{'state': 'status.locked', 'description': 'Indication if door is locked', 'status': 'lastKnownState.state', 'type': 'boolean', 'role': 'sensor.lock', 'common': {'states': {0: false, 1: true, 2: false, 3: false, 4: true, 5: false, 6: false, 7: false, 254: false, 255: false}}},
];

/*
 * ADAPTER UNLOAD
 *
 */
adapter.on('unload', function(callback)
{
    try
	{
        adapter.log.info('Adapter stopped und unloaded.');
		if (refresh) clearInterval(refresh);
        callback();
    }
	catch(e)
	{
        callback();
    }
});

/*
 * ADAPTER READY
 *
 */
adapter.on('ready', function()
{
	// check if bridges have been defined
	if (adapter.config.bridges === undefined || adapter.config.bridges.length == 0)
	{
		adapter.log.warn('No bridges have been defined in settings so far.');
		return;
	}
	
	// go through bridges
	adapter.config.bridges.forEach(function(device, i)
	{
		// check if Bridge is enabled in settings
		if (!device.active)
		{
			adapter.log.info('Bridge ' + (device.bridge_name ? 'with name ' + device.bridge_name : (device.bridge_id ? 'with ID ' + device.bridge_id : 'with index ' + i)) + ' is disabled in adapter settings. Thus, ignored.');
			return;
		}
		
		// check if API settings are set
		if (!device.bridge_ip || !device.bridge_token)
		{
			adapter.log.warn('IP or API token missing for bridge ' + (device.bridge_name ? 'with name ' + device.bridge_name : (device.bridge_id ? 'with ID ' + device.bridge_id : 'with index ' + i)) + '! Please go to settings and fill in IP and the API token first!');
			return;
		}
		
		// check for enabled callback
		if (device.bridge_callback)
			callback = true;
		
		// initialize Nuki Bridge class
		var bridge = {
			'data': device,
			'instance': new Nuki.Bridge(device.bridge_ip, device.bridge_port || 8080, device.bridge_token)
		};
		
		// get bridge info
		getBridgeInfo(bridge);
	});
	
	// periodically refresh settings
	if (adapter.config.refresh !== undefined && adapter.config.refresh > 10)
		refresh = setInterval(function() {for (var key in bridges) {getBridgeInfo(bridges[key])}}, Math.round(parseInt(adapter.config.refresh)*1000));
	
	// attach server to listen (@see https://stackoverflow.com/questions/9304888/how-to-get-data-passed-from-a-form-in-express-node-js/38763341#38763341)
	if (callback)
	{
		adapter.config.port = adapter.config.port !== undefined && adapter.config.port > 1024 && adapter.config.port <= 65535 ? adapter.config.port : 51988;
		adapter.log.info('Listening for Nuki events on port ' + adapter.config.port + '.');
		
		_http.use(_parser.json());
		_http.use(_parser.urlencoded({extended: false}));
		
		_http.post('/nuki-api-bridge', function(req, res)
		{
			adapter.log.debug('Received payload via callback: ' + JSON.stringify(req.body));
			var payload;
			try
			{
				payload = req.body;
				updateDoor({'nukiId': payload.nukiId, 'lastKnownState': {'state': payload.state, 'batteryCritical': payload.batteryCritical, 'timestamp': new Date()}});
			}
			catch(e)
			{
				adapter.log.warn(e.message);
			}
		});
		
		_http.listen(adapter.config.port);
	}
});

/*
 * STATE CHANGE
 *
 */
adapter.on('stateChange', function(node, object)
{
	adapter.log.debug('State of ' + node + ' has changed ' + JSON.stringify(object) + '.');
	var state = node.substr(node.lastIndexOf('.')+1);
	var action = object !== undefined && object !== null ? object.val : 0;
	
	if (state === 'action' && Number.isInteger(action) && action > 0 && object.ack !== true)
	{
		adapter.getObject(node, function(err, node)
		{
			var nukiId = node.common.nukiId || false;
			if (err !== null || !nukiId)
			{
				adapter.log.warn('Error triggering action -' + LOCK_ACTIONS[action] + '- on the Nuki: ' + err.message);
				return;
			}
			
			// retrieve Nuki and apply action
			adapter.log.info('Triggered action -' + LOCK_ACTIONS[action] + '- on Nuki ' + doors[nukiId].name + '.');
			
			var nuki = doors[nukiId].instance;
			nuki.lockAction(action)
				.then(function()
				{
					adapter.log.info('Successfully triggered action -' + LOCK_ACTIONS[action] + '- on Nuki ' + doors[nukiId].name + '.');
					library._setValue(node, 0);
				})
				.catch(function(e)
				{
					adapter.log.warn('Error triggering action -' + LOCK_ACTIONS[action] + '- on Nuki ' + doors[nukiId].name + '. See debug log for details.');
					adapter.log.debug(e.message);
				});
		});
	}
});

/*
 * HANDLE MESSAGES
 *
 */
adapter.on('message', function(msg)
{
	adapter.log.debug('Message: ' + JSON.stringify(msg));
	
	switch(msg.command)
	{
		case 'getBridgeId':
			adapter.log.debug('Discover bridges..');
			//library.msg(msg.from, msg.command, {result: true, data: {password: library.encrypt(adapter.config.encryptionKey, msg.message.cleartext)}}, msg.callback);
			break;
			
		case 'discover':
			adapter.log.info('Discovering bridges..');
			
			_request('https://api.nuki.io/discover/bridges', { json: true }, function(err, res, body)
			{
				if (err)
				{
					adapter.log.warn('Error while discovering Bridges: ' + err.message);
					library.msg(msg.from, msg.command, {result: false, error: err.message}, msg.callback);
				}
				else
				{
					var bridges = body.bridges;
					adapter.log.info('Bridges discovered: ' + bridges.length);
					adapter.log.debug(JSON.stringify(bridges));
					
					library.msg(msg.from, msg.command, {result: true, bridges: bridges}, msg.callback);
				}
			});
			break;
	}
});

/**
 * Retrieve Nuki's.
 *
 */
function getBridgeInfo(bridge)
{
	// get nuki's
	adapter.log.info('Retrieving Nuki\'s from Bridge ' + bridge.data.bridge_ip + '..');
	bridge.instance.list().then(function gotNukis(nukis)
	{
		nukis.forEach(function(nuki)
		{
			// create Nuki
			nuki.bridge = bridge.data.bridge_id !== '' ? bridge.data.bridge_id : undefined;
			updateDoor(nuki);
			
			// attach callback (NOTE: https is not supported according to API documentation)
			if (bridge.data.bridge_callback)
			{
				nuki.nuki.addCallback(_ip.address(), adapter.config.port)
					.then(function(res)
					{
						adapter.log.info('Callback attached to Nuki ' + nuki.name + '.');
					})
					.catch(function(e)
					{
						if (e.error.message === 'callback already added')
							adapter.log.info('Callback already attached to Nuki ' + nuki.name + '.');
						
						else
						{
							adapter.log.warn('Callback not attached due to error. See debug log for details.');
							adapter.log.debug(e.message);
						}
					});
			}
		});
	})
	.catch(function(e)
	{
		adapter.log.warn('Connection settings for bridge incorret' + (bridge.data.bridge_name ? ' with name ' + bridge.data.bridge_name : (bridge.data.bridge_id ? ' with ID ' + bridge.data.bridge_id : (bridge.data.bridge_ip ? ' with ip ' + bridge.data.bridge_ip : ''))) + '! No connection established.');
		adapter.log.debug(e.message);
	});
	
	// get bride info
	bridge.instance.info().then(function gotInfo(info)
	{
		//
		info.ip = bridge.data.bridge_ip;
		info.port = bridge.data.bridge_port || 8080;
		
		// get bridge ID if not given
		if (bridge.data.bridge_id === undefined || bridge.data.bridge_id === '')
		{
			adapter.log.debug('Adding missing Bridge ID for bridge with IP ' + bridge.data.bridge_ip + '.');
			bridge.data.bridge_id = info.ids.serverId;
			
			// update bridge ID in configuration
			adapter.getForeignObject('system.adapter.' + adapter.namespace, function(err, obj)
			{
				obj.native.bridges.forEach(function(entry, i)
				{
					if (entry.bridge_ip === bridge.data.bridge_ip)
					{
						obj.native.bridges[i].bridge_id = bridge.data.bridge_id;
						adapter.setForeignObject(obj._id, obj);
					}
				});
			});
		}
		
		// index bridge
		if (bridges[bridge.data.bridge_id] === undefined)
			bridges[bridge.data.bridge_id] = bridge;
		
		// create bridge
		var device = 'bridge__' + (bridge.data.bridge_name ? bridge.data.bridge_name.replace(/ /gi, '_').toLowerCase() : bridge.data.bridge_id);
		adapter.createDevice(device, {name: 'Bridge (' + bridge.data.bridge_ip + ')'}, {}, function(err)
		{
			NODES.BRIDGE.forEach(function(node)
			{
				node.node = device + '.' + node.state;
				setInformation(node, info);
			});
		});
	})
	.catch(function(e) {adapter.log.debug(e.message)});
}

/**
 * Update states of Nuki Door based on payload.
 *
 */
function updateDoor(payload)
{
	// index Nuki
	var device;
	if (doors[payload.nukiId] === undefined)
	{
		device = 'door__' + payload.name.toLowerCase().replace(/ /gi, '_');
		doors[payload.nukiId] = {device: device, name: payload.name, state: payload.lastKnownState.state, bridge: payload.bridge, instance: payload.nuki};
	}
	
	// retrieve Nuki name
	else
		device = doors[payload.nukiId].device;
	
	// create / update device
	adapter.createDevice(adapter.namespace + '.' + device, {name: payload.name}, {}, function(err)
	{
		NODES.LOCK.forEach(function(node)
		{
			node.node = device + '.' + node.state;
			node.description = node.description.replace(/%id%/gi, payload.nukiId).replace(/%name%/gi, payload.name);
			setInformation(node, payload);
		});
	});
}

/**
 * Set information based on payload.
 *
 */
function setInformation(node, payload)
{
	var tmp, status, index;
	try
	{
		// action
		if (node.action !== undefined)
		{
			node.common.nukiId = payload.nukiId;
			library.set(node, 0);
			adapter.subscribeStates(node.node); // attach state listener
		}
		
		// status
		else if (node.status !== undefined)
		{
			tmp = Object.assign({}, payload);
			status = node.status;
			
			// go through response
			while (status.indexOf('.') > -1)
			{
				try
				{
					index = status.substr(0, status.indexOf('.'));
					status = status.substr(status.indexOf('.')+1);
					tmp = tmp[index];
				}
				catch(err) {adapter.log.debug(err.message);}
			}
			
			// write value
			if (tmp[status] !== undefined)
				library.set(node, node.type === 'boolean' && Number.isInteger(tmp[status]) ? (tmp[status] === 1) : tmp[status]);
		}
		
		// only state creation
		else
		{
			adapter.getState(node.node, function(err, res)
			{
				if ((err !== null || !res) && (node.node !== undefined && node.description !== undefined))
					library.set(node, '');
			});
		}
		
	}
	catch(err) {adapter.log.error(JSON.stringify(err.message))}
}
