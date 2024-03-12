import {scheduler} from 'node:timers/promises';
import {getScenes} from './switchbot-api-client.js';

(async () => {
  try {
    console.log("Scene list: ", await getScenes());
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
