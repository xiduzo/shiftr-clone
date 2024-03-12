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
  if (array.find((x) => x.id === item.id)) return;
  array.push(item);
}

const findNode = (id: string) =>
  nodes.find((node) => node.id === id) as d3.SimulationNodeDatum;

const handleMessage = (topic: string, message: Buffer) => {
  const messageString = JSON.parse(message.toString());
  console.log(topic, messageString);
  switch (topic) {
    case "$CONNECTIONS/disconnect":
      nodes = nodes.filter((node) => node.id !== messageString);
      links = links.filter(
        (link) =>
          (link.source as Link).id !== messageString &&
          (link.target as Link).id !== messageString,
      );
      updateSvg(svg, links, nodes);
      break;
    case "$CONNECTIONS/connect":
      if (messageString.includes(CLIENT_ID_PREFIX)) return;
      pushIfNotExists(nodes, { id: messageString, isClient: true });
      console.log({
        id: `${MQTT_BROKER_CENTER}_${messageString}`,
        source: findNode(MQTT_BROKER_CENTER),
        target: findNode(messageString),
      });
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${messageString}`,
        source: findNode(MQTT_BROKER_CENTER),
        target: findNode(messageString),
      });
      updateSvg(svg, links, nodes);
      break;
    default:
      console.log("unknown topic", topic, messageString);
      break;
  }
};

const client = new MqttClient("ws://127.0.0.1:9001", {
  username: "username",
  password: "password",
});
client.on("message", handleMessage);

fetch("http://127.0.0.1:8080")
  .then((res) => res.json())
  .then(async (data: { [key: string]: string[] }) => {
    Object.entries(data).forEach(([clientId, targets]) => {
      if (clientId.includes(CLIENT_ID_PREFIX)) return;
      pushIfNotExists(nodes, { id: clientId, isClient: true });
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_CENTER}_${clientId}`,
        source: findNode(MQTT_BROKER_CENTER),
        target: findNode(clientId),
      });
      targets.forEach((target) => {
        const paths = target.split("/");

        paths.forEach((path, index, array) => {
          pushIfNotExists(nodes, { id: path });

          if (index === 0) {
            pushIfNotExists(links, {
              id: `${MQTT_BROKER_CENTER}_${path}`,
              source: findNode(MQTT_BROKER_CENTER),
              target: findNode(path),
            });
          }

          if (index > 0) {
            pushIfNotExists(links, {
              id: `${path}_${array[index - 1]}`,
              source: findNode(path),
              target: findNode(array[index - 1]),
            });
          }

          if (index === array.length - 1) {
            pushIfNotExists(links, {
              id: `${path}_${clientId}`,
              source: findNode(path),
              target: findNode(clientId),
            });
          }
        });
      });
    });

    drawSvg(svg, links, nodes);
    await client.subscribeAsync("$CONNECTIONS/#");
  });
