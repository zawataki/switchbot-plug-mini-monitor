import {scheduler} from 'node:timers/promises';
import dotenv from 'dotenv';
import {getDeviceStatus, executeManualScene} from './switchbot-api-client.js';
import got from 'got';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return {level: label.toUpperCase()};
    },
  },
  timestamp: () => {
    let jstDateTimeStr = (new Date(Date.now() + 9 * 60 * 60 * 1000)).toISOString()
      .replace(/Z$/, '+0900');
    return `,"time":"${jstDateTimeStr}"`;
  },
});

dotenv.config();

async function notifyLaundryEnd() {
  logger.info("Notify laundry end");
  await executeManualScene(process.env.SCENE_ID_LAUNDRY_END_NOTIFICATION);
}

async function notifyApiError() {
  // Post a message to Slack because SwitchBot API may be down
  try {
    logger.info("Notify SwitchBot API error");
    await got.post(process.env.SLACK_WEBHOOK, {
      json: {
        text: 'SwitchBot API error occurred'
      }
    });
  } catch (error) {
    throw new Error("Failed to notify SwitchBot API error", {cause: error});
  }
}

// Monitor a SwitchBot plug mini connected to a washing machine and
// notify the laundry end
(async () => {
  try {
    const deviceIdOfWashingMachine = process.env.TARGET_DEVICE_ID;
    const electricThreshold = process.env.ELECTRIC_THRESHOLD;
    const statusCheckIntervalMsec = 30 * 1000;
    let lastApiCallTimeMsec = 0;
    let apiErrorCount = 0;
    let alreadyNotifiedApiError = false;
    let electricCurrentHistory = [];
    while (true) {
      const elapsedTimeMsec = Date.now() - lastApiCallTimeMsec;
      if (elapsedTimeMsec < statusCheckIntervalMsec) {
        await scheduler.wait(statusCheckIntervalMsec - elapsedTimeMsec);
      }
      lastApiCallTimeMsec = Date.now();
      try {
        const response = await getDeviceStatus(deviceIdOfWashingMachine);
        // logger.info(`deviceId=${response.deviceId}, deviceType=${response.deviceType}, hubDeviceId=${response.hubDeviceId}, power=${response.power}, voltage=${response.voltage}, weight=${response.weight}, electricityOfDay=${response.electricityOfDay}, electricCurrent=${response.electricCurrent}`);
        logger.info(`deviceId=${response.deviceId}, deviceType=${response.deviceType}, electricCurrent=${response.electricCurrent}`);

        electricCurrentHistory.push(response.electricCurrent);
        if (electricCurrentHistory.length > 3) {
          electricCurrentHistory.shift();
        }

        if (electricCurrentHistory.length == 3
          && electricCurrentHistory[0] > electricThreshold
          && electricCurrentHistory[1] <= electricThreshold
          && electricCurrentHistory[2] <= electricThreshold) {

          await notifyLaundryEnd();
        }

        apiErrorCount = 0;
        alreadyNotifiedApiError = false;
      } catch (error) {
        logger.error(error.message);
        console.error(error);

        apiErrorCount++;
        if (apiErrorCount >= 3 && !alreadyNotifiedApiError) {
          await notifyApiError();
          alreadyNotifiedApiError = true;
        }

        const basicWaitTimeMsec = 30 * 1000;
        // Increase exponentially wait time
        await scheduler.wait(basicWaitTimeMsec * (2 ** (apiErrorCount - 1)));
      }
    }
  } catch (error) {
    logger.error("This script finishes due to error", error);
    process.exit(1);
  }
})();
