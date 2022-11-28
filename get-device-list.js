import {scheduler} from 'node:timers/promises';
import {getDeviceList} from './switchbot-api-client.js';

(async () => {
  try {
    console.log("Device list: ", await getDeviceList());
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
