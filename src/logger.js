// logger.js
function log(message) {
    console.log(`[LOG] ${message}`);
}

function logError(message) {
    console.error(`[ERROR] ${message}`);
}

module.exports = {
    log,
    logError,
};
