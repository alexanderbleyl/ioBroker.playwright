'use strict';

/*
 * Created with @iobroker/create-adapter v1.34.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
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
        // this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
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
                    // "--no-sandbox",
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
            await page.selectOption('select#user', { label: 'User' });
            this.log.info(`try entering pwd ${this.config.sma_pass}`);
            await page.fill('input[name="password"]', this.config.sma_pass);
			// await page.click("[label=Benutzer]");
			await page.click("#bLogin");
			await page.waitForTimeout(2000);
            // content = await page.content();
            // this.log.info(content);
            
            const states = [
                'sma_status',
                'battery_operation',
                'battery_charge',
                'battery_watt',
                'grid_power_dir',
                'grid_power',
            ]
            states.forEach(state => {
                this.setObjectNotExists(state);
            });
            
            this.readContentInterval(5000);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        /*
        await this.setObjectNotExistsAsync('testVariable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });
        */

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        /*
        // the variable testVariable is set to true as command (ack=false)
        await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });
        */

        // examples for the checkPassword/checkGroup functions
        /*
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info('check user admin pw iobroker: ' + result);

        result = await this.checkGroupAsync('admin', 'admin');
        this.log.info('check group user admin group admin: ' + result);
        */
    }
    
    readContentInterval = (pauseTime) => {
        setInterval(async () => {
            content = await page.content();
            const dom = new JSDOM(content);
            // this.log.info(`dom child length: "${dom.window.document.body.children.length}"`);
            // this.log.info(`check element: ${dom.window.document.querySelector('#v6100_00295A00')? 'YES' : 'NO'}`);
            // this.log.info(`check element: ${ dom.window.document.querySelector('#v6100_00295A00').innerHTML}`);
            // this.log.info(`check element: ${ dom.window.document.querySelector('#v6100_00295A00').textContent}`);
            const smaStatus = dom.window.document.querySelector('#v6180_08214800') ? dom.window.document.querySelector('#v6180_08214800').textContent : 'unknown';
            this.setState('sma_status', smaStatus);
            const batteryTile = dom.window.document.querySelector('#v6100_00295A00').parentElement.parentElement.parentElement.parentElement.parentElement || false;
            const batteryOperation = batteryTile && batteryTile.querySelectorAll('tr')[0].querySelectorAll('td')[2].textContent || 'unknown';
            this.setState('battery_operation', batteryOperation);
            const batteryCharge = batteryTile && batteryTile.querySelectorAll('tr')[1].querySelectorAll('td')[1].textContent || 'unknown';
            this.setState('battery_charge', batteryCharge);
            const batteryWatt = batteryTile && batteryTile.querySelectorAll('tr')[2].querySelectorAll('td')[1].textContent || 'unknown';
            this.setState('battery_watt', batteryWatt);
            let gridPowerDir = dom.window.document.querySelector('[src="images/icons/arrowGr.png"]')? 'Out' : 'unknown';
            gridPowerDir = dom.window.document.querySelector('[src="images/icons/arrowRd.png"]')? 'In' : gridPowerDir;
            this.setState('grid_power_dir', gridPowerDir);
            const gridPower = dom.window.document.querySelector('[ng-controller="gridConnectionPointOverview"]') && dom.window.document.querySelector('[ng-controller="gridConnectionPointOverview"]').querySelector('.tileValues.ng-binding')? dom.window.document.querySelector('[ng-controller="gridConnectionPointOverview"]').querySelector('.tileValues.ng-binding').textContent : 'unknown';
            this.setState('grid_power', gridPower);
        }, pauseTime);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
    
            page.click("#lLogoutLogin");
            page.waitForTimeout(2000);
            browser.close();
            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    // onStateChange(id, state) {
    //     if (state) {
    //         // The state was changed
    //         this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    //         try {
    //             this.log.info(`send message to Discord "${state.val}"`);
    //             //Do something when a state changes
    //         } catch (e) {
    //             this.log.info(`could not send message "${state.val}"`);
    //         }
    //     } else {
    //         // The state was deleted
    //         this.log.info(`state ${id} deleted`);
    //     }
    // }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

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
