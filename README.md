![Logo](admin/nuki-logo.png)
# ioBroker.nuki
=================

This ioBroker adapter allows to control and monitor the [Nuki Smart Lock](https://nuki.io/de/) by using the API of the Nuki Bridge.

Since this is my very first attempt of creating my own ioBroker adapter and also my premiere for using GitHub I will move slowly in order to learn how to do this. So please don't be impatient.

## Requirements
* A Nuki Smart Lock (obviously) and a Nuki (hardware or software) Bridge.
* A running instance of ioBroker.

## Usage
Each instance of the Nuki adapter represents a Nuki bridge. When creating an instance, simply enter name (optional), IP address, port and token of your Nuki bridge. After saving an instance there will be created a bridge device with a channel for each Nuki lock that is connected to the specified Nuki bridge. The channels provide the current state of the Nuki lock as output parameters:

* state: Current (numeric) lock state
* stateName: Current lock state as string
* batteryCritical: Indicator for low battery
* timestamp: Last updated

Additionally, the channels provide an input parameter which enables basic control of the Nuki lock:

* lockAction

Valid input values are:

    1 (unlock)
    2 (lock)
    3 (unlatch)
    4 (lock ‘n’ go)
    5 (lock ‘n’ go with unlatch)

## Additional information
How to get your bridges token:

* Call http://< bridge_ip >:< bridge_port >/auth from any browser in your LAN -> bridge turns on its LED
* Press the button of the bridge within 30 seconds
* Result of the browser call should be something like this:
    {
    "token": “token123”,
    "success": true
    }

## Changelog

### 0.0.1
* (smaragdschlange) initial release

### 0.0.2
* (smaragdschlange) added input parameters

### 0.0.3
* (smaragdschlange) bug fixes and restructure

### 0.0.4
* (smaragdschlange) added input parameter for lock actions

### 0.0.5
* (smaragdschlange) added support for nuki bridge callback (web server still to be added)

### 0.0.6
* (smaragdschlange) additional states/actions and improved compatibility (callback still not completely working)

### 0.1.0
* (smaragdschlange) callback finally working
* (smaragdschlange) added another State

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
