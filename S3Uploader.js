// dependencies
const debug = require('debug')('laevitas-scraper:savetos3')
  , { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
  , { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
  , _ = require('lodash');

// constants
const REQUIRED_OPTIONS = ['region', 'bucket'];

// helpers
const objToCsv = dataObj => [
  _.keys(_.first(dataObj)).join(','),
  _.map(dataObj, (dict) => (_.values(dict).join(','))).join('\n')
].join('\n');

// instantiate connection
class S3Uploader {

  constructor(options = {}) {
    this._options = {

      // default options
      expiry: 3600,

      // override with passed options
      ...options

    };

    // sanity check
    const requiredKeysPresent = Object.keys(options).reduce((m, v) => m + (REQUIRED_OPTIONS.indexOf(v) > -1 ? 1 : 0), 0);
    if (requiredKeysPresent !== REQUIRED_OPTIONS.length) throw new Error(`S3Uploader initiated with ${requiredKeysPresent} of ${REQUIRED_OPTIONS.length} keys`);

    // initialise
    this.initialise();

  }

  initialise() {
    this._s3 = new S3Client({
      region: this._options.region,
    });
    debug('INITIALISED');
  }

  async uploadObjCsv(Key, dataObj) {

    // construct put object command parameters
    const params = {
      Bucket: this._options.bucket,
      Key,
      Body: objToCsv(dataObj),
    };

    // send csv or fail gracefully
    const response = await this._s3.send(new PutObjectCommand(params));
    debug('RESPONSE', response['$metadata']);
    if (response['$metadata'].httpStatusCode !== 200) return false;
    const signedUrl = await getSignedUrl(this._s3, new GetObjectCommand(params), { expiresIn: 3600 });
    debug('SIGNED', signedUrl);
    return signedUrl;

  }

}


/////////////
// EXPORTS //
/////////////

module.exports = S3Uploader;
