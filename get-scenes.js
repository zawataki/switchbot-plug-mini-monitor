import {getScenes} from './switchbot-api-client.js';
import pino from 'pino';

const logger = pino({level: 'info'});

(async () => {
  try {
    console.log("Scene list: ", await getScenes());
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
})();
