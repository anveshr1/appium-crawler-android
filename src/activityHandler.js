// activityHandler.js
const { log, logError } = require('./logger');
const config = require('./config')
let crashCount = 0;
const MAX_RETRACE_ATTEMPTS = 3;
// Get the current activity from the driver
async function getCurrentActivity(driver) {
    try {
        const activity = await driver.getCurrentActivity();
        log(`Current activity: ${activity}`);
        return activity;
    } catch (error) {
        logError(`Error getting current activity: ${error.message}`);
        throw error;
    }
}

// Launch the app if it's not already running (use mobile: activateApp for Android)
async function launchAppIfNotOpened(driver, appPackage, elementState) {
    try {

        if (!elementState) {
            throw new Error('elementState is required for launchAppIfNotOpened');
        }
        // Check if app is running using mobile: queryAppState
        const appState = await driver.execute('mobile: queryAppState', {
            appId: appPackage
        });


        if (appState === 1) { // Not running (possible crash)
            crashCount++;
            log(`Possible crash detected. Crash count: ${crashCount}`);
            
            if (crashCount >= config.crawler.maxCrashes) {
                logError(`Maximum crash limit (${config.crawler.maxCrashes}) reached. Stopping execution.`);
                process.exit(1);
            }

            // Attempt to recover by retracing steps
            let retraceAttempt = 0;
            let retraceSuccessful = false;
            await driver.execute('mobile: activateApp', {
                appId: appPackage
            });
            await driver.pause(2000);
            while (retraceAttempt < MAX_RETRACE_ATTEMPTS && !retraceSuccessful) {
                log(`Attempting to retrace steps (attempt ${retraceAttempt + 1}/${MAX_RETRACE_ATTEMPTS})`);
                retraceSuccessful = await elementState.retraceClickPath(driver, appPackage);
                
                if (!retraceSuccessful) {
                    retraceAttempt++;
                    await driver.pause(1000);
                }
            }

            if (!retraceSuccessful) {
                logError('Failed to recover from crash after multiple attempts');
                throw new Error('Failed to recover from crash');
            }

            log('Successfully retraced steps after crash');
            return true;
        }

        if (appState < 4) {
            log(`App is not running in foreground (state: ${appState}). Launching the app...`);
            
            await driver.execute('mobile: activateApp', {
                appId: appPackage
            });

            // Allow some time for the app to open
            await driver.pause(2000);

            const newAppState = await driver.execute('mobile: queryAppState', {
                appId: appPackage
            });

            if (newAppState < 3) {
                logError(`Failed to launch app to foreground state`);
                throw new Error(`App failed to launch to foreground state. Current state: ${newAppState}`);
            }

            log(`App launched successfully to foreground`);
            return true;

        } else {
            log('App is already running in foreground.');
        }
    } catch (error) {
        logError(`Error in launchAppIfNotOpened: ${error.message}`);
        throw error;
    }
}

// Navigate back to the previous screen
// async function navigateBack(driver) {
//     try {
//         console.log('Navigating back');
//         await driver.back();
//         await driver.pause(2000);  // Allow time for the back action to complete
//     } catch (error) {
//         logError(`Error navigating back: ${error.message}`);
//     }
// }

// async function navigateBack(driver, appPackage, elementState) {
//     try {
//         console.log('Navigating back');
//         await driver.back();
//         await driver.pause(2000);  // Allow time for the back action to complete
        
//         // Check if app is still running after back navigation
//         const appState = await driver.execute('mobile: queryAppState', {
//             appId: appPackage
//         });

//         if (appState < 4) {
//             log('App not in foreground after back navigation, attempting to relaunch...');
//             await launchAppIfNotOpened(driver, appPackage, elementState);
//         }
//     } catch (error) {
//         logError(`Error navigating back: ${error.message}`);
//         // Try to recover by launching app
//         await launchAppIfNotOpened(driver, appPackage, elementState);
//     }
// }

async function navigateBack(driver, appPackage, elementState) {
    try {
        if (elementState.clickPath.length === 0) {
            log('No click path available, cannot navigate back');
            return false;
        }

        // Remove the last step from the click path
        elementState.clickPath.pop();
        
        // Navigate to the previous state using the updated click path
        const targetIndex = elementState.clickPath.length - 1;
        const success = await elementState.navigateToPathIndex(driver, appPackage, targetIndex);
        
        if (!success) {
            logError('Failed to navigate back using click path');
            // Optionally: implement fallback strategy here
            return false;
        }

        return true;
    } catch (error) {
        logError(`Error navigating back: ${error.message}`);
        return false;
    }
}


module.exports = {
    getCurrentActivity,
    launchAppIfNotOpened,
    navigateBack,
};
