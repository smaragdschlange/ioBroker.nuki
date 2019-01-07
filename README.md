![Logo](admin/nuki-logo.png)
# ioBroker.nuki
This ioBroker adapter allows to control and monitor the [Nuki Smart Lock](https://nuki.io/de/) by using **both** the [local API of the Nuki Bridge](https://developer.nuki.io/page/nuki-bridge-http-api-170/4/#heading--introduction) as well as the [Web API](https://developer.nuki.io/page/nuki-web-api-111/3/).

[![NPM version](http://img.shields.io/npm/v/iobroker.nuki.svg)](https://www.npmjs.com/package/iobroker.nuki)
[![Travis CI](https://travis-ci.org/smaragdschlange/ioBroker.nuki.svg?branch=master)](https://travis-ci.org/smaragdschlange/ioBroker.nuki)
[![Downloads](https://img.shields.io/npm/dm/iobroker.nuki.svg)](https://www.npmjs.com/package/iobroker.nuki)

[![NPM](https://nodei.co/npm/iobroker.nuki.png?downloads=true)](https://nodei.co/npm/iobroker.nuki/)

**Requirements**
* A Nuki Smart Lock (obviously) and a Nuki (hardware or software) Bridge.
* A running instance of ioBroker.

**Table of contents**
1. [Installation](#installation)
   1. [Get a API token](#get-a-api-token)
   2. [Callback function](#callback-function)
   3. [States](#states)
2. [Smart Home / Alexa integration using ioBroker.javascript](#smart-home--alexa-integration-using-iobrokerjavascript)
3. [Changelog](#changelog)
4. [Credits](#credits)
5. [Licence](#license)


## Installation
### Get a API token
How to get your bridges token:

1. Call ```http://<bridge_ip>:<bridge_port>/auth``` from any browser in your network
2. The bridge turns on its LED
2. Press the button of the bridge within 30 seconds
3. Result of the browser call should be something like this: ```
    {
    "token": “token123”,
    "success": true
    }```

### Callback function
If the callback function is being used, the adapter will try to automatically set the callback on the Nuki bridge when the instance is being saved. All Nuki states will be kept up-to-date by the Nuki bridge while callback is activated.
Callbacks can also be set and removed manually from any browser with following URLs:

* set Callback: ```http://<bridge_ip>:<bridge_port>/callback/add?url=http%3A%2F%2F<host_ip>%3A<host_port>%2Fapi%2Fnuki&token=<bridgeToken>```
* remove Callback: ```http://<bridge_ip>:<bridge_port>/callback/remove?id=<callback_id>&token=<bridgeToken>```
* list all Callbacks: ```http://<bridge_ip>:<bridge_port>/callback/list?token=<bridgeToken>```

### States
If you successfully setup ioBroker.nuki, the following channels and states are created:

#### Bridges (local Bridge API)
A bridge will be created as device with the name pattern ```bridge__<name of bridge>```. The following channels / states will be created in each bridge:

| Channel | State | Description |
|:------- |:----- |:----------- |
| - | \_connected | Flag indicating whether or not the bridge is connected to the Nuki server |
| - | bridgeId | ID of the bridge / server |
| - | bridgeIp | IP address of the bridge |
| - | bridgePort | Port of the bridge |
| - | bridgeType | Type of bridge |
| - | hardwareId | ID of the hardware bridge (hardware bridge only) |
| - | refreshed | Timestamp of last update |
| - | uptime | Uptime of the bridge in seconds |
| - | versFirmware | Version of the bridges firmware (hardware bridge only) |
| - | versWifi | Version of the WiFi modules firmware (hardware bridge only) |
| - | versApp | Version of the bridge app (software bridge only) |

#### Locks (local Bridge API)
A lock will be created as device with the name pattern ```door__<name of door>```. The following channels / states will be created in each bridge:

| Channel | State | Description |
|:------- |:----- |:----------- |
| - | action | Trigger an action on Home Door |
| - | bridge | Bridge of the Nuki |
| - | id | ID of the Nuki |
| - | name | Name of the Nuki |
| status | batteryCritical | States critical battery level |
| status | locked | Indication if door is locked |
| status | refreshed | Timestamp of last update |
| status | state | Current lock-state of the Nuki |

#### Locks (Webi API)
Additionally the following states will be available when Nuki Web API has been enabled:

| Channel | State | Description |
|:------- |:----- |:----------- |
| - | - | documentation coming soon... |


## Smart Home / Alexa integration using ioBroker.javascript
Some examples of a possible integration within your smart home.

### Lock door at 10pm in the evening
Coming soon..


## Changelog

### 1.1.0
* (zefau) Support for multiple bridges
* (zefau) Support for discovery within admin panel
* (zefau) Additional states for bridges and better separation between software / hardware bridge
* (zefau) Added Nuki Web API

Note: When updating to 1.1.0 it is recommended to delete all instances of the old version before installing the new version.

### 1.0.3
* (smaragdschlange) bug fix: action buttons were not working properly

### 1.0.1
* (smaragdschlange) version synch

### 1.0.0
* (smaragdschlange) initial release on npm

### 0.2.0
* (smaragdschlange) periodic state updates added
* (smaragdschlange) restructure objects

Note: When updating from 0.1.x to 0.2.0 or higher it is recommended to delete all instances of the old version before installing the new version. Please be aware that version changes bigger than on patch level (-> change of only the last digit) could always contain changes to data points e.g. 0.1.3 to 0.2.0

### 0.1.3
* (smaragdschlange) timestamp bug fixed

### 0.1.2
* (smaragdschlange) minor bugfixes
* (smaragdschlange) added delay before each Nuki request to avoid null responses

### 0.1.1
* (smaragdschlange) callback will be removed when instance is unloading

### 0.1.0
* (smaragdschlange) callback finally working
* (smaragdschlange) added another State

### 0.0.6
* (smaragdschlange) additional states/actions and improved compatibility (callback still not completely working)

### 0.0.5
* (smaragdschlange) added support for nuki bridge callback (web server still to be added)

### 0.0.4
* (smaragdschlange) added input parameter for lock actions

### 0.0.3
* (smaragdschlange) bug fixes and restructure

### 0.0.2
* (smaragdschlange) added input parameters

### 0.0.1
* (smaragdschlange) initial release


## Credits
Thanks to [@Mik13](https://github.com/Mik13) for the [Nuki Bridge API implementation](https://github.com/Mik13/nuki-bridge-api#nuki-bridge-api).


## License
The MIT License (MIT)

Copyright (c) 2018 smaragdschlange <smaragdschlange@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
