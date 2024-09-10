import { MqttClient } from "../../../common/MqttClient";
import { handleMqttMessage } from "./messaging";

// localStorage.debug = "mqttjs*"; // For debugging MQTT client

export let clientId: string | undefined = undefined;

export async function initClient() {
  return new Promise<MqttClient>(async (resolve, reject) => {
    const client = new MqttClient(
      import.meta.env.VITE_CLIENT_MQTT_CONNECTION_STRING,
    );

    const timeout = setTimeout(reject, 5000);

    client.on("connect", () => {
      window.document.body.style.cursor = "default";
      clearTimeout(timeout);
      resolve(client);
    });

    client.on("message", handleMqttMessage);
    client.subscribeAsync("SHIFTR_CLONE/#");
  });
}
