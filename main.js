'use strict';

/*
 * Created with @iobroker/create-adapter v1.34.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
const { chromium } = require('playwright');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let browser = false;
let context;
let pageSunnyIsland;
let pageSunnyTripower;
let content;

class Template extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'pupeteer_sma',
        });
        
        this.on('ready', this.openPageSunnyIsland.bind(this));
        this.on('ready', this.openPageSunnyTripower.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    
    createStates = async () => {
        const states = [
            'sma_sunny_island_connected',
            'sma_sunny_tripower_connected',
            'sma_status',
            'battery_operation',
            'battery_charge',
            'battery_watt',
            'grid_power_dir',
            'grid_power',
            'solar_watt',
        ]
        await states.forEach(state => {
            this.setObjectNotExistsAsync(state, {
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
        })
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async openBrowser() {
        this.createStates();
        browser = await chromium.launch({
            headless: true,
            devtools: false,
            executablePath: '/usr/bin/chromium-browser',
            args: [
                "--enable-features=NetworkService",
                "--disable-dev-shm-usage"
            ],
        });
        this.log.info(`opened browser`);
        context = await browser.newContext();
    }
    
    async openPageSunnyIsland() {
        if(!this.config.url_sunny_island) {
            return;
        }
        if(!browser) {
            await this.openBrowser();
        }
        pageSunnyIsland = await context.newPage();
        this.log.info(`opened pageSunnyIsland`);
        await pageSunnyIsland.goto(this.config.url_sunny_island);
        this.log.info(`called ${this.config.url_sunny_island}`);
        await pageSunnyIsland.waitForSelector('#password');
        this.log.info(`password input detected`);
        await pageSunnyIsland.selectOption('select#user', { label: 'User' });
        this.log.info(`try entering pwd`);
        await pageSunnyIsland.fill('input[name="password"]', this.config.sma_pass);
        await pageSunnyIsland.waitForSelector('#bLogin');
        await pageSunnyIsland.click("#bLogin");
        await pageSunnyIsland.waitForTimeout(25000);
        this.readPageSunnyIslandInterval(5000);
        setInterval(async() => {
            await pageSunnyIsland.reload();
        }, 1000 * 60 * 30); //30mins
    }
    
    async openPageSunnyTripower() {
        if(!this.config.url_sunny_tripower) {
            return;
        }
        if(!browser) {
            await this.openBrowser();
        }
        pageSunnyTripower = await context.newPage();
        this.log.info(`opened pageSunnyTripower`);
        await pageSunnyTripower.goto(this.config.url_sunny_tripower);
        this.log.info(`called ${this.config.url_sunny_tripower}`);
        await pageSunnyTripower.waitForSelector('#password');
        this.log.info(`password input detected`);
        await pageSunnyTripower.selectOption('select#user', { label: 'User' });
        this.log.info(`try entering pwd`);
        await pageSunnyTripower.fill('input[name="password"]', this.config.sma_pass);
        await pageSunnyTripower.waitForSelector('#bLogin');
        await pageSunnyTripower.click("#bLogin");
        await pageSunnyTripower.waitForTimeout(25000);
        this.readPageSunnyTripowerInterval(5000);
        setInterval(async() => {
            await pageSunnyTripower.reload();
        }, 1000 * 60 * 30); //30mins
    }
    
    readPageSunnyIslandInterval = (pauseTime) => {
        setInterval(async () => {
            content = await pageSunnyIsland.content();
            const dom = new JSDOM(content);
            if(dom && dom.window && dom.window.document) {
                this.setStateAsync('sma_sunny_island_connected', {val: 'true', ack: true});
                const document = dom.window.document;
                let batteryTile = document.querySelector('#v6100_00295A00') ?
                    document.querySelector('#v6100_00295A00').parentElement.parentElement.parentElement.parentElement.parentElement
                    : false;
                let smaStatus = document.querySelector('#v6180_08214800') ?
                    document.querySelector('#v6180_08214800').textContent
                    : 'unknown';
                let batteryOperation = batteryTile && batteryTile.querySelectorAll('tr') ?
                    batteryTile.querySelectorAll('tr')[0].querySelectorAll('td')[2].textContent
                    : 'unknown';
                let batteryCharge = batteryTile && batteryTile.querySelectorAll('tr') ?
                    (batteryOperation == 'Discharge battery' ? '-' : '') + batteryTile && batteryTile.querySelectorAll('tr')[1].querySelectorAll('td')[1].textContent
                    : 'unknown';
                let batteryWatt = batteryTile && batteryTile.querySelectorAll('tr') ?
                    batteryTile.querySelectorAll('tr')[2].querySelectorAll('td')[1].textContent
                    : 'unknown';
                let gridPowerDir = 'unknown';
                try {
                    gridPowerDir = document.querySelector('[src="images/icons/arrowGr.png"]') ? 'Out' : 'unknown';
                    gridPowerDir = document.querySelector('[src="images/icons/arrowRd.png"]') ? 'In' : gridPowerDir;
                } catch (e) {
                    gridPowerDir = 'unknown';
                }
                let gridPower = document.querySelector('[ng-controller="gridConnectionPointOverview"]') ?
                    (gridPowerDir == 'Out' ? '-' : '') + document.querySelector('[ng-controller="gridConnectionPointOverview"]').querySelector('.tileValues.ng-binding').textContent
                    : 'unknown';
                smaStatus != 'unknown' && this.setStateAsync('sma_status', {val: smaStatus.toString(), ack: true});
                batteryOperation != 'unknown' && this.setStateAsync('battery_operation', {val: batteryOperation.toString(), ack: true});
                batteryCharge != 'unknown' && this.setStateAsync('battery_charge', {val: batteryCharge.toString(), ack: true});
                batteryWatt != 'unknown' && this.setStateAsync('battery_watt', {val: batteryWatt.toString(), ack: true});
                gridPowerDir != 'unknown' && this.setStateAsync('grid_power_dir', {val: gridPowerDir.toString(), ack: true});
                gridPower != 'unknown' && this.setStateAsync('grid_power', {val: gridPower.toString(), ack: true});
            }
        }, pauseTime);
    }
    
    readPageSunnyTripowerInterval = (pauseTime) => {
        setInterval(async () => {
            content = await pageSunnyTripower.content();
            const dom = new JSDOM(content);
            if(dom && dom.window && dom.window.document) {
                this.setStateAsync('sma_sunny_tripower_connected', {val: 'true', ack: true});
                const document = dom.window.document;
                let solarWatt = document.querySelector('#v6100_40263F00') ?
                    document.querySelector('#v6100_40263F00').textContent
                    : 'unknown';
                solarWatt != 'unknown' && this.setStateAsync('solar_watt', {val: solarWatt.toString(), ack: true});
            }
        }, pauseTime);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        this.setStateAsync('sma_sunny_island_connected', {val: 'false', ack: true});
        this.setStateAsync('sma_sunny_tripower_connected', {val: 'false', ack: true});
        callback();
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Template(options);
} else {
    // otherwise start the instance directly
    new Template();
}
