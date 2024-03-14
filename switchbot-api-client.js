import crypto from 'crypto';
import got from 'got';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://api.switch-bot.com/v1.1';

function generateApiOptions() {
  const currentDateTime = Date.now();
  const nonce = crypto.randomUUID();
  return {
    headers: {
      "Authorization": process.env.SWITCHBOT_API_TOKEN,
      "sign": crypto.createHmac('sha256', process.env.SWITCHBOT_API_SECRET)
        .update(Buffer.from(process.env.SWITCHBOT_API_TOKEN + currentDateTime + nonce, 'utf-8'))
        .digest()
        .toString("base64"),
      "nonce": nonce,
      "t": currentDateTime,
      'Content-Type': 'application/json; charset=utf8',
    },
  };
}

export async function getDeviceList() {
  try {
    const response = await got.get(`${API_URL}/devices`, generateApiOptions())
      .json();
    return response.body;
  } catch (error) {
    throw new Error("Failed to get device list", {cause: error});
  }
}

export async function getDeviceStatus(deviceId) {
  try {
    const response = await got.get(`${API_URL}/devices/${deviceId}/status`, generateApiOptions())
      .json();
    return response.body;
  } catch (error) {
    throw new Error("Failed to get device status", {cause: error});
  }
}

export async function getScenes() {
  try {
    const response = await got.get(`${API_URL}/scenes`, generateApiOptions())
      .json();
    return response.body;
  } catch (error) {
    throw new Error("Failed to get scenes", {cause: error});
  }
}

export async function executeManualScene(sceneId) {
  try {
    const response = await got.post(`${API_URL}/scenes/${sceneId}/execute`, generateApiOptions())
      .json();
    return response.body;
  } catch (error) {
    throw new Error("Failed to execute manual scene", {cause: error});
  }
}
