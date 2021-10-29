'use strict';

const utils = require('@iobroker/adapter-core');
const { chromium } = require('playwright');
const { JSDOM } = require("jsdom");

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;

let browser = false;
let context;
let pageSunnyIsland;
let pageSunnyTripower;
let content;

let testSetting = {
    "sunnyIsland": {
        "options": {
            "reloadPageInterval_sec": "1800"
        },
        0: {
            "action": "goto",
            "url": "www.example.com"
        },
        1: {
            "action": "waitForSelector",
            "selector": "#password"
        },
        2: {
            "action": "selectOption",
            "selector": "select#user",
            "select_labeled": "User"
        },
        3: {
            "action": "fill",
            "selector": "input[name=\"password\"]",
            "value": ""
        },
        4: {
            "action": "click",
            "selector": "#bLogin"
        },
        5: {
            "action": "waitForTimeout",
            "time_ms": "25000"
        },
        6: {
            "action": "readInterval",
            "time_ms": "5000",
            "setting": {
                "options": {
                    "setOnSuccess__state__": "sma_sunny_island_connected"
                },
                0: {
                    "action": "readElementToState",
                    "__state__": "battery_charge",
                    "selector": "#v6180_08214800",
                    "fallback": "unknown"
                }
            }
        }
    },
    "sunnyTripower": {
    
    }
}

function startAdapter(options) {
    // Create the adapter and define its methods
    return adapter = utils.adapter(Object.assign({}, options, {
        name: 'playwright',
        ready: main,
        unload: () => browser.close()
    }));
}

function main() {
    if(!adapter.config.setting || adapter.config.setting === '') {
        adapter.log.error('No Setting given!');
        return;
    }
    setSubscribers(testSetting);
    if(!browser) {
        openBrowser(readPages(testSetting));
    }
}

function setSubscribers(setting) {
    adapter.log.info(`subscribe to state: ${JSON.stringify(flattenObject(setting))}`);
    for (const [pageName, pageSetting] of Object.entries(setting)) {
        for (const [key, state] of Object.entries(flattenObject(pageSetting))) {
            if(key.indexOf('__state__') > 0) {
                const statePath = pageName + '.' + state;
                adapter.log.info(`create state: ${statePath}`);
                adapter.setObjectNotExistsAsync(statePath, {
                    type: 'state',
                    common: {
                        name: state,
                        type: 'string',
                        role: 'indicator',
                        read: true,
                        write: true,
                    },
                    native: {},
                });
            }
        }
    }
}

function readPages(setting) {
    for (const [pageName, pageSetting] of Object.entries(setting)) {
        adapter.log.info(`readPage ${pageName} with setting: ${JSON.stringify(pageSetting)}`);
    }
}

async function openBrowser(cb) {
    browser = await chromium.launch({
        headless: true,
        devtools: false,
        executablePath: '/usr/bin/chromium-browser',
        args: [
            "--enable-features=NetworkService",
            "--disable-dev-shm-usage"
        ],
    });
    adapter.log.info(`opened browser`);
    context = await browser.newContext({ ignoreHTTPSErrors: true });
    cb();
}

function flattenObject(ob) {
    var toReturn = {};
    
    for (var i in ob) {
        if (!ob.hasOwnProperty(i)) continue;
        
        if ((typeof ob[i]) == 'object' && ob[i] !== null) {
            var flatObject = flattenObject(ob[i]);
            for (var x in flatObject) {
                if (!flatObject.hasOwnProperty(x)) continue;
                
                toReturn[i + '.' + x] = flatObject[x];
            }
        } else {
            toReturn[i] = ob[i];
        }
    }
    return toReturn;
}





