const { join } = require('path');
const AppCrawler = require('./AppCrawler');

const options = {
    port: 4724,
    logLevel: 'error',
    capabilities: {
        platformName: 'Android',
        'appium:deviceName': 'emulator-5554',
        'appium:platformVersion': '11.0',
        'appium:automationName': 'UiAutomator2',
        'appium:app': join(process.cwd(), 'apps/app.apk'),
    },
};

const appPackage = 'com.wdiodemoapp';

(async () => {
    const crawler = new AppCrawler(options, appPackage);
    try {
        await crawler.start();
    } catch (error) {
        console.error(`Error in automation script: ${error.message}`);
    }
})();