import { MqttClient } from "../../common/MqttClient";
import { SHIFTR_CLONE_TOPIC } from "../../common/topics";
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

// localStorage.debug = "mqttjs*"; // For debugging MQTT client

document.querySelector("#host")!.innerHTML = window.location.host;

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
client.subscribeAsync("SHIFTR_CLONE/#");

function fetchConnections() {
  fetch(import.meta.env.VITE_CLIENT_HTTP_CONNECTIONS)
    .then((res) => res.json())
    .then(async (data: { [key: string]: string[] }) => {
      const clients = Object.entries(data);
      const clientIds = [
        MQTT_BROKER_NODE_ID,
        ...clients.map(([clientId]) => clientId),
      ];

      links = [];
      nodes = nodes.filter(({ id }) => clientIds.includes(id));

      clients.forEach(([clientId, topics]) => {
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
    })
    .catch((err) => console.error(err));
}

const Message = z.object({
  id: z.string().uuid(),
});
const ClientMessage = Message.extend({
  clientId: z.string(),
});
const TopicMessage = ClientMessage.extend({
  topic: z.string(),
});

function messageHandler(topic: string, message: Buffer | Uint8Array) {
  // console.log("messageHandler", topic, message.toString());
  const parsed = JSON.parse(message.toString());

  switch (topic) {
    case SHIFTR_CLONE_TOPIC.DISCONNECT:
      handleDisconnect(ClientMessage.parse(parsed));
      updateSvg(links, nodes);
      break;
    case SHIFTR_CLONE_TOPIC.CONNECT:
      handleConnect(ClientMessage.parse(parsed));
      updateSvg(links, nodes);
      break;
    case SHIFTR_CLONE_TOPIC.SUBSCRIBE:
      handleSubscribe(TopicMessage.parse(parsed));
      updateSvg(links, nodes);
      break;
    case SHIFTR_CLONE_TOPIC.UNSUBSCRIBE:
      handleUnsubscribe(TopicMessage.parse(parsed));
      updateSvg(links, nodes);
      break;
    case SHIFTR_CLONE_TOPIC.PUBLISH:
      const hasNewNodesOrLinks = handlePublish(TopicMessage.parse(parsed));
      if (hasNewNodesOrLinks) updateSvg(links, nodes);
      break;
    default:
      console.log("default", topic, message);
      break;
  }
}

function getRandomCoordinatesOnCircle(radius = 400) {
  const angle = Math.random() * 2 * Math.PI;

  return {
    x: radius * Math.cos(angle) + window.innerWidth / 2,
    y: radius * Math.sin(angle) + window.innerHeight / 2,
  };
}

export function createClientNodeIfNotExist(
  clientId: string,
  nodes: SimulationNode[],
) {
  return pushIfNotExists(nodes, {
    id: clientId,
    name: clientId,
    isClient: true,
    ...getRandomCoordinatesOnCircle(),
  });
}

function handleDisconnect(message: z.infer<typeof ClientMessage>) {
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

function handleConnect(message: z.infer<typeof ClientMessage>) {
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

function getPathFromBrokerToNodeId(nodeId: string, links: SimulationLink[]) {
  let currentId = nodeId;
  const nodeIds = [nodeId];

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

function findLeafNodes(links: SimulationLink[]) {
  const sources = new Set(
    links.map(({ source }) => (source as SimulationNode).id),
  );

  return links.filter(
    ({ target }) => !sources.has((target as SimulationNode).id),
  );
}

function handlePublish(message: z.infer<typeof TopicMessage>) {
  // TODO: Handle publish on topic with `+` and `#` wildcards
  const { clientId, topic } = message;

  const currentNodesLength = nodes.length;
  const currentLinksLength = links.length;
  createClientNodeIfNotExist(clientId, nodes);
  pushIfNotExists(links, {
    id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
    source: findOrCreateNode(MQTT_BROKER_NODE_ID, nodes),
    target: findOrCreateNode(clientId, nodes),
  });
  createPathNodesIfNotExist(topic, links, nodes);

  const animationId = generateUUID();
  animations.set(animationId, [clientId, MQTT_BROKER_NODE_ID]);
  animationCallbacks.set(animationId, () => {
    const linksInTopic = links.filter((link) => link.topic === topic);
    const leafes = findLeafNodes(linksInTopic);

    leafes
      .map((link) => {
        return (link.target as SimulationNode).id;
      })
      .forEach((leafId) => {
        animations.set(generateUUID(), [
          MQTT_BROKER_NODE_ID,
          ...getPathFromBrokerToNodeId(leafId, linksInTopic),
        ]);
      });
  });

  return (
    nodes.length !== currentNodesLength || links.length !== currentLinksLength
  );
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
  li.ariaLabel = description;
  li.role = "button";
  li.tabIndex = 0;
  li.dataset.trigger = key;
  li.innerHTML = description.replace(key, `<span>${key}</span>`);
  li.onclick = () => callback();
  hotkeys.appendChild(li);
}

addKeyboardHandler("c", "clear graph", fetchConnections);
addKeyboardHandler("r", "reload page", () => window.location.reload());

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  switch (key) {
    case "enter":
      const trigger =
        document.activeElement?.attributes.getNamedItem("data-trigger")?.value;
      if (!trigger) return;

      const handler = keyHandlers.get(trigger);
      handler?.();
      break;
    default:
      keyHandlers.get(key)?.();
      break;
  }
});

d3.select(window).on("resize", () => {
  svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  updateSvg(links, nodes);
});
