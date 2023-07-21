const express = require('express');
const amqp = require('amqplib/callback_api');
const winston = require('winston');
const expressPrometheus = require('express-prometheus-middleware');

const app = express();
const requestQueue = 'request_queue';
const responseQueue = 'response_queue';


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


app.use(expressPrometheus({}));

app.use(express.json());

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

    channel.prefetch(1);

    app.post('/process', (req, res) => {
      const data = req.body;
      logger.info('Received request:', data);

      channel.sendToQueue(requestQueue, Buffer.from(JSON.stringify(data)));

      res.status(200).json({ message: 'Request submitted for processing.' });
    });
  });

  function consumeResponseQueue() {
    connection.createChannel((error, channel) => {
      if (error) {
        throw error;
      }

      channel.assertQueue(responseQueue, { durable: false });

      channel.consume(responseQueue, (message) => {
        if (message) {
          const result = JSON.parse(message.content.toString());
          logger.info('Result received:', result);

          channel.ack(message);
        }
      });
    });
  }

  consumeResponseQueue();
});

const port = 3000;
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
});
