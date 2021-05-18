laevitas-scraper
================

The source code in this repository is a rapid implementation to automate data retrieval from a more complex web application.

### pre-requisites
This repository is mainly built around [Node](https://nodejs.org/en/) and has been tested with `v14.17.0 LTS`

### usage
Clone the repository and enter the directory it is cloned in and make sure you install dependencies with `npm install`.

```
# FLAGS

# - HEADLESS={true, false}
#   runs without browser or showing browser respectively

# - DEBUG=laevitas-scaper*
#   runs displaying results of individual steps

# EXAMPLES
node index.js eth
HEADLESS=false DEBUG=laevitas-scaper* node index.js btc
```
