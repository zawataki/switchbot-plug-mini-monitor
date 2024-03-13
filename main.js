import {scheduler} from 'node:timers/promises';
import dotenv from 'dotenv';
import {getDeviceStatus, executeManualScene} from './switchbot-api-client.js';
import got from 'got';

dotenv.config();

async function notifyLaundryEnd() {
  await executeManualScene(process.env.SCENE_ID_LAUNDRY_END_NOTIFICATION);
}

async function notifyApiError() {
  // Post a message to Slack because SwitchBot API may be down
  try {
    await got.post(process.env.SLACK_WEBHOOK, {
      json: {
        text: 'SwitchBot API error occurred'
      }
    });
  } catch (error) {
    const errMessage = "Failed to call notify API error.";
    console.error(errMessage, error);
    throw errMessage;
  }
}

// Monitor a SwitchBot plug mini connected to a washing machine and
// notify the laundry end
(async () => {
  try {
    const deviceIdOfWashingMachine = process.env.TARGET_DEVICE_ID;
    const statusCheckIntervalMsec = 30 * 1000;
    console.log(`timestamp,deviceId,deviceType,hubDeviceId,power,voltage,weight,electricityOfDay,electricCurrent`);
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
        console.log(`${new Date().toISOString()},${response.deviceId},${response.deviceType},${response.hubDeviceId},${response.power},${response.voltage},${response.weight},${response.electricityOfDay},${response.electricCurrent}`);

        electricCurrentHistory.push(response.electricCurrent);
        if (electricCurrentHistory.length > 3) {
          electricCurrentHistory.shift();
        }

        if (electricCurrentHistory.length == 3
          && electricCurrentHistory[0] != 0
          && electricCurrentHistory[1] == 0
          && electricCurrentHistory[2] == 0) {

          await notifyLaundryEnd();
        }

        apiErrorCount = 0;
        alreadyNotifiedApiError = false;
      } catch (error) {
        console.error(error.message);

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
    console.error(error);
    process.exit(1);
  }
})();
