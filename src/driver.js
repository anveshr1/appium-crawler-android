// driver.js
const { remote } = require('webdriverio');

// Create and initialize a WebDriver session
async function createDriver(options) {
    try {
        console.log('Initializing Appium driver...');
        const driver = await remote(options);
        console.log('Driver initialized successfully!');
        return driver;
    } catch (error) {
        console.error('Error creating driver:', error.message);
        throw error;
    }
}

// Close the WebDriver session gracefully
async function closeDriver(driver) {
    try {
        console.log('Closing Appium driver session...');
        await driver.deleteSession();
        console.log('Driver session closed.');
    } catch (error) {
        console.error('Error closing driver:', error.message);
        throw error;
    }
}

// Launch the app if it's not already running (use mobile: activateApp for Android)
async function launchApp(driver, appPackage) {
    try {
        console.log('Launching the app...');

        // Use the mobile: activateApp command for Android
        await driver.execute('mobile: activateApp', {
            appPackage: appPackage,  // Provide the app package name for Android
        });

        console.log('App launched successfully.');
        await driver.pause(5000);  // Allow time for the app to load
    } catch (error) {
        console.error('Error launching app:', error.message);
        throw error;
    }
}

module.exports = {
    createDriver,
    closeDriver,
    launchApp,
};
