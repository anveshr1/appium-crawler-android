const { createDriver, closeDriver } = require('./driver');
const { getMD5Hash } = require('./utils');
const ElementState = require('./ElementState');
const { getClickableElements, handleElementClick } = require('./elementHandler');
const { getCurrentActivity, launchAppIfNotOpened, navigateBack } = require('./activityHandler');
const { log, logError } = require('./logger');
const { join } = require('path');
const fs = require('fs');
const { exit } = require('process');
const { cloneDeep } = require('lodash');
const { first } = require('lodash');

// Appium options (make sure to update paths and values as per your setup)
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

const appPackage = 'com.wdiodemoapp';  // Correct app package

(async () => {
    const driver = await createDriver(options);

    const visitedElements = new Set();  // Tracks visited elements globally
    const elementState = new ElementState();
    let currentPageSource = await driver.getPageSource();
    let currentHash = getMD5Hash(currentPageSource);
    await launchAppIfNotOpened(driver, appPackage, elementState);


    const pageStack = [];  // Stack for backtracking through pages
    // Scroll counter for limiting scrolls
    const maxScrolls = 10;  // Max scrolls per page

    let scrollCounter = 0;
    let screenshotCounter = 0;
    // let indexOutOfBoundsCounter = 0;
    // const indexOutOfBoundsLimit = 10;

    try {


        async function getSkipElements(elements) {
            const skipElements = [];
            for (const element of elements) {
                const resourceId = await element.getAttribute('resource-id');
                const contentDesc = await element.getAttribute('content-desc');
                const text = await element.getText();
                const elementId = `${resourceId}-${contentDesc}-${text}`;
                skipElements.push(elementId);
            }
            return skipElements;
        }

        async function hasUnprocessedElements(clickableElements, skipElements) {
            for (const element of clickableElements) {
                const resourceId = await element.getAttribute('resource-id');
                const contentDesc = await element.getAttribute('content-desc');
                const text = await element.getText();
                const elementId = `${resourceId}-${contentDesc}-${text}`;

                if (!visitedElements.has(elementId) && !skipElements.includes(elementId)) {
                    return true;
                }
            }
            return false;
        }



        async function scrollPageAndTakeScreenshot(initialPageSource, driver) {
            try {
                if (scrollCounter < maxScrolls) {
                    currentPageSource = await driver.getPageSource();
                    currentHash = getMD5Hash(currentPageSource);  // Compute hash for current page source
                    const initialHash = getMD5Hash(initialPageSource);
                    // Scroll down using UiScrollable
                    const uiScrollable = await driver.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollForward()');
                    // const isScrollable = await uiScrollable.isDisplayed(); // Check if scrollable element is displayed

                    // if (!isScrollable) {
                    //     log('No more scrollable content');
                    //     return false;  // Indicate end of page scroll
                    // }
                    scrollCounter++;
                    await driver.pause(1000);  // Wait for content to load

                    const newPageSource = await driver.getPageSource();
                    const newHash = getMD5Hash(newPageSource);
                    if (initialHash === newHash || currentHash === newHash) {
                        log('End of scrollable content detected');
                        return false;  // Indicate end of page scroll
                    }

                    // Take screenshot after scrolling
                    const screenshot = await driver.takeScreenshot();
                    const filename = `screenshot_${screenshotCounter++}.png`;
                    fs.writeFileSync(`./screenshots/${filename}`, screenshot, 'base64');

                    log(`Screenshot taken: ${filename}`);
                    await launchAppIfNotOpened(driver, appPackage, elementState);
                    return true;  // Indicate scroll can continue

                } else {
                    log('Maximum scrolls reached for this page');
                    await launchAppIfNotOpened(driver, appPackage, elementState);
                    return false;  // Indicate end of scroll limit
                }
            } catch (error) {
                logError(`Error while scrolling and taking screenshot: ${error.message}`);
                await launchAppIfNotOpened(driver, appPackage, elementState);
                return false;
            }
        }

        // Compare clickableElements and newElements and if they are the same, return. Order of elements doesn't matter.
        const areElementsSame = (elements1, elements2) => {
        if (elements1.length !== elements2.length) return false;

        const elements1Set = new Set(elements1.map(element => JSON.stringify(element.properties)));
        const elements2Set = new Set(elements2.map(element => JSON.stringify(element.properties)));

        for (const elem of elements1Set) {
            if (!elements2Set.has(elem)) return false;
        }

        return true;
        };

        async function crawlPage(skipElements = [], newElements = []) {
            try {
                await launchAppIfNotOpened(driver, appPackage, elementState);
                const currentActivity = await getCurrentActivity(driver);
                log(`Current activity: ${currentActivity}`);

                const clickableElements = await getClickableElements(driver);
 

                if (areElementsSame(clickableElements, newElements)) {
                    log('Clickable elements and new elements are the same. Exiting crawlPage.');
                    return;
                }
                console.log(`Found ${clickableElements.length} clickable elements.`);

                if (clickableElements.length === 0) {
                    log('No clickable elements found');
                    return;
                }

                const newSkipElements = await getSkipElements(clickableElements);
                // console.log('Common elements to skip:', newSkipElements);

                // Filter out already visited elements
                const unvisitedElements = clickableElements.filter(element => {
                    const props = element.properties;
                    const elementId = `${props.resourceId}-${props.contentDesc}-${props.text}`;
                    return !elementState.visitedElements.has(elementId) && !skipElements.includes(elementId);
                });

                console.log(`Found ${unvisitedElements.length} unvisited elements`);

                if (unvisitedElements.length === 0) {
                    log('No unvisited elements found, backtracking...');
                    await navigateBack(driver, appPackage, elementState);
                    return;
                }

                scrollCounter = 0;

                for (const element of unvisitedElements) {
                    try {
                        const props = element.properties;
                        console.log('Processing element:', props);

                        // currentPageSource = await driver.getPageSource();
                        // currentHash = getMD5Hash(currentPageSource);

                        currentHash = await handleElementClick(driver, element, currentHash, elementState);

                        // Take screenshot
                        const screenshot = await driver.takeScreenshot();
                        const filename = `screenshot_${screenshotCounter++}.png`;
                        fs.writeFileSync(`./screenshots/${filename}`, screenshot, 'base64');
                        log(`Screenshot taken: ${filename}`);

                        // Scroll and process elements after click
                        let canScroll = true;
                        let firstExecution = true;
                        while (canScroll && scrollCounter < maxScrolls) {
                            const initialPageSource = await driver.getPageSource();
                            const newElements = await getClickableElements(driver);
                            canScroll = await scrollPageAndTakeScreenshot(initialPageSource, driver);
                            elementState.recordScroll();
                            const elementInfo = {
                                ...element.properties,
                                elementId: `${element.properties.resourceId}-${element.properties.contentDesc}-${element.properties.text}`,
                                timestamp: new Date().toISOString()
                            };
                            elementState.addToClickPath(elementInfo);
                            console.log(canScroll, scrollCounter)
                            if (canScroll || !canScroll && firstExecution) {
                                // Get new elements after scroll
                                firstExecution = false;
                                const totalSkipElementss = [...skipElements, ...newElements];
                                await crawlPage(totalSkipElementss, newElements);
                            } 

                        }

                        // Recursive crawl
                        await crawlPage(skipElements);
                        return;
                        // newPageSource = await driver.getPageSource();
                        // newHash = getMD5Hash(newPageSource);
                        // Navigate back
                        // if(newHash !== currentHash)

                        // Uncomment this later

                        // if (unvisitedElements.length === 0) {
                        //     log('No unvisited elements found, backtracking...');
                        //     await navigateBack(driver, appPackage, elementState);
                        //     return;
                        // }

                    } catch (error) {
                        logError(`Error processing element: ${error.message}`);
                        continue;
                    }
                }
            } catch (error) {
                logError(`Error in crawlPage: ${error.message}`);
            }
        }

        // async function crawlPage(skipElements = []) {
        //     await launchAppIfNotOpened(driver, appPackage);
        //     const currentActivity = await getCurrentActivity(driver);
        //     log(`Current activity: ${currentActivity}`);

        //     if (pageStack.length > 0) {
        //         const previousState = pageStack[pageStack.length - 1];
        //         elementState.clickPath = [...previousState.clickPath];
        //     }

        //     const clickableElements = await getClickableElements(driver);

        //     if (clickableElements.length === 0) {
        //         log('No more clickable elements found');
        //         return;
        //     }

        //     const unvisitedElements = clickableElements.filter(async (element) => {
        //         const resourceId = await element.getAttribute('resource-id');
        //         const contentDesc = await element.getAttribute('content-desc');
        //         const text = await element.getText();
        //         const elementId = `${resourceId}-${contentDesc}-${text}`;
        //         return !visitedElements.has(elementId);
        //     });

        //     if (unvisitedElements.length === 0) {
        //         log('No more clickable elements found');
        //         return;
        //     }

        //     if (!await hasUnprocessedElements(clickableElements, skipElements)) {
        //         log('All elements are either visited or in skip list');
        //         return;
        //     }

        //     console.log('unvisitedElements', unvisitedElements.length);
        //     const skipElementsss = await getSkipElements(unvisitedElements);
        //     console.log('skipElements', skipElementsss);

        //     console.log('skipElements', skipElements);
        //     for (const element of clickableElements) {
        //         try {
        //             const resourceId = await element.getAttribute('resource-id');
        //             const contentDesc = await element.getAttribute('content-desc');
        //             const text = await element.getText();
        //             const elementId = `${resourceId}-${contentDesc}-${text}`;
        //             if (visitedElements.has(elementId)) {
        //                 log(`Element already visited: ${elementId}`);
        //                 continue;  // Skip to the next element
        //             }
        //             if(skipElements.includes(elementId)) {
        //                 log(`Element marked as skip element: ${elementId}`);
        //                 continue;  // Skip to the next element
        //             }
        //             console.log('elementId', elementId);
        //             currentPageSource = await driver.getPageSource();
        //             currentHash = getMD5Hash(currentPageSource);
        //             // pageStack.push({ visitedElements: new Set(visitedElements), currentHash, clickableElements: [...clickableElements] });
        //             pageStack.push({
        //                 clickPath: [...elementState.getClickPath()],
        //                 visitedElements: new Set(elementState.visitedElements),
        //                 currentHash: elementState.currentHash
        //             });
        //             currentHash = await handleElementClick(driver, element, currentHash, elementState);
        //             // Take screenshot after handling element click
        //             const screenshot = await driver.takeScreenshot();
        //             const filename = `screenshot_${screenshotCounter++}.png`;
        //             fs.writeFileSync(`./screenshots/${filename}`, screenshot, 'base64');
        //             log(`Screenshot taken: ${filename}`);
        //             await launchAppIfNotOpened(driver, appPackage);
        //             scrollCounter = 0;  // Reset scroll counter for each new page

        //             // Scroll and take screenshots until we reach the end
        //             let canScroll = true;
        //             while (canScroll) {
        //                 const initialPageSource = await driver.getPageSource();
        //                 canScroll = await scrollPageAndTakeScreenshot(initialPageSource, driver);
        //                 await crawlPage([...skipElements, ...await getSkipElements(unvisitedElements)]);
        //             }

        //             await crawlPage(skipElements);
        //             // Navigate back and relaunch the app
        //             await navigateBack(driver);
        //             if (pageStack.length > 0) {
        //                 const previousState = pageStack.pop();
        //                 elementState.clickPath = previousState.clickPath;
        //                 elementState.visitedElements = new Set(previousState.visitedElements);
        //                 elementState.currentHash = previousState.currentHash;
        //             }
        //             const opened = await launchAppIfNotOpened(driver, appPackage);
        //             if (opened) {
        //                 continue;
        //             }
        //             const backActivity = await getCurrentActivity(driver);
        //             log(`Back to activity: ${backActivity}`);

        //             // Restore previous state
        //             // const previousState = pageStack.pop();
        //             // previousState.visitedElements.forEach((el) => visitedElements.add(el));
        //             // currentHash = previousState.currentHash;

        //         } catch (error) {
        //             logError(`Error processing element: ${error.message}`);
        //             // if (elementState.lastStableState) {
        //             //     log('Attempting to recover using last stable state...');
        //             //     await elementState.retraceClickPath(driver, appPackage);
        //             // }
        //             if (error.message.includes('Index out of bounds')) {
        //                 console.log('Index out of bounds');
        //                 indexOutOfBoundsCounter++;
        //                 if (indexOutOfBoundsCounter > indexOutOfBoundsLimit) {
        //                     // stop the script and return done
        //                     process.exit(0);
        //                     // exit the process
        //                 }
        //                 break;  // Exit out of the for loop
        //             } else {
        //                 continue;  // Skip to the next element
        //             }
        //         }
        //     }
        // }

        await crawlPage(); // Start the recursive crawling

    } catch (error) {
        logError(`Crawler failed: ${error.message}`);
    } finally {
        await closeDriver(driver);
    }
})().catch((error) => {
    logError(`Error in automation script: ${error.message}`);
});
