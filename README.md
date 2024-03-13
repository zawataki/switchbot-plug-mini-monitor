# switchbot-plug-mini-monitor
SwitchBot Plug Mini monitoring tool.
This tool uses [SwitchBot API](https://github.com/OpenWonderLabs/SwitchBotAPI).

# How to monitor an washing machine

1. Create a `.env` file like below:
    ```shell
    $ cat .env
    SWITCHBOT_API_TOKEN=your_token
    SWITCHBOT_API_SECRET=your_secret
    ```

2. How to get device id
    ```shell
    node get-device-list.js
    ```

3. How to get scene id
    ```shell
    node get-scenes.js
    ```

4. Modify the `.env` file
    ```shell
    $ cat .env
    SWITCHBOT_API_TOKEN=your_token
    SWITCHBOT_API_SECRET=your_secret
    TARGET_DEVICE_ID=your_device_id
    SCENE_ID_LAUNDRY_END_NOTIFICATION=your_scene_id_to_notify_laundry_end
    SLACK_WEBHOOK=your_slack_incoming_webhook_to_notify_switchbot_api_error
    ```

5. Run a script
    ```shell
    node main.js
    ```
