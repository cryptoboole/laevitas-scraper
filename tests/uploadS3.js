// load .env
require('dotenv').config();

// dependencies
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
  , { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
  , moment = require('moment')
  , _ = require('lodash');

// initiate s3 client
const s3 = new S3Client({
  region: process.env.REGION,
});

const generateDummyCsv = size => {
  const dataObj = _.range(size).map(i => ({ item: i }));
  return _.keys(_.first(dataObj)).join(',')+'\n'+_.map(dataObj, (dict) => (_.values(dict).join(','))).join('\n');
}

const params = {
  Bucket: process.env.S3_BUCKET,
  Key: `${moment().format('YYYYMMDD')}/test.csv`,
  Body: generateDummyCsv(10, null, 2),
};

(async () => {

  // upload dummy csv text and get publicly accessible url of object
  const response = await s3.send(new PutObjectCommand(params));
  if (response['$metadata'].httpStatusCode === 200) {
    const signedUrl = await getSignedUrl(s3, new GetObjectCommand(params), { expiresIn: 3600 });
    console.log('UPLOADED', signedUrl);
  }

})();
