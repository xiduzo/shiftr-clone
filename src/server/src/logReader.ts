import { Tail } from "tail";
import { MqttClient } from "../../common/MqttClient";
import { CLIENT_ID_PREFIX } from "../../common/constants";
import { SHIFTR_CLONE_TOPIC } from "../../common/topics";

const TRIGGERS = {
  CONNECT: "CONNECT",
  CONNACK: "CONNACK",
  DISCONNECT: "DISCONNECT",
  PINGREQ: "PINGREQ",
  PINGRESP: "PINGRESP",
  SUBSCRIBE: "SUBSCRIBE",
  SUBACK: "SUBACK",
  UNSUBSCRIBE: "UNSUBSCRIBE",
  UNSUBACK: "UNSUBACK",
  PUBLISH: "PUBLISH",
  PUBACK: "PUBACK",
  PUBREC: "PUBREC",
  PUBREL: "PUBREL",
  PUBCOMP: "PUBCOMP",
};

/**
 * sub and unsub are handled in multiple lines
 */
let _clienId: string | null;
let _topic: string | null;

const client = new MqttClient(process.env.SERVER_MQTT_CONNECTION_STRING!);

client.subscribeAsync('#')
export const connections = new Map<string, string[]>();

async function startTailing() {
  try {
    const tail = new Tail(process.env.SERVER_MQTT_LOG_FILE!);
    tail.on("line", async (line: string) => {
      console.log(">>>>>>>>>>>", line);

      const words = line.split(" ");
      const [_timeStamp, _actionPrefix, action, _actionVerb, clientId] = words;

      switch (action) {
        case TRIGGERS.DISCONNECT:
          await handleDisconnect(clientId);
          break;
        case TRIGGERS.CONNACK:
          await handleConnect(clientId);
          break;
        case TRIGGERS.UNSUBSCRIBE:
        case TRIGGERS.SUBSCRIBE:
          _clienId = clientId;
          break;
        case TRIGGERS.SUBACK:
        case TRIGGERS.UNSUBACK:
          if (!_clienId || !_topic) return;
          action === TRIGGERS.SUBACK
            ? await handleSubscribe(_clienId, _topic)
            : await handleUnsubscribe(_clienId, _topic);
          break;
        case TRIGGERS.PUBLISH:
          if (_actionPrefix.toLowerCase() !== "received") return;
          if (clientId.includes(CLIENT_ID_PREFIX)) return;

          const topicRegex = new RegExp(/\S+ ('\S+')/);
          const match = line.match(topicRegex);
          if (!match) return;

          const topic = match[1].replace(/'/g, "");
          await handlePublish(clientId, topic);
          break;
        case TRIGGERS.PUBACK:
        case TRIGGERS.PUBCOMP:
        case TRIGGERS.PUBREC:
        case TRIGGERS.PUBREL:
        case TRIGGERS.PINGREQ:
        case TRIGGERS.PINGRESP:
          // TODO Handle?
          break;
        default:
          await handleUnknowAction(line);
          break;
      }
    });
  } catch (error) {
    console.error("Error starting tailing", error);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    startTailing();
  }
}

async function handleConnect(clientId: string) {
  console.log(`${clientId} connected`);
  connections.set(clientId, []);
  await client.publishAsync(SHIFTR_CLONE_TOPIC.CONNECT, { clientId });
}

async function handleDisconnect(clientId: string) {
  console.log(`${clientId} disconnected`);
  connections.delete(clientId);
  await client.publishAsync(SHIFTR_CLONE_TOPIC.DISCONNECT, { clientId });
}

async function handleSubscribe(clientId: string, topic: string) {
  console.log(`${clientId} subscribed to ${topic}`);

  const subscriptions = connections.get(clientId);
  connections.set(
    clientId,
    Array.from(new Set([...(subscriptions ?? []), topic])),
  );
  await client.publishAsync(SHIFTR_CLONE_TOPIC.SUBSCRIBE, { clientId, topic });
}

async function handleUnsubscribe(clientId: string, topic: string) {
  console.log(`${clientId} unsubscribed from ${topic}`);

  const subscriptions = connections.get(clientId);
  connections.set(
    clientId,
    subscriptions?.filter((subscription) => subscription !== topic) ?? [],
  );
  await client.publishAsync(SHIFTR_CLONE_TOPIC.UNSUBSCRIBE, {
    clientId,
    topic,
  });
}

// <topic, clientId>
// <topic, message>
const toPublish = new Map<string, string>();

// This is a hack to somehow try to match the messages from the log file
// to the messages that are being sent to the client
// TODO: look into https://mosquitto.org/man/mosquitto_sub-1.html
client.on('message', async (topic, message) => {
  if(topic.startsWith("SHIFTR_CLONE")) return

  let loopTries = 1000;
  while(!toPublish.get(topic) && loopTries-- > 0) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  const clientId = toPublish.get(topic)
  toPublish.delete(topic);

  await client.publishAsync(SHIFTR_CLONE_TOPIC.PUBLISH, { clientId, topic, message: message.toString() });
})

async function handlePublish(clientId: string, topic: string) {
  toPublish.set(topic, clientId)
  // await client.publishAsync(SHIFTR_CLONE_TOPIC.PUBLISH, { clientId, topic });
}

async function handleUnknowAction(line: string) {
  const words = line.split(" ");

  if (
    line.includes("closed its connection") ||
    line.includes("disconnected") ||
    line.includes("has exceeded timeout, disconnecting")
  ) {
    await handleDisconnect(words[2]);
    return;
  }

  const topicMatch = new RegExp(`\\S+: ${_clienId}( \\d)? (\\S+)`).exec(line);
  if (topicMatch) {
    _topic = topicMatch[2];
    return;
  }
}

startTailing();
