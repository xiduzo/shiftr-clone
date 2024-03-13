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
import { generateUUID } from "../../common/utils";
import { MQTT_BROKER_NODE_ID, CLIENT_ID_PREFIX } from "../../common/constants";
import { z } from "zod";

const svg = d3.create("svg");
let nodes: SimulationNode[] = [
  {
    id: MQTT_BROKER_NODE_ID,
    name: "MQTT Broker",
    ...getRandomCoordinatesOnCircle(),
  },
];
let links: SimulationLink[] = [];

requestAnimationFrame(animate);
drawSvg(svg, links, nodes);
fetchConnections();
const client = new MqttClient(
  import.meta.env.VITE_CLIENT_MQTT_CONNECTION_STRING,
);
client.on("message", messageHandler);
client.subscribeAsync("$CONNECTIONS/#");

function fetchConnections() {
  fetch(import.meta.env.VITE_CLIENT_HTTP_CONNECTIONS)
    .then((res) => res.json())
    .then(async (data: { [key: string]: string[] }) => {
      links = [];
      nodes = nodes.slice(0, 1);

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
      });

      updateSvg(links, nodes);
    });
}

const Message = z.object({
  id: z.string().uuid(),
});
const ClientIdMessage = Message.extend({
  clientId: z.string(),
});
const TopicMessage = ClientIdMessage.extend({
  topic: z.string(),
});

const handledMessages = new Map<string, string>();
function messageHandler(topic: string, message: Buffer | Uint8Array) {
  const parsed = JSON.parse(message.toString());
  const result = Message.parse(parsed);
  if (handledMessages.get(topic) === result.id) return;
  handledMessages.set(topic, result.id);

  switch (topic) {
    case "$CONNECTIONS/disconnect":
      handleDisconnect(ClientIdMessage.parse(parsed));
      break;
    case "$CONNECTIONS/connect":
      handleConnect(ClientIdMessage.parse(parsed));
      break;
    case "$CONNECTIONS/subscribe":
      handleSubscribe(TopicMessage.parse(parsed));
      break;
    case "$CONNECTIONS/unsubscribe":
      handleUnsubscribe(TopicMessage.parse(parsed));
      break;
    case "$CONNECTIONS/publish":
      handlePublish(TopicMessage.parse(parsed));
      break;
    default:
      console.log("default", topic, message);
      break;
  }
  updateSvg(links, nodes);
}

function getRandomCoordinatesOnCircle(radius = 400) {
  const angle = Math.random() * 2 * Math.PI;
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

function handleDisconnect(message: z.infer<typeof ClientIdMessage>) {
  const { clientId } = message;

  if (clientId.includes(CLIENT_ID_PREFIX)) return;

  nodes = nodes.filter((node) => node.id !== clientId);
  links = links.filter(
    (link) =>
      (link.source as SimulationLink).id !== clientId &&
      (link.target as SimulationLink).id !== clientId,
  );
  return { nodes, links };
}

function handleConnect(message: z.infer<typeof ClientIdMessage>) {
  const { clientId } = message;
  if (clientId.includes(CLIENT_ID_PREFIX)) return;
  createClientNodeIfNotExist(clientId, nodes);
  pushIfNotExists(links, {
    id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
    source: findOrCreateNode(MQTT_BROKER_NODE_ID, nodes),
    target: findOrCreateNode(clientId, nodes),
  });
}

function handleSubscribe(message: z.infer<typeof TopicMessage>) {
  // TODO: Handle subscribe on topic with `#` wildcards
  const { clientId, topic } = message;
  if (clientId.includes(CLIENT_ID_PREFIX)) return;
  createPathNodesIfNotExist(topic, links, nodes, clientId);
}

function handleUnsubscribe(message: z.infer<typeof TopicMessage>) {
  // TODO: Handle unsubscribe on topic with `+` or `#` wildcards
  const { clientId, topic } = message;
  if (clientId.includes(CLIENT_ID_PREFIX)) return;
  links = links.filter((link) => {
    const path = topic.split("/");
    const expectedToRemove = createLinkId(path.at(-1)!, clientId, topic);

    return link.id !== expectedToRemove;
  });
}

function getNodeIdsFromClientToBroker(
  clientId: string,
  links: SimulationLink[],
) {
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
}

function handlePublish(message: z.infer<typeof TopicMessage>) {
  // TODO: Handle publish on topic with `+` and `#` wildcards
  const { clientId, topic } = message;

  createClientNodeIfNotExist(clientId, nodes);
  createPathNodesIfNotExist(topic, links, nodes);

  const animationId = generateUUID();
  animations.set(animationId, [clientId, MQTT_BROKER_NODE_ID]);
  animationCallbacks.set(animationId, () => {
    const linksInTopic = links.filter((link) => link.topic === topic);
    linksInTopic
      .filter((link) => (link.target as SimulationNode).isClient)
      .map((link) => {
        return (link.target as SimulationNode).id;
      })
      .forEach((clientId) => {
        animations.set(generateUUID(), [
          MQTT_BROKER_NODE_ID,
          ...getNodeIdsFromClientToBroker(clientId, linksInTopic),
        ]);
      });
  });
}

const keyHandlers = new Map<string, Function>();
function addKeyboardHandler(
  key: string,
  description: string,
  callback: Function,
) {
  keyHandlers.set(key, callback);
  const hotkeys = document.getElementById("hotkeys");
  if (!hotkeys) return;

  const li = document.createElement("li");
  li.innerHTML = `<span>${key}</span> ${description}`;
  hotkeys.appendChild(li);
}

// Press 'R' to reload page
document.addEventListener("keydown", (event) => {
  keyHandlers.get(event.key)?.();
});

addKeyboardHandler("c", "clear graph", fetchConnections);
addKeyboardHandler("r", "reload page", () => window.location.reload());

window.addEventListener("resize", () => {
  svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
});
