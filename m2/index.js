const amqp = require('amqplib/callback_api');
const express = require('express');
const winston = require('winston');
const promBundle = require('express-prom-bundle');

const requestQueue = 'request_queue';
const responseQueue = 'response_queue';


const app = express();


const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});


const metricsMiddleware = promBundle({ includeMethod: true, includePath: true });

amqp.connect('amqp://localhost', (error, connection) => {
  if (error) {
    throw error;
  }

  connection.createChannel((error, channel) => {
    if (error) {
      throw error;
    }

    channel.assertQueue(requestQueue, { durable: false });
    channel.assertQueue(responseQueue, { durable: false });

    channel.consume(requestQueue, (message) => {
      const data = JSON.parse(message.content.toString());
      logger.info('Received task:', data);

      const result = { result: data.value * 2 };
      logger.info('Result:', result);

      channel.sendToQueue(responseQueue, Buffer.from(JSON.stringify(result)));

      channel.ack(message);
    });
  });
});

const port = 3001; 
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
});
