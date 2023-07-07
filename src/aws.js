const {
  S3Client,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const {
  DynamoDBClient,
  PutItemCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  RekognitionClient,
  CreateCollectionCommand,
  DescribeCollectionCommand,
} = require('@aws-sdk/client-rekognition');
const {
  SQSClient,
  GetQueueUrlCommand,
  CreateQueueCommand,
  SendMessageCommand,
} = require('@aws-sdk/client-sqs');
const {
  REGION
} = require('./config');


// ----------------- S3 --------------------
let s3Client;
const loadS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client({
      region: REGION,
    });
  }

  return s3Client;
};

const uploadToS3 = (bucketName, path, buffer, metadata = {}) => {
  // fix me
  return;
  loadS3Client();
  const input = {
    Bucket: bucketName,
    Key: path,
    Body: buffer,
    Metadata: metadata,
  };
  const command = new PutObjectCommand(input);

  return s3Client.send(command);
};



// ----------------- DYNAMODB --------------------

let dynamodbClient;
const loadDynamoDbClient = () => {
  if (!dynamodbClient) {
    dynamodbClient = new DynamoDBClient({
      region: REGION
    });
  }

  return dynamodbClient;
};

const getDynamoDbFormattedProp = (value) => {
  const typeFound = availableTypes.find(({ type }) => typeof value === type);
  if (!typeFound || !typeFound.type) {
    console.log('Type not supported for conversion to dynamodb', { value, typeFound });
    return null;
  }
  const { dynamoDbPropType } = typeFound;

  if (!dynamoDbPropType) return null;

  return { [dynamoDbPropType]: value.toString ? value.toString() : value };
};

const availableTypes = [
  { type: 'string', dynamoDbPropType: 'S' },
  { type: 'number', dynamoDbPropType: 'N' },
  { type: 'boolean', dynamoDbPropType: 'BOOL' },
];
const objToDynamoDbItem = (jsObj) => {
  const dynamoItem = {};
  for (const key in jsObj) {
    const value = jsObj[key];
    const dynamoDbProp = getDynamoDbFormattedProp(value);
    if (!dynamoDbProp) continue;
    dynamoItem[key] = dynamoDbProp;
  }

  return dynamoItem;
};

const saveItemToDynamoDb = (TableName, item) => {
  loadDynamoDbClient();
  const input = {
    TableName,
    Item: objToDynamoDbItem(item)
  };

  const command = new PutItemCommand(input);

  return dynamodbClient.send(command);
};


// ----------------- REKOGNITION --------------------
let rekognitionClient;
const loadRekognitionClient = () => {
  if (!rekognitionClient) {
    rekognitionClient = new RekognitionClient({
      region: REGION,
    });
  }

  return rekognitionClient;
};

const createCollection = async (CollectionId) => {
  loadRekognitionClient();
  const createCollectionParams = {
    CollectionId,
  };

  const createCollectionCommand = new CreateCollectionCommand(createCollectionParams);

  const response = await rekognitionClient.send(createCollectionCommand);

  return response;
};

const describeCollection = async (CollectionId) => {
  loadRekognitionClient();
  const describeCollectionParams = {
    CollectionId,
  };

  const describeCollectionCommand = new DescribeCollectionCommand(describeCollectionParams);

  const response = await rekognitionClient.send(describeCollectionCommand);

  return response;
};

const COLLECTION_DOESNT_EXIST_ERROR_CODE = 'ResourceNotFoundException';

const createCollectionIfNotExists = async (CollectionId) => {
  try {
    await describeCollection(CollectionId);
  } catch (error) {
    console.log('err', error);
    if (error.Code === COLLECTION_DOESNT_EXIST_ERROR_CODE) {
      await createCollection(CollectionId);
    } else {
      throw error;
    }
  }
};

// ----------------- SQS --------------------
const QUEUE_NOT_FOUND_ERROR_NAME = 'QueueDoesNotExist';

let sqsClient;
const loadSqsClient = () => {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: REGION,
    });
  }

  return sqsClient;
};

const getQueueUrl = async (QueueName) => {
  const client = loadSqsClient();
  const params = { QueueName };
  const command = new GetQueueUrlCommand(params);
  const response = await client.send(command);
  return response.QueueUrl;
};

const createQueueIfNotExists = async (queueName) => {
  const client = loadSqsClient();

  try {
    const params = {
      QueueName: queueName,
    };
    const command = new GetQueueUrlCommand(params);
    const response = await client.send(command);
    return response.QueueUrl;

  } catch (ex) {
    if (ex.name === QUEUE_NOT_FOUND_ERROR_NAME) {
      const params = {
        QueueName: queueName,
      };
      const command = new CreateQueueCommand(params);
      const response = await client.send(command);
      return response.QueueUrl;
    } else {
      throw ex;
    }
  }
};

const sendMessageToQueue = async (QueueUrl, message) => {
  if (typeof message !== 'string') throw new Error('Message must be a string (JSON)');
  const client = loadSqsClient();
  const params = {
    QueueUrl: QueueUrl,
    MessageBody: message,
  };
  const command = new SendMessageCommand(params);
  const response = await client.send(command);
  return response;
};

module.exports = {
  s3: {
    uploadToS3,
  },
  dynamoDb: {
    saveItemToDynamoDb,
  },
  rekognition: {
    createCollection,
    describeCollection,
    createCollectionIfNotExists,
  },
  sqs: {
    createQueueIfNotExists,
    sendMessageToQueue,
  }
};
