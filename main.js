import {scheduler} from 'node:timers/promises';
import dotenv from 'dotenv';
import {getDeviceStatus} from './switchbot-api-client.js';

dotenv.config();

async function notifyLaundryEnd() {
  await executeManualScene(process.env.SCENE_ID_LAUNDRY_END_NOTIFICATION);
}

async function notifyApiError() {
  await executeManualScene(process.env.SCENE_ID_API_ERROR_NOTIFICATION);
}

(async () => {
  try {
    const deviceIdOfWashingMachine = process.env.TARGET_DEVICE_ID;
    const statusCheckIntervalMsec = 30 * 1000;
    console.log(`timestamp,deviceId,deviceType,hubDeviceId,power,voltage,weight,electricityOfDay,electricCurrent`);
    let lastApiCallTimeMsec = 0;
    let apiErrorCount = 0;
    let electricCurrentZeroCount = 0;
    let alreadyNotifiedApiError = false;
    let washingMachineIsRunning = false;
    while (true) {
      const elapsedTimeMsec = Date.now() - lastApiCallTimeMsec;
      if (elapsedTimeMsec < statusCheckIntervalMsec) {
        await scheduler.wait(statusCheckIntervalMsec - elapsedTimeMsec);
      }
      lastApiCallTimeMsec = Date.now();
      try {
        const response = await getDeviceStatus(deviceIdOfWashingMachine);
        console.log(`${new Date().toISOString()},${response.deviceId},${response.deviceType},${response.hubDeviceId},${response.power},${response.voltage},${response.weight},${response.electricityOfDay},${response.electricCurrent}`);

        if (response.electricCurrent === 0) {
          if (!washingMachineIsRunning) {
            // TODO: Call notifyLaundryEnd() only when washing machine ends
          }

          console.debug(`electricCurrent is 0`);
          electricCurrentZeroCount++;

          if (electricCurrentZeroCount >= 4) {
            await notifyLaundryEnd();
            electricCurrentZeroCount = 0;
          }
        } else {
          washingMachineIsRunning = true;
          electricCurrentZeroCount = 0;
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
