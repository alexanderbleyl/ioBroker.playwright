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
    for (const [pageName, pageSetting] of Object.entries(setting)) {
        for (const [key, state] of Object.entries(flattenObject(pageSetting))) {
            if(key.indexOf('__state__') > 0) {
                adapter.setObjectNotExistsAsync(pageName + '.' + state, {
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
            setInterval(async() => {
                await page.reload();
            }, parseInt(pageSetting.options.reloadPageInterval_sec) * 1000); //30mins
        }
        
        for (let i = 0; i < Object.keys(pageSetting.tasks).length; i++) {
            const task = pageSetting.tasks[i];
            if(task.action === 'readInterval') {
                setInterval(async () => {
                    for (let j = 0; j < Object.keys(task.tasks).length; j++) {
                        await doTask(page, pageName, task.tasks[j]);
                    }
                }, task.options.time_ms);
            }
            await doTask(page, pageName, task);
        }
    }
}

async function doTask(page, pageName, task) {
    if(task.options && task.options.setOnSuccess__state__) {
        adapter.setStateAsync(pageName + '.' + task.options.setOnSuccess__state__, {val: 'true', ack: true});
    }
    
    try {
        switch (task.action) {
            case "goto":
                await page.goto(task.url);
                adapter.log.info(`opened page ${task.url}`);
                break;
            case "waitForSelector":
                await page.waitForSelector(task.selector);
                break;
            case "selectOption":
                await page.selectOption(task.selector, { label: task.select_labeled });
                break;
            case "fill":
                await page.fill(task.selector, task.value);
                break;
            case "click":
                await page.click(task.selector);
                break;
            case "waitForTimeout":
                await page.waitForTimeout(parseInt(task.time_ms));
                break;
            case "readElementToState":
                const content = await page.content();
                const dom = new JSDOM(content);
                adapter.log.info(`get dom: ${JSON.stringify(dom)}`);
                // if(dom && dom.window && dom.window.document) {
                //     const document = dom.window.document;
                //     adapter.log.warn(`task with selector '${task.selector}' found`);
                //     // let domElementContent = document.querySelector(task.selector) ? document.querySelector(task.selector).textContent : task.fallback;
                //     // adapter.setStateAsync(pageName + '.' + task.__state__, {
                //     //     val: domElementContent.toString(),
                //     //     ack: true
                //     // });
                // }
                break;
        }
    } catch (e) {
        adapter.log.warn(`could not do Task: ${JSON.stringify(task)}: '${e}'`);
    }
    
    if(task.log) {
        adapter.log.info(task.log);
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
