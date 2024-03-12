import { MqttClient } from "../../common/MqttClient";
import * as d3 from "d3";
import { drawSvg } from "./d3/svg";
import {
  CLIENT_ID_PREFIX,
  Link,
  MQTT_BROKER_NODE_ID,
  Node,
} from "./d3/constants";
import { pushIfNotExists } from "./array";
import { createPathNodesIfNotExist, findOrCreateNode } from "./d3/utils";
import { animate } from "./d3/animation";
import { createClientNodeIfNotExist, messageHandler } from "./messageHandler";

const svg = d3.create("svg");
let nodes: Node[] = [
  {
    id: MQTT_BROKER_NODE_ID,
    name: "MQTT Broker",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  },
];
let links: Link[] = [];

const client = new MqttClient("ws://127.0.0.1:9001", {
  username: "username",
  password: "password",
});
client.on("message", (topic, message) =>
  messageHandler(topic, message, nodes, links, svg),
);

fetch("http://127.0.0.1:8080")
  .then((res) => res.json())
  .then(async (data: { [key: string]: string[] }) => {
    Object.entries(data).forEach(([clientId, topics]) => {
      if (clientId.includes(CLIENT_ID_PREFIX)) return;
      createClientNodeIfNotExist(clientId, nodes);
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
        source: findOrCreateNode(MQTT_BROKER_NODE_ID, nodes),
        target: findOrCreateNode(clientId, nodes),
      });
      topics.forEach((topic) =>
        createPathNodesIfNotExist(topic, links, nodes, clientId),
      );
      requestAnimationFrame((time) => animate(time, svg));
    });

    drawSvg(svg, links, nodes);
    await client.subscribeAsync("$CONNECTIONS/#");
  });
