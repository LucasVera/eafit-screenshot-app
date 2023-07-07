const screenshot = require('screenshot-desktop');
const {
  BUCKET_BASE_NAME,
  SCREENSHOTS_FORMAT,
  SCREENSHOT_INTERVAL_SECONDS,
  DYNAMODB_TABLE_BASE_NAME,
  REKOGNITION_COLLECTION_BASE_ID,
  STAGE,
  LEARNING_ANALYTICS_CLASS_STATUS_CHANGED_SQS_QUEUE_BASE_NAME,
} = require('./config');
const {
  getTimestamp,
  getDateStr,
  logMsg,
} = require('./util');
const aws = require('./aws');

const BUCKET_NAME = `${BUCKET_BASE_NAME}-${STAGE}`;
const TABLE_NAME = `${DYNAMODB_TABLE_BASE_NAME}-${STAGE}`;
const FACES_COLLECTION_ID = `${REKOGNITION_COLLECTION_BASE_ID}-${STAGE}`;
const CLASS_STATUS_CHANGED_QUEUE_NAME = `${LEARNING_ANALYTICS_CLASS_STATUS_CHANGED_SQS_QUEUE_BASE_NAME}-${STAGE}`;

const main = async () => {
  try {
    const startDate = new Date();
    const classId = getTimestamp(startDate);
    const dateStr = getDateStr(startDate);
    const basePath = `classes/${dateStr}/classid-${classId}`;

    process.on('exit', () => {
      aws.sqs.sendMessageToQueue(queueUrl, JSON.stringify({
        status: 'stopped',
        attributes: {
          classId,
          stoppedAt: new Date().valueOf(),
          stage: STAGE,
        }
      }));
    });
    process.on('beforeExit', () => {
      aws.sqs.sendMessageToQueue(queueUrl, JSON.stringify({
        status: 'stopped',
        attributes: {
          classId,
          stoppedAt: new Date().valueOf(),
          stage: STAGE,
        }
      }));
    });
    process.on('SIGINT', () => {
      aws.sqs.sendMessageToQueue(queueUrl, JSON.stringify({
        status: 'stopped',
        attributes: {
          classId,
          stoppedAt: new Date().valueOf(),
          stage: STAGE,
        }
      }));
    });

    // Check if faces collection exists. if it doesn't, create it
    await aws.rekognition.createCollectionIfNotExists(FACES_COLLECTION_ID);

    // Save class metadata
    await aws.dynamoDb.saveItemToDynamoDb(TABLE_NAME, {
      classId,
      startedAtUtc: startDate.toISOString(),
      screenshotsBucketName: BUCKET_BASE_NAME,
      screenshotsBasePath: basePath,
      screenshotIntervalSeconds: SCREENSHOT_INTERVAL_SECONDS,
    });

    const queueUrl = await aws.sqs.createQueueIfNotExists(CLASS_STATUS_CHANGED_QUEUE_NAME);
    console.log('queueUrl', queueUrl);
    await aws.sqs.sendMessageToQueue(queueUrl, JSON.stringify({
      status: 'started',
      attributes: {
        classId,
        startedAt: new Date().valueOf(),
        stage: STAGE,
      }
    }));
    console.log(`
____________________________________________________________________________________

Starting screenshot taking

A new folder will be created that marks the "class Id" in the specified bucket.
Credentials for AWS are in the .env file.

Bucket name along other configurable parameters are in the ./config.js file
However, access credentials must be configured in your machine for "default" profile (in windows, ~/.aws/credentials)

- Interval: every ${SCREENSHOT_INTERVAL_SECONDS} seconds
- Start Time: ${startDate.toISOString()}
- Class Id: ${classId}
- Classes table name: ${TABLE_NAME}
- Bucket name: ${BUCKET_NAME}
- File Base Path: ${basePath}
- Stage: ${STAGE}

To stop, simply stop the terminal process ('ctrl+c' in windows)
____________________________________________________________________________________
    `);

    setInterval(async () => {
      const screenshotTime = getTimestamp();
      // For example:
      // - /classes/2022-01-01/classid-123456/screenshotid-9518945.jpg
      // - /classes/2022-01-01/classid-123456/screenshotid-3159841.jpg
      const screenshotFilePath = `${basePath}/screenshotid-${screenshotTime}.${SCREENSHOTS_FORMAT}`;
      try {
        const imgBuffer = await screenshot({ format: SCREENSHOTS_FORMAT });
        const metadata = {
          classId: classId.toString(),
          classStartedAtTimestamp: getTimestamp(startDate).toString(),
          screenshotTime: screenshotTime.toString(),
          screenshotBasePath: basePath,
        };
        await aws.s3.uploadToS3(BUCKET_NAME, screenshotFilePath, imgBuffer, metadata);
      } catch (error) {
        console.log('err', error);
        logMsg('Error taking and saving screenshot.', error, { screenshotTime, screenshotFilePath });
      }
    }, SCREENSHOT_INTERVAL_SECONDS * 1000);
  }
  catch (ex) {
    console.error('Error in main', ex);
  }
};

main();
