'use strict';

// load .env (tentative)
require('dotenv').config();

// dependencies
const debug = require('debug')('laevitas-scraper')
  , PromisePool = require('@supercharge/promise-pool')
  , puppeteer = require('puppeteer')
  , Discord = require('discord.js')
  , moment = require('moment')
  , mkdirp = require('mkdirp')
  , path = require('path')
  , _ = require('lodash');

// util
const { mapListDict, asyncFilter, timeout, headerBodyToCsv, saveCsv } = require('./lib/util');

// configuration
const runHeadless = process.env.HEADLESS != 'false';
debug('RUN HEADLESS', runHeadless);
const saveOutput = process.env.FILEOUTPUT == 'true';
debug('SAVE FILES', saveOutput);
const sendWebhook = process.env.SENDHOOK != 'false';
debug('TRIGGER WEBHOOK', sendWebhook);
const config = require('./config.json');

// check instrument argument is passed
if (process.argv.length < 3 || ['btc', 'eth'].indexOf(process.argv[2]) < 0) throw new Error('invalid arguments, please provide instrument name (eth, btc)');
const INSTRUMENT = process.argv[2];

// state for scrape run
const scrapeRun = moment().format('YYYYMMDDHHmm');
const saveLocation = path.join(__dirname, 'results', scrapeRun, INSTRUMENT);
if (saveOutput) mkdirp.sync(saveLocation);

// set ecosystem variables (timeout, concurrency)
const PPTR_TIMEOUT = Number(process.env.PPTR_TIMEOUT || 30000);
debug('PUPPETEER TIMEOUT', PPTR_TIMEOUT);
const PPTR_CONCURRENCY = Number(process.env.PPTR_CONCURRENCY || 3);
debug('PUPPETEER CONCURRENCY', PPTR_CONCURRENCY);


/////////////
// INTEROP //
/////////////

/* S3 UPLOADER */
const { S3_BUCKET, REGION } = process.env;
const S3Uploader = require('./lib/S3Uploader');
const s3 = new S3Uploader({ region: REGION, bucket: S3_BUCKET });

/* DISCORD WEBHOOK CLIENT */
const { DISCORD_WEBHOOKID, DISCORD_WEBHOOKTOKEN } = process.env;
const webhookClient = new Discord.WebhookClient(DISCORD_WEBHOOKID, DISCORD_WEBHOOKTOKEN);
async function sendToChannel(link, timer) {

  // construct message
  const embed = new Discord.MessageEmbed()
    .setTitle(`${INSTRUMENT.toUpperCase()} ${moment().utc().format('YYYYMMDD HH:mm')}`)
    .setDescription('Option chain data scraped from [laevitas.ch](https://laevitas.ch)')
    .addFields(
      {
        name: 'download link',
        value: `[${INSTRUMENT.toUpperCase()}_${moment().utc().format('YYYYMMDD')}](${link})`,
        inline: true,
      },
      {
        name: 'timer',
        value: timer,
        inline: true,
      })
    .setColor(INSTRUMENT === 'eth' ? '0074D9' : 'FF851B')
    .setTimestamp()
    .setFooter('laevitas option chain data', config.laevitas.pages.options_chain.replace('$INSTRUMENT', INSTRUMENT))

  // send webhook message
  return await webhookClient.send('laevitas-scraper v1.1', { embeds: [embed] });

}


/////////////
// HELPERS //
/////////////

async function scrapeExpiry(browser, expiryLabel) {

  // instantiate page and wait for loading to finish
  const laevitasTab = await browser.newPage();
  laevitasTab.setDefaultTimeout(PPTR_TIMEOUT);
  await laevitasTab.setViewport({ width: 1200, height: 800 });
  await laevitasTab.setUserAgent(config.ua);
  await laevitasTab.goto(config.laevitas.pages.options_chain.replace('$INSTRUMENT', INSTRUMENT));
  debug('TAB LOADED', expiryLabel);

  // wait for the option-chain content to load and fetch expiries
  await laevitasTab.waitForSelector(config.laevitas.elements.options_chain);
  await laevitasTab.click(config.laevitas.elements.expiries_button);
  await laevitasTab.waitForSelector(config.laevitas.elements.expiries_list);
  const expiries = await laevitasTab.$$(config.laevitas.elements.expiries_list_items);

  // get the node that matches the text
  const filteredExpiries = await asyncFilter(expiries, async (expiryNode) => {
    const nodeText = await expiryNode.evaluate((node) => node.innerText)
    return nodeText === expiryLabel;
  });

  // skip the scraping if we can't get the right expiry node
  if (filteredExpiries.length !== 1) return false;
  debug('EXPIRY', expiryLabel);

  // get the first and only filtered node
  const expiryEl = filteredExpiries[0];

  // click the expiry label and wait for table to load
  await expiryEl.click();

  // click all table columns and return header selection
  await laevitasTab.waitForSelector(config.laevitas.elements.table_checkboxes);
  await laevitasTab.evaluate(async (selector) => {
    const optionsOptions = document.querySelectorAll(selector);
    optionsOptions.forEach(el => el.checked !== true && el.click());
  }, config.laevitas.elements.table_checkboxes);

  // wait for all strike-price cells to have content and count the rows + proceed
  // NOTE: you can chose different criteria td.cell-strike (strike price), td:nth-child(14) = strike price, td:nth-child(2) = volume
  await laevitasTab.waitForFunction(() => Array.from(document.querySelectorAll('table > tbody tr')).length > 1);
  await laevitasTab.waitForFunction(() => Array.from(document.querySelectorAll('table > tbody tr td:nth-child(2)')).reduce((m, cell) => m + (cell.innerText && cell.innerText.length === 0) ? 1 : 0, 0) === 0);
  const rowCount = await laevitasTab.$$eval('table > tbody tr', rows => rows.length);
  debug('ROWCOUNT', rowCount);

  // extract header row array and 2-dimensional body array
  const thead = await laevitasTab.$$eval('table > thead th', elements => elements.map(element => element.innerText));
  const tbody = await laevitasTab.$$eval('table > tbody tr', rows => {
    return Array.from(rows, row => {
      const columns = row.querySelectorAll('td');
      return Array.from(columns, column => column.innerText);
    });
  });

  // close browser page
  await laevitasTab.close();

  // return csv object
  const expiryData = mapListDict(thead, tbody);
  debug('objKeys.len', Object.keys(expiryData[0]).length, thead.length);
  return [expiryLabel, [thead, tbody]];

}

