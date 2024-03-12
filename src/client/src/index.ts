import { MqttClient } from "../../common/MqttClient";
import * as d3 from "d3";
import { drawSvg, updateSvg } from "./d3/svg";
import { CLIENT_ID_PREFIX, Link, Node } from "./d3/constants";

const svg = d3.create("svg");
const MQTT_BROKER_CENTER = "MQTT_BROKER_CENTER";
let nodes: Node[] = [
  {
    id: MQTT_BROKER_CENTER,
    name: "MQTT Broker",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  },
];
let links: Link[] = [];

function pushIfNotExists<T extends { id: string }>(array: T[], item: T) {
  if (array.find((x) => x.id === item.id)) return item;
  array.push(item);
  return item;
}

function findOrCreateNode(id: string, name?: string) {
  const item = nodes.find((node) => node.id === id);

  return (
    item ??
    pushIfNotExists(nodes, {
      id,
      name,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
  );
}

function createLinkId(source: string, target: string, topic: string) {
  return `FROM_${source}_TO_${target}_ON_${topic}`;
}

function createPathNodes(topic: string, clientId?: string) {
  const paths = topic.split("/");

  let pathWalked = "";
  paths.forEach((path, index, array) => {
    const id = `${pathWalked}${path}/`;

    if (index === 0) {
      pushIfNotExists(links, {
        id: createLinkId(MQTT_BROKER_CENTER, path, topic),
        source: findOrCreateNode(MQTT_BROKER_CENTER),
        target: findOrCreateNode(id, path),
      });
    }

    if (index > 0) {
      pushIfNotExists(links, {
        id: createLinkId(path, array.at(-1)!, topic),
        source: findOrCreateNode(id, path),
        target: findOrCreateNode(pathWalked),
      });
    }

    if (index === array.length - 1 && clientId) {
      pushIfNotExists(links, {
        id: createLinkId(path, clientId, topic),
        source: findOrCreateNode(id, path),
        target: findOrCreateNode(clientId),
      });
    }

    pathWalked = id;
  });
}

const handleMessage = (topic: string, message: Buffer | Uint8Array) => {
  switch (topic) {
    case "$CONNECTIONS/disconnect":
      const disconnectedClientId = JSON.parse(message.toString());
      if (disconnectedClientId.includes(CLIENT_ID_PREFIX)) return;

      nodes = nodes.filter((node) => node.id !== disconnectedClientId);
      links = links.filter(
        (link) =>
          (link.source as Link).id !== disconnectedClientId &&
          (link.target as Link).id !== disconnectedClientId,
      );
      break;
    case "$CONNECTIONS/connect":
      const connectedClientId = JSON.parse(message.toString());
      if (connectedClientId.includes(CLIENT_ID_PREFIX)) return;
      pushIfNotExists(nodes, {
        id: connectedClientId,
        isClient: true,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${connectedClientId}`,
        source: findOrCreateNode(MQTT_BROKER_CENTER),
        target: findOrCreateNode(connectedClientId),
      });
      break;
    case "$CONNECTIONS/subscribe":
      const subscription = JSON.parse(message.toString());
      if (subscription.clientId.includes(CLIENT_ID_PREFIX)) return;
      createPathNodes(subscription.topic, subscription.clientId);
      break;
    case "$CONNECTIONS/unsubscribe":
      const unsubscription = JSON.parse(message.toString());
      if (unsubscription.clientId.includes(CLIENT_ID_PREFIX)) return;
      links = links.filter((link) => {
        const { clientId, topic } = unsubscription;
        const path = topic.split("/");

        const expectedToRemove = createLinkId(path.at(-1), clientId, topic);
        return link.id !== expectedToRemove;
      });
      break;
    default:
      console.log("unknown topic", topic, message);
      createPathNodes(topic);
      // TODO: create animation on path to all subscribers
      break;
  }
  updateSvg(svg, links, nodes);
};

const client = new MqttClient("ws://127.0.0.1:9001", {
  username: "username",
  password: "password",
});
client.on("message", handleMessage);

fetch("http://127.0.0.1:8080")
  .then((res) => res.json())
  .then(async (data: { [key: string]: string[] }) => {
    Object.entries(data).forEach(([clientId, topics]) => {
      if (clientId.includes(CLIENT_ID_PREFIX)) return;
      pushIfNotExists(nodes, {
        id: clientId,
        isClient: true,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${clientId}`,
        source: findOrCreateNode(MQTT_BROKER_CENTER),
        target: findOrCreateNode(clientId),
      });
      topics.forEach((topic) => createPathNodes(topic, clientId));
    });

    drawSvg(svg, links, nodes);
    await client.subscribeAsync("$CONNECTIONS/#");
    await client.subscribeAsync("#");
  });
