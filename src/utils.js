// utils.js
const crypto = require('crypto');

const ELEMENT_WAIT_TIMEOUT = 5000;

async function verifyElement(element, timeout = ELEMENT_WAIT_TIMEOUT) {
    try {
        await element.waitForExist({ timeout });
        await element.waitForDisplayed({ timeout });
        return true;
    } catch (error) {
        return false;
    }
}

async function waitForStableDOM(driver, timeout = 2000) {
    let lastSource = await driver.getPageSource();
    
    await driver.pause(500); // Initial pause
    
    return await driver.waitUntil(async () => {
        const currentSource = await driver.getPageSource();
        const isStable = currentSource === lastSource;
        lastSource = currentSource;
        return isStable;
    }, {
        timeout,
        timeoutMsg: 'DOM did not stabilize',
        interval: 500
    }).catch(() => false);
}

// Helper function to generate MD5 hash for page source comparison
function getMD5Hash(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

module.exports = {
    getMD5Hash,
    verifyElement,
    waitForStableDOM
};
