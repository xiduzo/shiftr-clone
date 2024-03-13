import MQTT from "mqtt";
import { CLIENT_ID_PREFIX } from "./constants";

export class MqttClient {
  private client: MQTT.MqttClient | null = null;

  constructor(brokerUrl: string, options?: MQTT.IClientOptions) {
    MQTT.connectAsync(brokerUrl, {
      ...options,
      clientId:
        `${CLIENT_ID_PREFIX}_` + Math.random().toString(16).substr(2, 8),
    })
      .then((client) => {
        this.client = client;
      })
      .catch((error) => {
        console.log("error", error);
      });
  }

  #getClient() {
    return new Promise<MQTT.MqttClient>((resolve) => {
      const interval = setInterval(() => {
        if (this.client) {
          clearInterval(interval);
          resolve(this.client);
        }
      }, 100);
    });
  }

  public async on(
    item: Parameters<typeof MQTT.MqttClient.prototype.on>[0],
    callback: Parameters<typeof MQTT.MqttClient.prototype.on>[1]
  ) {
    const client = await this.#getClient();
    client.on(item, callback);
    return this;
  }

  public async publishAsync(
    topic: string,
    message: string | Buffer,
    options?: MQTT.IClientPublishOptions,
    callback?: MQTT.PacketCallback
  ) {
    console.log("publishing", topic, message);
    const client = await this.#getClient();
    client.publish(topic, message, options, callback);
  }

  public async subscribeAsync(
    topicObject: string | string[] | MQTT.ISubscriptionMap,
    options?: MQTT.IClientSubscribeOptions | MQTT.IClientSubscribeProperties,
    callback?: MQTT.ClientSubscribeCallback
  ) {
    const client = await this.#getClient();
    client.subscribe(topicObject, options, callback);
  }
}
