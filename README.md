laevitas-scraper
================

The source code in this repository is a rapid implementation to automate data retrieval from a more complex web application.

### pre-requisites
This repository is mainly built around [Node](https://nodejs.org/en/) and has been tested with `v14.17.0 LTS`

### usage
Clone the repository and enter the directory it is cloned in and make sure you install dependencies with `npm install`.

#### flags
```
# - HEADLESS={true, false}
#   runs without browser or showing browser respectively

# - DEBUG=laevitas-scaper*
#   runs displaying results of individual steps
```

#### running
Different ways in which this program can be run

**1. get eth expiries without debugging or logging**
<br>`node index.js eth`

**2. manual call to show browser and log everything for btc**
<br>`HEADLESS=false DEBUG=laevitas-scaper* node index.js btc`

**3. same as the above but without showing browser**
<br>`npm run verbose`

**4. same as 2 but shorthand**
<br>`npm run debug`

**5. same as 1 but for btc**
<br>`npm run start`

#### deployment
The repository has been optimised to run on Heroku, the steps below will get you set up with the run as a one-time process which sends an email with the download link for scraped data. This process can be run on-demand or at a set interval. All steps and execution will be described below.
[WIP]
