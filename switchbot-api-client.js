import crypto from 'crypto';
import got from 'got';
import dotenv from 'dotenv';

dotenv.config();

const currentDateTime = Date.now();
const nonce = crypto.randomUUID();
const API_URL = 'https://api.switch-bot.com/v1.1';
const API_OPTIONS = {
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

export async function getDeviceList() {
  try {
    const response = await got.get(`${API_URL}/devices`, API_OPTIONS).json();
    return response.body;
  } catch (error) {
    const errMessage = "Failed to get device list.";
    console.error(errMessage, error);
    throw errMessage;
  }
}

export async function getDeviceStatus(deviceId) {
  try {
    const response = await got.get(`${API_URL}/devices/${deviceId}/status`, API_OPTIONS).json();
    return response.body;
  } catch (error) {
    const errMessage = "Failed to get device status.";
    console.error(errMessage, error);
    throw errMessage;
  }
}

export async function getScenes() {
  try {
    const response = await got.get(`${API_URL}/scenes`, API_OPTIONS).json();
    return response.body;
  } catch (error) {
    const errMessage = "Failed to get scenes.";
    console.error(errMessage, error);
    throw errMessage;
  }
}

export async function executeManualScene(sceneId) {
  try {
    const response = await got.post(`${API_URL}/scenes/${sceneId}/execute`, API_OPTIONS).json();
    return response.body;
  } catch (error) {
    const errMessage = "Failed to execute manual scene.";
    console.error(errMessage, error);
    throw errMessage;
  }
}
