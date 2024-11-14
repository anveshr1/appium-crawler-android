// elementHandler.js
const { getMD5Hash, waitForStableDOM, verifyElement } = require('./utils');
const { launchAppIfNotOpened } = require('./activityHandler');

async function getElementProperties(element) {
    try {
        const [resourceId, contentDesc, text] = await Promise.all([
            element.getAttribute('resource-id').catch(() => ''),
            element.getAttribute('content-desc').catch(() => ''),
            element.getText().catch(() => '')
        ]);
        
        return { resourceId, contentDesc, text };
    } catch (error) {
        return null;
    }
}


// Get all clickable elements from the page
async function getClickableElements(driver) {
    try {
        // Wait for DOM to stabilize
        await waitForStableDOM(driver);

        // const elements = await driver.$$('*[clickable="true"]');
        // Get all clickable elements
        // const elements = await driver.$$(
        //     'android=new UiSelector()' +
        //     '.clickable(true)' +
        //     '.enabled(true)' +  // Only get enabled elements
        //     '.displayed(true)'  // Only get displayed elements
        // );
        const elements = await driver.$$('*[clickable="true"][enabled="true"]');
        console.log(`Found ${elements.length} clickable elements.`);

        const verifiedElements = [];
        for (const element of elements) {
            try {
                const isValid = await verifyElement(element);
                if (isValid) {
                    // Get element properties safely
                    const props = await getElementProperties(element);
                    if (props) {
                        element.properties = props;
                        verifiedElements.push(element);
                    }
                }
            } catch (error) {
                continue; // Skip problematic elements
            }
        }
        console.log(verifiedElements.map(elem => elem.properties))
        return verifiedElements;
    } catch (error) {
        logError(`Error getting clickable elements: ${error.message}`);
        return [];
    }

}

async function getTextElements(driver) {
    return await driver.$$('input[type="text"], textarea');
}

async function setText(element, text) {
    console.log(`Setting text '${text}' in text field.`);
    await element.setValue(text);
}

async function handleElementClick(driver, element, currentHash, elementState, visitedElements) {
    const isValid = await verifyElement(element);
    if (!isValid) {
        return currentHash;
    }
    
    const props = element.properties || await getElementProperties(element);
    if (!props) {
        return currentHash;
    }
    
    const elementId = `${props.resourceId}-${props.contentDesc}-${props.text}`;
    console.log('Checking if element was visited:', elementId);
    console.log('Current visited elements:', Array.from(visitedElements));

    // Check if element was already visited
    if (visitedElements.has(elementId)) {
        console.log('Element already visited, skipping:', elementId);
        return currentHash;
    }

    // Mark element as visited BEFORE clicking
    visitedElements.add(elementId);
    console.log('Added to visited elements:', elementId);
    const tagName = await element.getTagName();
    elementState.saveStableState();
    elementState.addToClickPath({
        ...props,
        elementId,
        isInput: tagName === 'input' || tagName === 'textarea' || tagName.includes('input'),
        value: tagName === 'input' || tagName === 'textarea' || tagName.includes('input') ? 'random' : undefined,
        timestamp: new Date().toISOString()
    });

    try {
        // Perform the click
        if (tagName === 'input' || tagName === 'textarea' || tagName.includes('input')) {
            await element.setValue('random');
        } else {
            await element.click();
        }

        // Wait for page change and return new hash
        await driver.waitUntil(
            async () => {
                const pageSource = await driver.getPageSource();
                return getMD5Hash(pageSource) !== currentHash;
            },
            {
                timeout: 2000,
                timeoutMsg: 'Page did not change after click'
            }
        ).catch(() => {});  // Ignore timeout

        return getMD5Hash(await driver.getPageSource());
    } catch (error) {
        console.log('Error during click:', error.message);
        return currentHash;
    }
}

// // Handle clicking on an element and waiting for page source changes
// async function handleElementClick(driver, element, currentHash, elementState) {
//     // Check if the app is in the foreground
//     // const appPackage = 'com.wdiodemoapp';
//     // await launchAppIfNotOpened(driver, appPackage, elementState);

//     const isValid = await verifyElement(element);
//     if (!isValid) {
//         return
//         // throw new Error('Element is no longer valid');
//     }
    
//     // Use cached properties if available
//     const props = element.properties || await getElementProperties(element);
//     if (!props) {
//         return
//         // throw new Error('Unable to get element properties');
//     }
    
//     const elementId = `${props.resourceId}-${props.contentDesc}-${props.text}`;


//     // const resourceId = await element.getAttribute('resource-id');
//     // const contentDesc = await element.getAttribute('content-desc');
//     // const text = await element.getText();
//     // const elementId = `${resourceId}-${contentDesc}-${text}`;

//     if (elementState.visitedElements.has(elementId)) return currentHash;

//     // Save the current stable state before clicking
//     elementState.saveStableState();


//     // Add element to click path before clicking
//     elementState.addToClickPath({
//         ...props,
//         elementId,
//         timestamp: new Date().toISOString()
//     });

//     elementState.visitedElements.add(elementId);
//     console.log('Clicking element:', elementId);
//     console.log('Current click path:', JSON.stringify(elementState.getClickPath(), null, 2));
//     // Check if it's a text field and set a value
//     const tagName = await element.getTagName();
//     console.log(`TagName: ${tagName}`);
//     if (tagName === 'input' || tagName === 'textarea' || tagName.includes('input')) {
//         console.log(`Found text field, entering text 'random'`);
//         await setText(element, 'random');
//     } else {
//         // Handle non-text fields (clicking)
//         await element.click();
//     }

//     // Wait for page source to change after clicking
//     const newHash = await waitForPageChange(driver, currentHash);
//     elementState.currentHash = newHash;
//     return currentHash;
// }

async function waitForPageChange(driver, currentHash, timeout = 5000) {
    try {
        await driver.waitUntil(async () => {
            const pageSource = await driver.getPageSource();
            const newHash = getMD5Hash(pageSource);
            return newHash !== currentHash;
        }, {
            timeout,
            timeoutMsg: 'Page did not change after click'
        });
        
        return getMD5Hash(await driver.getPageSource());
    } catch (error) {
        return currentHash; // Return original hash if no change detected
    }
}

module.exports = {
    getClickableElements,
    handleElementClick,
    getTextElements,
};
