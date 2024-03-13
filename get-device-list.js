import {getDeviceList} from './switchbot-api-client.js';
import pino from 'pino';

const logger = pino({level: 'info'});

(async () => {
  try {
    console.log("Device list: ", await getDeviceList());
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
})();