//////////
// MAIN //
//////////

(async () => {

  // initiate timer
  const hrstart = process.hrtime();

  // instantiate
  const browser = await puppeteer.launch({
    headless: runHeadless,
    userDataDir: path.join(__dirname, '.chrome'),
    args: [
      '--no-sandbox', // NOTE: required for heroku deployment
      // '--no-zygote',
      // '--single-process',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ]
  });

  // instantiate page and wait for loading to finish
  const laevitasPage = await browser.newPage();
  laevitasPage.setDefaultTimeout(PPTR_TIMEOUT);
  await laevitasPage.setViewport({ width: 1200, height: 800 });
  await laevitasPage.setUserAgent(config.ua);
  await laevitasPage.goto(config.laevitas.pages.options_chain.replace('$INSTRUMENT', INSTRUMENT));
  debug('PAGE LOADED', config.laevitas.pages.options_chain.replace('$INSTRUMENT', INSTRUMENT));

  // wait for the option-chain content to load
  await laevitasPage.waitForSelector(config.laevitas.elements.options_chain);

  // programmatically click the dropdown button to trigger the list to be generated
  await laevitasPage.click(config.laevitas.elements.expiries_button);

  // wait for the list to actually be generated
  await laevitasPage.waitForSelector(config.laevitas.elements.expiries_list);

  // extract all expiries
  const expiryLabels = await laevitasPage.$$eval(config.laevitas.elements.expiries_list_items, elements => elements.map(element => element.innerText));

  // parallel limited traverse expiries
  const concatenatedExpiries = []
  const { results, errors } = await PromisePool
    // .for(_.takeRight(expiryLabels, 2))
    .for(expiryLabels)
    .withConcurrency(3)
    .process(async expiryLabel => {

      // scrape the expiry data (data consists of [thead, tbody])
      const [expiry, data] = await scrapeExpiry(browser, expiryLabel);

      // DEBUG: save individual expiry sraped data to csv
      // if (saveOutput) { // if we want to save file output
      //   const outputPath = path.join(saveLocation, `${expiry}.csv`);
      //   debug('SAVED', outputPath.replace(__dirname, ''));
      //   await saveCsv(headerBodyToCsv(data[0], data[1]));
      // }

      // push to concatenated array with expiry string added to data row
      concatenatedExpiries.push({ thead: [...data[0], 'expiry'], tbody: _.map(data[1], r => [ ...r, expiry ]) });

      // return name and data length to be aggregated
      return [expiry, data.length];

    });

  // time process and set a randomm second async timeout to allow stuff to close
  const hrend = process.hrtime(hrstart);
  console.info('process timer: %ds %dms', hrend[0], hrend[1] / 1000000);
  await timeout(_.random(2000, 5000));

  // save concatenated export
  const concatenatedExpiriesCsv = headerBodyToCsv(concatenatedExpiries[0].thead, _.flatMap(concatenatedExpiries, 'tbody'));
  if (saveOutput) { // if we want to save file output

    // save to file
    const concatenatedOutputPath = path.join(saveLocation, `${scrapeRun}_${INSTRUMENT.toUpperCase()}.csv`);
    await saveCsv(concatenatedOutputPath, concatenatedExpiriesCsv);
    debug('SAVED', concatenatedOutputPath.replace(__dirname, ''));

  } else {

    // upload to S3
    const concatenatedOutputKey = path.join(scrapeRun, INSTRUMENT, `${scrapeRun}_${INSTRUMENT.toUpperCase()}.csv`);
    const signedDownloadUrl = await s3.uploadCsv(concatenatedOutputKey, concatenatedExpiriesCsv);
    debug('SAVED', path.join(`s3://${process.env.S3_BUCKET}`, concatenatedOutputKey));

    // send discord hook
    if (sendWebhook) await sendToChannel(signedDownloadUrl, `${hrend[0]}s ${hrend[1] / 1000000}ms`);

  }

  // log the results
  if (errors && errors.length > 0) console.log(errors);
  debug('FINISHED', results.length, 'FILES SAVED');

  // close the headless browser
  await browser.close();
  debug('EXIT');
  process.exit(0);

})().catch(err => console.error(err));
