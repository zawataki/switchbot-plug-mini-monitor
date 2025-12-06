import {scheduler} from 'node:timers/promises';
import dotenv from 'dotenv';
import {getDeviceStatus} from './switchbot-api-client.js';
import got from 'got';
import pino from 'pino';
import {WebClient as SlackWebClient} from '@slack/web-api';

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

// Slack Web API クライアント
const slackToken = process.env.SLACK_BOT_TOKEN;
const slackChannel = process.env.SLACK_CHANNEL; // チャンネルID（例: C0123456789）
const slack = slackToken ? new SlackWebClient(slackToken) : null;

async function sendSlackMessage(text) {
  if (slack) {
    const res = await slack.chat.postMessage({
      channel: slackChannel,
      text,
    });
    return {ts: res.ts, channel: res.channel};
  }
  // Webhook fallback（リアクション確認は不可）
  await got.post(process.env.SLACK_WEBHOOK, {json: {text}});
  return null;
}

async function hasCheckReaction(channel, ts) {
  if (!slack) return false; // Webhookのみの場合は確認不可
  try {
    const res = await slack.reactions.get({channel, timestamp: ts});
    const reactions = res.message?.reactions || [];
    return reactions.some(r => typeof r.name === 'string' && r.name.includes('check'));
  } catch (error) {
    // 権限不足や一時エラーの可能性、ログ出して false で継続
    logger.warn({msg: 'Failed to fetch reactions', error: error?.message});
    return false;
  }
}

async function notifyLaundryEnd() {
  logger.info("Notify laundry end");
  try {
    // 1回目通知
    const first = await sendSlackMessage('<@yuki> 洗濯が終わったよ。メッセージを確認したら:white_check_mark:をつけてね');

    // リアクション確認できる場合のみ、定期的にリトライ
    if (first && first.ts && first.channel) {
      const checkIntervalMsec = 5 * 60 * 1000; // 5分おきにリトライ
      let notifiedTs = first.ts;
      let notifiedChannel = first.channel;

      // タイムアウトまでリトライを繰り返す（リアクションがあればリトライ停止）
      const timeoutMsec = 1 * 60 * 60 * 1000; // タイムアウトを1時間に設定
      const start = Date.now();
      while (true) {
        await scheduler.wait(checkIntervalMsec);
        const confirmed = await hasCheckReaction(notifiedChannel, notifiedTs);
        if (confirmed) {
          logger.info('Laundry end confirmed by check reaction');
          break;
        }
        if (Date.now() - start > timeoutMsec) {
          logger.warn('Laundry end reminder timed out without reaction');
          break;
        }
        const reminder = await sendSlackMessage('<@yuki> まだ:white_check_mark:がついてないよ。確認したら最新のメッセージにつけてね');
        if (reminder && reminder.ts && reminder.channel) {
          // 最新メッセージに対してリアクション確認を続ける
          notifiedTs = reminder.ts;
          notifiedChannel = reminder.channel;
        }
      }
    }
  } catch (error) {
    throw new Error("Failed to notify laundry end", {cause: error});
  }
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
