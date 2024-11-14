# Android App Crawler

An automated testing crawler for Android applications using Appium.

## Prerequisites

- Node.js (v12 or higher)
- Java Development Kit (JDK)
- Android SDK
- Appium Server
- Redis Server

## Setup

1. Install dependencies:
npm install
appium -p 4724


### Crawler Settings

The crawler can be customized with the following parameters:
- `maxClicksPerElement`: Maximum number of times to click each element (default: 3)
- `waitTimeout`: Time to wait for elements in milliseconds (default: 5000)
- `maxCrashes`: Maximum number of app crashes before stopping (default: 10)

## Device Setup

Ensure your Android emulator or device is:
- Running Android 11.0 or compatible version
- Connected and visible via `adb devices`
- The device ID matches the one in config (`emulator-5554`)

## Troubleshooting

1. Make sure Appium server is running on port 4724
2. Verify Redis server is running on default port (6379)
3. Confirm Android device/emulator is properly connected
4. Check that the APK path in config matches your setup


4. Place your Android APK in the `apps` folder as `app.apk`

## Configuration

The crawler is configured through `src/config.js` with the following main settings:
- Redis connection (default: localhost:6379)
- Appium server port (4724)
- Android device capabilities
- Crawler behavior parameters

## Usage

To start the crawler:

node crawl.js (refactoring in progress -latest one)
node index.js (old one)