// class Template extends utils.Adapter {
//
//     /**
//      * @param {Partial<utils.AdapterOptions>} [options={}]
//      */
//     constructor(options) {
//         super({
//             ...options,
//             name: 'pupeteer_sma',
//         });
//
//         this.on('ready', this.openPageSunnyIsland.bind(this));
//         this.on('ready', this.openPageSunnyTripower.bind(this));
//         this.on('unload', this.onUnload.bind(this));
//     }
//
//     createStates = async () => {
//         const states = [
//             'sma_sunny_island_connected',
//             'sma_sunny_tripower_connected',
//             'sma_status',
//             'battery_operation',
//             'battery_charge',
//             'battery_watt',
//             'grid_power_dir',
//             'grid_power',
//             'solar_watt',
//         ]
//         await states.forEach(state => {
//             this.setObjectNotExistsAsync(state, {
//                 type: 'state',
//                 common: {
//                     name: state,
//                     type: 'string',
//                     role: 'indicator',
//                     read: true,
//                     write: true,
//                 },
//                 native: {},
//             });
//         })
//     }
//
//     /**
//      * Is called when databases are connected and adapter received configuration.
//      */
//     async openBrowser() {
//         this.createStates();
//         browser = await chromium.launch({
//             headless: true,
//             devtools: false,
//             executablePath: '/usr/bin/chromium-browser',
//             args: [
//                 "--enable-features=NetworkService",
//                 "--disable-dev-shm-usage"
//             ],
//         });
//         this.log.info(`opened browser`);
//         context = await browser.newContext({ ignoreHTTPSErrors: true });
//     }
//
//     async openPageSunnyIsland() {
//         if(!this.config.url_sunny_island) {
//             return;
//         }
//         if(!browser) {
//             await this.openBrowser();
//         }
//         pageSunnyIsland = await context.newPage();
//         this.log.info(`opened pageSunnyIsland`);
//         await pageSunnyIsland.goto(this.config.url_sunny_island);
//         this.log.info(`called ${this.config.url_sunny_island}`);
//         await pageSunnyIsland.waitForSelector('#password');
//         this.log.info(`password input detected`);
//         await pageSunnyIsland.selectOption('select#user', { label: 'User' });
//         this.log.info(`try entering pwd`);
//         await pageSunnyIsland.fill('input[name="password"]', this.config.sma_pass);
//         await pageSunnyIsland.waitForSelector('#bLogin');
//         await pageSunnyIsland.click("#bLogin");
//         await pageSunnyIsland.waitForTimeout(25000);
//         this.readPageSunnyIslandInterval(5000);
//         setInterval(async() => {
//             this.log.info('reload SunnyIsland Page');
//             await pageSunnyIsland.reload();
//         }, 1000 * 60 * 30); //30mins
//     }
//
//     async openPageSunnyTripower() {
//         if(!this.config.url_sunny_tripower) {
//             return;
//         }
//         if(!browser) {
//             await this.openBrowser();
//         }
//         pageSunnyTripower = await context.newPage();
//         this.log.info(`opened pageSunnyTripower`);
//         await pageSunnyTripower.goto(this.config.url_sunny_tripower);
//         this.log.info(`called ${this.config.url_sunny_tripower}`);
//         await pageSunnyTripower.waitForSelector('#password');
//         this.log.info(`password input detected`);
//         await pageSunnyTripower.selectOption('select#user', { label: 'User' });
//         this.log.info(`try entering pwd`);
//         await pageSunnyTripower.fill('input[name="password"]', this.config.sma_pass);
//         await pageSunnyTripower.waitForSelector('#bLogin');
//         await pageSunnyTripower.click("#bLogin");
//         await pageSunnyTripower.waitForTimeout(25000);
//         this.readPageSunnyTripowerInterval(5000);
//         setInterval(async() => {
//             this.log.info('reload SunnyTripower Page');
//             await pageSunnyTripower.reload();
//         }, 1000 * 60 * 30); //30mins
//     }
//
//     readPageSunnyIslandInterval = (pauseTime) => {
//         setInterval(async () => {
//             content = await pageSunnyIsland.content();
//             const dom = new JSDOM(content);
//             if(dom && dom.window && dom.window.document) {
//                 const document = dom.window.document;
//                 this.setStateAsync('sma_sunny_island_connected', {val: 'true', ack: true});
//                 let batteryTile = document.querySelector('#v6100_00295A00') ?
//                     document.querySelector('#v6100_00295A00').parentElement.parentElement.parentElement.parentElement.parentElement
//                     : false;
//                 let smaStatus = document.querySelector('#v6180_08214800') ?
//                     document.querySelector('#v6180_08214800').textContent
//                     : 'unknown';
//                 let batteryOperation = batteryTile && batteryTile.querySelectorAll('tr') ?
//                     batteryTile.querySelectorAll('tr')[0].querySelectorAll('td')[2].textContent
//                     : 'unknown';
//                 let batteryCharge = batteryTile && batteryTile.querySelectorAll('tr') ?
//                     (batteryOperation == 'Discharge battery' ? '-' : '') + batteryTile && batteryTile.querySelectorAll('tr')[1].querySelectorAll('td')[1].textContent
//                     : 'unknown';
//                 let batteryWatt = batteryTile && batteryTile.querySelectorAll('tr') ?
//                     batteryTile.querySelectorAll('tr')[2].querySelectorAll('td')[1].textContent
//                     : 'unknown';
//                 let gridPowerDir = 'unknown';
//                 try {
//                     gridPowerDir = document.querySelector('[src="images/icons/arrowGr.png"]') ? 'Out' : 'unknown';
//                     gridPowerDir = document.querySelector('[src="images/icons/arrowRd.png"]') ? 'In' : gridPowerDir;
//                 } catch (e) {
//                     gridPowerDir = 'unknown';
//                 }
//                 let gridPower = document.querySelector('[ng-controller="gridConnectionPointOverview"]') ?
//                     (gridPowerDir == 'Out' ? '-' : '') + document.querySelector('[ng-controller="gridConnectionPointOverview"]').querySelector('.tileValues.ng-binding').textContent
//                     : 'unknown';
//                 smaStatus != 'unknown' && this.setStateAsync('sma_status', {val: smaStatus.toString(), ack: true});
//                 batteryOperation != 'unknown' && this.setStateAsync('battery_operation', {val: batteryOperation.toString(), ack: true});
//                 batteryCharge != 'unknown' && this.setStateAsync('battery_charge', {val: batteryCharge.toString(), ack: true});
//                 batteryWatt != 'unknown' && this.setStateAsync('battery_watt', {val: batteryWatt.toString(), ack: true});
//                 gridPowerDir != 'unknown' && this.setStateAsync('grid_power_dir', {val: gridPowerDir.toString(), ack: true});
//                 gridPower != 'unknown' && this.setStateAsync('grid_power', {val: gridPower.toString(), ack: true});
//             }
//         }, pauseTime);
//     }
//
//     readPageSunnyTripowerInterval = (pauseTime) => {
//         setInterval(async () => {
//             content = await pageSunnyTripower.content();
//             const dom = new JSDOM(content);
//             if(dom && dom.window && dom.window.document) {
//                 this.setStateAsync('sma_sunny_tripower_connected', {val: 'true', ack: true});
//                 const document = dom.window.document;
//                 let solarWatt = document.querySelector('#v6100_40263F00') ?
//                     document.querySelector('#v6100_40263F00').textContent
//                     : 'unknown';
//                 solarWatt != 'unknown' && this.setStateAsync('solar_watt', {val: solarWatt.toString(), ack: true});
//             }
//         }, pauseTime);
//     }
//
//     /**
//      * Is called when adapter shuts down - callback has to be called under any circumstances!
//      * @param {() => void} callback
//      */
//     onUnload(callback) {
//         this.log.info('onUnload');
//         this.setStateAsync('sma_sunny_island_connected', {val: 'false', ack: true});
//         this.setStateAsync('sma_sunny_tripower_connected', {val: 'false', ack: true});
//         callback();
//     }
// }


// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
