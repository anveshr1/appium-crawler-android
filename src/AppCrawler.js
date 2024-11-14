const { createDriver, closeDriver } = require('./driver');
const { getMD5Hash } = require('./utils');
const ElementState = require('./ElementState');
const { getClickableElements, handleElementClick } = require('./elementHandler');
const { getCurrentActivity, launchAppIfNotOpened, navigateBack } = require('./activityHandler');
const { log, logError } = require('./logger');
const fs = require('fs');

class AppCrawler {
    static screenshotCounter = 0;
    static MAX_DEPTH = 10;
    static visitedElements = new Set ();

    constructor(options, appPackage, parentElementState = null) {
        this.options = options;
        this.appPackage = appPackage;
        this.driver = null;
        this.elementState = parentElementState || new ElementState(AppCrawler.visitedElements);;
        this.currentPageSource = null;
        this.currentHash = null;
        this.maxScrolls = 10;
        this.scrollCounter = 0;
    }

    async initialize() {
        if (!this.driver) {
            this.driver = await createDriver(this.options);
        }
        if (!this.elementState) {
            this.elementState = new ElementState(AppCrawler.visitedElements);
        }
        await launchAppIfNotOpened(this.driver, this.appPackage, this.elementState);
    }

    async takeScreenshot(context = '') {
        try {
            const screenshot = await this.driver.takeScreenshot();
            const filename = `screenshot_${AppCrawler.screenshotCounter++}_${context}.png`;
            fs.writeFileSync(`./screenshots/${filename}`, screenshot, 'base64');
            log(`Screenshot taken: ${filename}`);
        } catch (error) {
            logError(`Error taking screenshot: ${error.message}`);
        }
    }

    async scrollForward() {
        try {
            const beforeScroll = await this.driver.getPageSource();
            await this.driver.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollForward()');
            await this.driver.pause(1000);
            const afterScroll = await this.driver.getPageSource();
            
            // Check if scroll actually moved the page
            return getMD5Hash(beforeScroll) !== getMD5Hash(afterScroll);
        } catch (error) {
            logError(`Error scrolling: ${error.message}`);
            return false;
        }
    }

    async crawlPage(depth = 0) {
        try {
            if (depth >= AppCrawler.MAX_DEPTH) {
                log(`Maximum depth ${AppCrawler.MAX_DEPTH} reached, backtracking...`);
                return;
            }

            await launchAppIfNotOpened(this.driver, this.appPackage, this.elementState);
            log(`Exploring page at depth ${depth}`);

            let canScroll = true;
            this.scrollCounter = 0;

            do {
                // Get clickable elements on current screen
                const elements = await getClickableElements(this.driver);
                log(`Found ${elements.length} clickable elements`);


                // Filter out already visited elements before processing
                const unvisitedElements = elements.filter(element => {
                    const props = element.properties;
                    const elementId = `${props.resourceId}-${props.contentDesc}-${props.text}`;
                    return !AppCrawler.visitedElements.has(elementId);
                });

                // Process each element on current screen
                for (const element of unvisitedElements) {
                    try {
                        const props = element.properties;
                        const elementId = `${props.resourceId}-${props.contentDesc}-${props.text}`;
                        // Skip if already visited
                        if (AppCrawler.visitedElements.has(elementId)) {
                            continue;
                        }

                        // // Mark as visited before clicking - duplicate
                        // AppCrawler.visitedElements.add(elementId);

                        this.currentHash = getMD5Hash(await this.driver.getPageSource());

                        log(`Clicking element: ${elementId}`);
                        
                        // Click the element
                        await handleElementClick(this.driver, element, this.currentHash, this.elementState, AppCrawler.visitedElements);
                        
                        // Take screenshot after click
                        await this.takeScreenshot(`after_click_${elementId}`);

                        // Check if click led to a new page
                        const newPageSource = await this.driver.getPageSource();
                        const newHash = getMD5Hash(newPageSource);
                        
                        if (newHash !== this.currentHash) {
                            log('New page detected, exploring...');
                            // Create sub-crawler for new page
                            const subCrawler = new AppCrawler(this.options, this.appPackage, this.elementState);
                            subCrawler.driver = this.driver;
                            await subCrawler.crawlPage(depth + 1);
                            
                            // Navigate back after exploring sub-page
                            await navigateBack(this.driver, this.appPackage, this.elementState);
                            await this.driver.pause(1000);
                        }

                        // Update current state
                        this.currentPageSource = await this.driver.getPageSource();
                        this.currentHash = getMD5Hash(this.currentPageSource);

                    } catch (error) {
                        logError(`Error processing element: ${error.message}`);
                        await launchAppIfNotOpened(this.driver, this.appPackage, this.elementState);
                        continue;
                    }
                }

                // Try to scroll if we haven't reached the limit
                if (this.scrollCounter < this.maxScrolls) {
                    canScroll = await this.scrollForward();
                    if (canScroll) {
                        this.scrollCounter++;
                        this.elementState.recordScroll();
                        await this.takeScreenshot(`after_scroll_${this.scrollCounter}`);
                    }
                } else {
                    canScroll = false;
                }

            } while (canScroll);

        } catch (error) {
            logError(`Error in crawlPage: ${error.message}`);
            await launchAppIfNotOpened(this.driver, this.appPackage, this.elementState);
        }
    }

    async start() {
        try {
            await this.initialize();
            await this.crawlPage();
            log('Crawling completed successfully');
        } catch (error) {
            logError(`Crawler failed: ${error.message}`);
        } finally {
            if (this.driver) {
                await closeDriver(this.driver);
            }
        }
    }
}

module.exports = AppCrawler;