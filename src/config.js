
module.exports = {
  // General
  SCREENSHOT_INTERVAL_SECONDS: 2,
  SCREENSHOTS_FORMAT: 'jpg',
  STAGE: 'dev',

  // AWS
  BUCKET_BASE_NAME: 'classes-screenshots',
  DYNAMODB_TABLE_BASE_NAME: 'classes',
  REGION: 'us-east-1',
  REKOGNITION_COLLECTION_BASE_ID: 'eafit-students',
  LEARNING_ANALYTICS_CLASS_STATUS_CHANGED_SQS_QUEUE_BASE_NAME: 'class-statuses-queue',
};
