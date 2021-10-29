'use strict';

const utils = require('@iobroker/adapter-core');
const { chromium } = require('playwright');
const { JSDOM } = require('jsdom');
const atob = require('atob');

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;

let browser = false;
let context;

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
    const settings = JSON.parse(atob(adapter.config.setting));
    setSubscribers(settings);
    if(!browser) {
        openBrowser().then(() => readPages(settings));
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

async function readPages(setting) {
    for (const [pageName, pageSetting] of Object.entries(setting)) {
        const page = await context.newPage();
        if(pageSetting.options && pageSetting.options.reloadPageInterval_sec) {
            adapter.log.info(`reload page '${pageName}' every ${pageSetting.options.reloadPageInterval_sec}s`);
            setInterval(async() => {
                adapter.log.info(`reload page ${pageName}`);
                await page.reload();
            }, parseInt(pageSetting.options.reloadPageInterval_sec) * 1000); //30mins
        }
        
        for (const task of Object.values(pageSetting.tasks)) {
            adapter.log.info(`do task ${JSON.stringify(task)}`);
            if(task.action === 'readInterval') {
                        setInterval(async () => {
                            for (const intervalTask of Object.values(task.tasks)) {
                                await doTask(page, intervalTask);
                            }
                        }, task.options.time_ms);
            }
            await doTask(page, task);
        }
        
        adapter.log.info(`readPage ${pageName} with setting: ${JSON.stringify(pageSetting)}`);
    }
}

async function doTask(page, task) {
    
    adapter.log.info(`do Task: ${JSON.stringify(task)}`);
    
    if(task.options && task.options.setOnSuccess__state__) {
        adapter.setStateAsync(task.options.setOnSuccess__state__, {val: 'true', ack: true});
    }
    
    switch (task.action) {
        case "goto":
            await page.goto(task.url);
            break;
        case "waitForSelector":
            await page.waitForSelector(task.selector);
            break;
        case "selectOption":
            await page.selectOption(task.selector, { label: task.select_labeled });
            break;
        case "fill":
            await page.selectOption(task.selector, { label: task.value });
            break;
        case "click":
            await page.click(task.selector);
            break;
        case "waitForTimeout":
            await page.waitForTimeout(task.time_ms);
            break;
        case "readInterval":
            await page.waitForTimeout(task.time_ms);
            break;
        case "readElementToState":
            const content = await page.content();
            const dom = new JSDOM(content);
            if(dom && dom.window && dom.window.document) {
                const document = dom.window.document;
                let domElementContent = document.querySelector(task.selector) ? document.querySelector(task.selector).textContent : task.fallback;
                adapter.setStateAsync(task.__state__, {
                    val: domElementContent.toString(),
                    ack: true
                });
            }
            break;
    }
}

async function openBrowser() {
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

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
