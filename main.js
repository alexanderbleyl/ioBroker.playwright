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

let browser;
let page;
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
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
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
            const context = await browser.newContext();
            page = await context.newPage();
            this.log.info(`opened new page`);
            await page.goto(this.config.sma_url);
            this.log.info(`called ${this.config.sma_url}`);
            await page.waitForSelector('#password');
            this.log.info(`password input detected`);
            await page.selectOption('select#user', { label: 'User' });
            this.log.info(`try entering pwd`);
            await page.fill('input[name="password"]', this.config.sma_pass);
            await page.waitForSelector('#bLogin');
			await page.click("#bLogin");
			await page.waitForTimeout(25000);
            this.readContentInterval(5000);
            setInterval(async() => {
                await page.reload();
            }, 1000 * 60 * 30); //30mins
    }
    
    readContentInterval = (pauseTime) => {
        setInterval(async () => {
            content = await page.content();
            const dom = new JSDOM(content);
            if(dom && dom.window && dom.window.document) {
                this.setStateAsync('sma_connected', {val: 'true', ack: true});
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

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            page.click("#lLogoutLogin");
            page.waitForTimeout(2000);
            browser.close();
            this.setStateAsync('sma_connected', {val: 'false', ack: true});
            callback();
        } catch (e) {
            this.setStateAsync('sma_connected', {val: 'false', ack: true});
            callback();
        }
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
