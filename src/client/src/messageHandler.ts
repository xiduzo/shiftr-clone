import * as d3 from "d3";
import { pushIfNotExists } from "./array";
import { animations, animationCallbacks } from "./d3/animation";
import {
  CLIENT_ID_PREFIX,
  Link,
  Node,
  MQTT_BROKER_NODE_ID,
} from "./d3/constants";
import { updateSvg } from "./d3/svg";
import {
  findOrCreateNode,
  createPathNodesIfNotExist,
  createLinkId,
  getNodePosition,
} from "./d3/utils";
import { generateUUID } from "./utils";

export const messageHandler = (
  topic: string,
  message: Buffer | Uint8Array,
  nodes: Node[],
  links: Link[],
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
) => {
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
      createClientNodeIfNotExist(connectedClientId, nodes);
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_NODE_ID}_${connectedClientId}`,
        source: findOrCreateNode(MQTT_BROKER_NODE_ID, nodes),
        target: findOrCreateNode(connectedClientId, nodes),
      });
      break;
    case "$CONNECTIONS/subscribe":
      const subscription = JSON.parse(message.toString());
      if (subscription.clientId.includes(CLIENT_ID_PREFIX)) return;
      createPathNodesIfNotExist(
        subscription.topic,
        links,
        nodes,
        subscription.clientId,
      );
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
    case "$CONNECTIONS/publish":
      const publish = JSON.parse(message.toString());
      const { clientId, topic } = publish;
      console.log("publish", publish);
      createClientNodeIfNotExist(clientId, nodes);
      createPathNodesIfNotExist(topic, links, nodes);
      const publisher = getNodePosition(clientId);
      const broker = getNodePosition(MQTT_BROKER_NODE_ID);

      const animationId = generateUUID();
      animations.set(animationId, [publisher, broker]);
      animationCallbacks.set(animationId, () => {
        animationCallbacks.delete(animationId);
        const linksForTopic = links.filter((link) => link.topic === topic);
        console.log(linksForTopic);
        const positions = linksForTopic.map(({ target }) => {
          return getNodePosition((target as Node).id);
        });
        animations.set(generateUUID(), [broker, ...positions]);
      });
      break;
    default:
      console.log("default", topic, message);
      break;
  }
  updateSvg(svg, links, nodes);
};

export function createClientNodeIfNotExist(clientId: string, nodes: Node[]) {
  pushIfNotExists(nodes, {
    id: clientId.replace("/", "_"), // to avoid d3 crash with topics and clients with same id
    name: clientId,
    isClient: true,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
}
