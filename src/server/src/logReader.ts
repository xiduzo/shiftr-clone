import { Tail } from "tail";
import { MqttClient } from "../../common/MqttClient";
import { CLIENT_ID_PREFIX } from "../../common/constants";

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

          _topic = null;
          _clienId = null;
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
  await client.publishAsync("$CONNECTIONS/connect", { clientId });
}

async function handleDisconnect(clientId: string) {
  console.log(`${clientId} disconnected`);
  connections.delete(clientId);
  await client.publishAsync("$CONNECTIONS/disconnect", { clientId });
}

async function handleSubscribe(clientId: string, topic: string) {
  console.log(`${clientId} subscribed to ${topic}`);

  const subscriptions = connections.get(clientId);
  connections.set(
    clientId,
    Array.from(new Set([...(subscriptions ?? []), topic])),
  );
  await client.publishAsync("$CONNECTIONS/subscribe", { clientId, topic });
}

async function handleUnsubscribe(clientId: string, topic: string) {
  console.log(`${clientId} unsubscribed from ${topic}`);

  const subscriptions = connections.get(clientId);
  connections.set(
    clientId,
    subscriptions?.filter((subscription) => subscription !== topic) ?? [],
  );
  await client.publishAsync("$CONNECTIONS/unsubscribe", { clientId, topic });
}

async function handlePublish(clientId: string, topic: string) {
  await client.publishAsync("$CONNECTIONS/publish", { clientId, topic });
}

async function handleUnknowAction(line: string) {
  const words = line.split(" ");

  if (line.includes("closed its connection") || line.includes("disconnected")) {
    handleDisconnect(words[2]);
    return;
  }

  const topicMatch = new RegExp(`\\S+: ${_clienId}( \\d)? (\\S+)`).exec(line);
  if (topicMatch) {
    _topic = topicMatch[2];
    return;
  }
}

startTailing();
