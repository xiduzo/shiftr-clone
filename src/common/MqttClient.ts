import MQTT from "mqtt";
import { CLIENT_ID_PREFIX } from "./constants";
import { generateUUID } from "./utils";

export class MqttClient {
  private client: MQTT.MqttClient | null = null;

  constructor(
    brokerUrl: string,
    options?: Omit<MQTT.IClientOptions, "clientId">,
  ) {
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

  public async on(...args: Parameters<typeof MQTT.MqttClient.prototype.on>) {
    const client = await this.#getClient();
    const [event, callback] = args;
    client.on(...args);

    if (event === "connect" && client.connected) {
      callback(null as never, {} as Buffer, {} as MQTT.IPublishPacket);
    }

    return this;
  }

  public async publishAsync(
    topic: string,
    message: object,
    options?: MQTT.IClientPublishOptions,
    callback?: MQTT.PacketCallback,
  ) {
    const toSend = JSON.stringify({ ...message, id: generateUUID(), dateTime: new Date().toISOString() });
    console.log("publishing", topic, toSend);
    const client = await this.#getClient();
    client.publish(topic, toSend, options, callback);
  }

  public async subscribeAsync(
    topicObject: string | string[] | MQTT.ISubscriptionMap,
    options?: MQTT.IClientSubscribeOptions | MQTT.IClientSubscribeProperties,
    callback?: MQTT.ClientSubscribeCallback,
  ) {
    const client = await this.#getClient();
    client.subscribe(topicObject, options, callback);
  }

  public get id() {
    return this.client?.options.clientId;
  }
}
