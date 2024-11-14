const { join } = require('path');

module.exports = {
    redis: {
        host: 'localhost',
        port: 6379
    },
    appium: {
        port: 4724,
    },
    capabilities: {
        'platformName': 'Android',
        'appium:deviceName': 'emulator-5554',
        'appium:platformVersion': '11.0',
        'appium:automationName': 'UiAutomator2',
        'appium:app': join(process.cwd(), 'apps/app.apk'),
        'appium:appPackage': 'com.wdiodemoapp',
        'appium:appActivity': '.MainActivity'
    },
    crawler: {
        maxClicksPerElement: 3,
        waitTimeout: 5000,
        homeActivity: '.MainActivity',
        maxCrashes: 10
    }
};