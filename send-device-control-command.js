import {sendDeviceControlCommand} from './switchbot-api-client.js';
import pino from 'pino';

const logger = pino({level: 'info'});

(async () => {
  try {
    if (process.argv.length < 4) {
      throw new Error("two arguments are required");
    }

    const deviceId = process.argv[2];
    const command = process.argv[3];
    console.log("Send device control command: ", await sendDeviceControlCommand(deviceId, command));
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
})();
