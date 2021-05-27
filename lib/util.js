// dependencies
const debug = require('debug')('laevitas-scraper:lib:util'),
  _ = require('lodash'),
  fs = require('fs');

/* CSV FILE SAVE */
function saveCsv(path, csvData) {
  debug('saveObjToCsv', path, csvData.length);
  return new Promise((resolve, reject) => {
    fs.writeFile(path, csvData, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

const headerBodyToCsv = (thead, tbody) => [
  thead.join(','),
  _.map(tbody, r => _.map(r, sanitiseData).join(',')).join('\n'),
].join('\n');


/* timeout and promise rejection handlers */
const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// REF: https://advancedweb.hu/how-to-use-async-functions-with-array-filter-in-javascript/
const asyncFilter = async (arr, predicate) =>
  Promise.all(arr.map(predicate)).then((results) =>
    arr.filter((_v, index) => results[index])
  );

/* turnes header array and body array into array of objects */
const sanitiseData = (value) => value.indexOf('\n') > -1 ? value.split('\n')[0] : value;
const mapListDict = (tbody, thead) => _.map(tbody, (row) => _.zipObject(_.map(thead, _.trim), _.map(row, sanitiseData)));

/* turns an array of object into csv text data */
const objToCsv = (dataObj) => [
  _.keys(_.first(dataObj)).join(','),
  _.map(dataObj, (dict) => _.values(dict).join(',')).join('\n'),
].join('\n');


/////////////
// EXPORTS //
/////////////

module.exports = {
  saveCsv,
  headerBodyToCsv,
  sanitiseData,
  objToCsv,
  mapListDict,
  asyncFilter,
  timeout,
};
