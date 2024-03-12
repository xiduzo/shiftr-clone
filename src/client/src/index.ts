import { MqttClient } from "../../common/MqttClient";
import * as d3 from "d3";
import { drawSvg, updateSvg } from "./d3/svg";
import { CLIENT_ID_PREFIX, Link, Node } from "./d3/constants";

const svg = d3.create("svg");
const MQTT_BROKER_CENTER = "MQTT_BROKER_CENTER";
let nodes: Node[] = [
  {
    id: MQTT_BROKER_CENTER,
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

function findOrCreateNode(id: string) {
  const item = nodes.find((node) => node.id === id);
  return item ?? pushIfNotExists(nodes, { id });
}

function linkClientWithTopic(clientId: string, topic: string) {
  const paths = topic.split("/");

  paths.forEach((path, index, array) => {
    pushIfNotExists(nodes, { id: path });

    if (index === 0) {
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${path}`,
        source: findOrCreateNode(MQTT_BROKER_CENTER),
        target: findOrCreateNode(path),
      });
    }

    if (index > 0) {
      pushIfNotExists(links, {
        id: `${path}_${array[index - 1]}`,
        source: findOrCreateNode(path),
        target: findOrCreateNode(array[index - 1]),
      });
    }

    if (index === array.length - 1) {
      pushIfNotExists(links, {
        id: `${path}_${clientId}`,
        source: findOrCreateNode(path),
        target: findOrCreateNode(clientId),
      });
    }
  });
}

const handleMessage = (topic: string, message: Buffer) => {
  const parsedMessage = JSON.parse(message.toString());
  console.log(topic, parsedMessage);
  switch (topic) {
    case "$CONNECTIONS/disconnect":
      nodes = nodes.filter((node) => node.id !== parsedMessage);
      links = links.filter(
        (link) =>
          (link.source as Link).id !== parsedMessage &&
          (link.target as Link).id !== parsedMessage,
      );
      break;
    case "$CONNECTIONS/connect":
      if (parsedMessage.includes(CLIENT_ID_PREFIX)) return;
      pushIfNotExists(nodes, { id: parsedMessage, isClient: true });
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${parsedMessage}`,
        source: findOrCreateNode(MQTT_BROKER_CENTER),
        target: findOrCreateNode(parsedMessage),
      });
      break;
    case "$CONNECTIONS/subscribe":
      if (parsedMessage.clientId.includes(CLIENT_ID_PREFIX)) return;
      linkClientWithTopic(parsedMessage.clientId, parsedMessage.topic);
      break;
    case "$CONNECTIONS/unsubscribe":
      if (parsedMessage.clientId.includes(CLIENT_ID_PREFIX)) return;
      links = links.filter((link) => {
        const path = parsedMessage.topic.split("/");
        const sourceIsMatch = (link.source as Node).id === path.at(-1);
        const targetIsMatch =
          (link.target as Node).id === parsedMessage.clientId;

        return !sourceIsMatch || !targetIsMatch;
      });
      break;
    default:
      console.log("unknown topic", topic, parsedMessage);
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
      pushIfNotExists(nodes, { id: clientId, isClient: true });
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${clientId}`,
        source: findOrCreateNode(MQTT_BROKER_CENTER),
        target: findOrCreateNode(clientId),
      });
      topics.forEach((topic) => {
        linkClientWithTopic(clientId, topic);
      });
    });

    drawSvg(svg, links, nodes);
    await client.subscribeAsync("$CONNECTIONS/#");
  });
