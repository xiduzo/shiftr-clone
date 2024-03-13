import { MqttClient } from "../../common/MqttClient";
import * as d3 from "d3";
import { drawSvg, updateSvg } from "./d3/svg";
import { SimulationLink, SimulationNode } from "./d3/types";
import { pushIfNotExists } from "./array";
import {
  createLinkId,
  createPathNodesIfNotExist,
  findOrCreateNode,
} from "./d3/utils";
import { animate, animationCallbacks, animations } from "./d3/animation";
import { generateUUID } from "./utils";
import { MQTT_BROKER_NODE_ID, CLIENT_ID_PREFIX } from "../../common/constants";

const svg = d3.create("svg");
let nodes: SimulationNode[] = [
  {
    id: MQTT_BROKER_NODE_ID,
    name: "MQTT Broker",
    ...getRandomCoordinatesOnCircle(),
  },
];
let links: SimulationLink[] = [];

const client = new MqttClient(
  import.meta.env.VITE_CLIENT_MQTT_CONNECTION_STRING,
);
client.on("message", messageHandler);

fetch(import.meta.env.VITE_CLIENT_HTTP_CONNECTIONS)
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

function messageHandler(topic: string, message: Buffer | Uint8Array) {
  switch (topic) {
    case "$CONNECTIONS/disconnect":
      handleDisconnect(message.toString());
      break;
    case "$CONNECTIONS/connect":
      handleConnect(message.toString());
      break;
    case "$CONNECTIONS/subscribe":
      handleSubscribe(message.toString());
      break;
    case "$CONNECTIONS/unsubscribe":
      handleUnsubscribe(message.toString());
      break;
    case "$CONNECTIONS/publish":
      handlePublish(message.toString());
      break;
    default:
      console.log("default", topic, message);
      break;
  }
  updateSvg(links, nodes);
}

function getRandomCoordinatesOnCircle(radius = 400) {
  // Generate a random angle in radians
  const angle = Math.random() * 2 * Math.PI;

  // Calculate x and y coordinates using trigonometry
  const x = radius * Math.cos(angle) + window.innerWidth / 2;
  const y = radius * Math.sin(angle) + window.innerHeight / 2;

  return { x, y };
}

export function createClientNodeIfNotExist(
  clientId: string,
  nodes: SimulationNode[],
) {
  pushIfNotExists(nodes, {
    id: clientId.replace("/", "_"), // to avoid d3 crash with topics and clients with same id
    name: clientId,
    isClient: true,
    ...getRandomCoordinatesOnCircle(),
  });
}

const handleDisconnect = (message: string) => {
  const disconnectedClientId = JSON.parse(message);
  if (disconnectedClientId.includes(CLIENT_ID_PREFIX)) return;

  nodes = nodes.filter((node) => node.id !== disconnectedClientId);
  links = links.filter(
    (link) =>
      (link.source as SimulationLink).id !== disconnectedClientId &&
      (link.target as SimulationLink).id !== disconnectedClientId,
  );
  return { nodes, links };
};

const handleConnect = (message: string) => {
  const connectedClientId = JSON.parse(message);
  if (connectedClientId.includes(CLIENT_ID_PREFIX)) return;
  createClientNodeIfNotExist(connectedClientId, nodes);
  pushIfNotExists(links, {
    id: `${MQTT_BROKER_NODE_ID}_${connectedClientId}`,
    source: findOrCreateNode(MQTT_BROKER_NODE_ID, nodes),
    target: findOrCreateNode(connectedClientId, nodes),
  });
};

const handleSubscribe = (message: string) => {
  // TODO: Handle subscribe on topic with `#` wildcards
  const subscription = JSON.parse(message);
  if (subscription.clientId.includes(CLIENT_ID_PREFIX)) return;
  createPathNodesIfNotExist(
    subscription.topic,
    links,
    nodes,
    subscription.clientId,
  );
};

const handleUnsubscribe = (message: string) => {
  // TODO: Handle unsubscribe on topic with `+` or `#` wildcards
  const unsubscription = JSON.parse(message);
  if (unsubscription.clientId.includes(CLIENT_ID_PREFIX)) return;
  links = links.filter((link) => {
    const { clientId, topic } = unsubscription;
    const path = topic.split("/");
    const expectedToRemove = createLinkId(path.at(-1), clientId, topic);

    return link.id !== expectedToRemove;
  });
};

const getNodeIdsFromClientToBroker = (
  clientId: string,
  links: SimulationLink[],
) => {
  let currentId = clientId;
  const nodeIds = [clientId];

  while (currentId !== MQTT_BROKER_NODE_ID) {
    const link = links.find((link) => {
      const linkId = (link.target as SimulationNode).id;
      return linkId === currentId;
    });
    if (link) {
      const id = (link.source as SimulationNode).id;
      currentId = id;
      nodeIds.unshift(id);
    }
  }
  return nodeIds;
};

const handlePublish = (message: string) => {
  // TODO: Handle publish on topic with `+` and `#` wildcards
  const publish = JSON.parse(message);
  const { clientId, topic } = publish;
  createClientNodeIfNotExist(clientId, nodes);
  createPathNodesIfNotExist(topic, links, nodes);

  const animationId = generateUUID();
  animations.set(animationId, [clientId, MQTT_BROKER_NODE_ID]);
  animationCallbacks.set(animationId, () => {
    const linksInTopic = links.filter((link) => link.topic === topic);
    linksInTopic
      .filter((link) => (link.target as SimulationNode).isClient)
      .map((link) => (link.target as SimulationNode).id)
      .forEach((clientId) => {
        animations.set(generateUUID(), [
          MQTT_BROKER_NODE_ID,
          ...getNodeIdsFromClientToBroker(clientId, linksInTopic),
        ]);
      });
  });
};

// Press 'R' to reload page
document.addEventListener("keydown", (event) => {
  if (event.key === "r") window.location.reload();
});

window.addEventListener("resize", () => {
  svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
});
