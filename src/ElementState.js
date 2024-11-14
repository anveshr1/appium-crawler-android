class ElementState {
    constructor(visitedElements = null) {
        this.clickPath = [];
        this.visitedElements = visitedElements ? visitedElements : new Set();
        this.currentHash = null;
        this.lastStableState = null;
        this.scrollsOnCurrentPage = 0; 
    }

    addToClickPath(element = {}) {
        const elementInfo = {
            ...element,
            type: 'click',
            timestamp: new Date().toISOString()
        };
        this.clickPath.push(elementInfo);
    }

    getClickPath() {
        return this.clickPath;
    }

    recordScroll() {
        const scrollInfo = {
            type: 'scroll',
            timestamp: new Date().toISOString()
        };
        this.clickPath.push(scrollInfo);
        this.scrollsOnCurrentPage++;
    }

    clearClickPath() {
        this.clickPath = [];
    }

    getCurrentState() {
        return {
            clickPath: this.clickPath,
            visitedElements: Array.from(this.visitedElements),
            currentHash: this.currentHash
        };
    }

    saveStableState() {
        this.lastStableState = {
            clickPath: [...this.clickPath],
            visitedElements: new Set(this.visitedElements),
            currentHash: this.currentHash
        };
    }

    async retraceClickPath(driver, appPackage) {
        if (!this.lastStableState || this.lastStableState.clickPath.length === 0) {
            console.log('could not find last stable state')
            return false;
        }

        try {
            // Restart app fresh
            await driver.terminateApp(appPackage);
            await driver.pause(1000);
            await driver.activateApp(appPackage);
            await driver.pause(3000);

            // Retrace each click in the path
            for (const elementInfo of this.lastStableState.clickPath) {

                // First do the scrolls needed on this page
                // for (let i = 0; i < pathEntry.scrollsBeforeClick; i++) {
                //     await driver.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollForward()');
                //     await driver.pause(1000);
                // }

                const { resourceId, contentDesc, text, type } = elementInfo;
                if (type === 'scroll') {
                    await driver.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollForward()');
                    await driver.pause(500);
                    continue;
                }
                const selectorParts = [];
                if (resourceId && resourceId != "null") selectorParts.push(`.resourceId("${resourceId}")`);
                if (contentDesc) selectorParts.push(`.description("${contentDesc}")`);
                if (text) selectorParts.push(`.text("${text}")`);

                const selector = `android=new UiSelector()${selectorParts.join('')}`;
                const element = await driver.$(selector);
                await element.waitForDisplayed({ timeout: 5000 });
                
                if (elementInfo.isInput) {
                    await element.setValue(elementInfo.value || 'random');
                } else {
                    await element.click();
                }
                await driver.pause(1000);
            }

            return true;
        } catch (error) {
            console.error('Failed to retrace click path:', error);
            return false;
        }
    }

    async navigateToPathIndex(driver, appPackage, targetIndex) {
        try {
            // Reset to initial state
            await driver.terminateApp(appPackage);
            await driver.pause(1000);
            await driver.activateApp(appPackage);
            await driver.pause(1000);
    
            let skipCount = 0;
            // Retrace steps up to the target index
            for (let i = 0; i <= targetIndex; i++) {
                const elementInfo = this.clickPath[i];
                if (!elementInfo) continue;
    
                const { resourceId, contentDesc, text, isInput, value, type } = elementInfo;
                if (type === 'scroll') {
                    await driver.$('android=new UiScrollable(new UiSelector().scrollable(true)).scrollForward()');
                    await driver.pause(500);
                    continue;
                }
    
                const selectorParts = [];
                if (resourceId && resourceId !== "null") selectorParts.push(`.resourceId("${resourceId}")`);
                if (contentDesc) selectorParts.push(`.description("${contentDesc}")`);
                if (text) selectorParts.push(`.text("${text}")`);
    
                const selector = `android=new UiSelector()${selectorParts.join('')}`;
                const element = await driver.$(selector);
                
                try {
                    await element.waitForDisplayed({ timeout: 1000 });
                    
                    if (isInput) {
                        await element.setValue(value || 'random');
                    } else {
                        await element.click();
                    }
                    await driver.pause(1000);
                    skipCount = 0; // Reset skip counter on successful interaction
                } catch (error) {
                    console.error(`Failed to interact with element at index ${i}:`, error);
                    skipCount++;
                    if (skipCount > 3) {
                        return false; // Only fail after 3 consecutive failures
                    }
                    console.log(`Skipping element at index ${i} and continuing...`);
                    continue; // Skip this element and try the next one
                }
            }
            return true;
        } catch (error) {
            console.error('Error in navigateToPathIndex:', error);
            return false;
        }
    }
}

module.exports = ElementState;