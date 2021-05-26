'use strict';
const debug = require('debug')('laevitas-scraper:tests')
  , PromisePool = require('@supercharge/promise-pool')
  , _ = require('lodash');

// PURPOSE
//  - The purpose of this test file is to guarantee parallel limited execution, ensure that tasks are actually
//  executed when they are supposed to be executed. Can also serve as an eductional file to understand the 
//  async nature of JavaScript, Promises and execution.

/* promised timeout */
const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

async function pendingTask(taskId, duration) {
  debug('EXECUTING', taskId, 'FOR', duration);
  await timeout(duration);
  console.log('TASK EXECUTED', taskId);
  return `DONE ${taskId}`;
}


(async () => {
  const workLoadItems = _.map(_.range(100), t => `task ${t}`);
  

  // 1. free-for all parallel
  await Promise.all(workLoadItems.map(wi => pendingTask(wi, _.random(2000, 5000))));

  // 2. serial execution (does not block!)
  workLoadItems.reduce(async (previousPromise, nextTask) => {
    await previousPromise;
    return pendingTask(nextTask, _.random(2000, 5000));
  }, Promise.resolve());

  // 3. parallel limited
  const { results, errors } = await PromisePool
    .for(workLoadItems)
    .withConcurrency(3)
    .process(async workLoadItem => {
      const result = await pendingTask(workLoadItem, _.random(2000, 5000));
      return result;
    });
  console.log(results, errors);


  console.log('DONE');
})();
