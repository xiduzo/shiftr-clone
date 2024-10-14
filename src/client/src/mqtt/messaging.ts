import { z } from "zod";
import { clientId } from ".";
import {
    CLIENT_ID_PREFIX,
    MQTT_BROKER_NODE_ID,
} from "../../../common/constants";
import { SHIFTR_CLONE_TOPIC } from "../../../common/topics";
import { generateUUID } from "../../../common/utils";
import { animationCallbacks, animations } from "../d3/animation";
import { Store } from "../d3/store";
import { updateSvg } from "../d3/svg";
import { MqttEdge, MqttNode } from "../d3/types";
import {
    createClientNodeIfNotExist,
    createLinkId,
    createPathNodesIfNotExist,
    findOrCreateNode,
} from "../d3/utils";

const Message = z.object({
  id: z.string().uuid(),
});
const ClientMessage = Message.extend({
  clientId: z.string(),
});
const TopicMessage = ClientMessage.extend({
  topic: z.string(),
});

export function handleMqttMessage(topic: string, message: Buffer | Uint8Array) {
  // console.log("messageHandler", topic, message.toString());
  // console.log("messageHandler", topic, message.toString());
  const parsed = JSON.parse(message.toString());

  switch (topic) {
    case SHIFTR_CLONE_TOPIC.DISCONNECT:
      handleDisconnect(ClientMessage.parse(parsed));
      updateSvg();
      break;
    case SHIFTR_CLONE_TOPIC.CONNECT:
      handleConnect(ClientMessage.parse(parsed));
      updateSvg();
      break;
    case SHIFTR_CLONE_TOPIC.SUBSCRIBE:
      handleSubscribe(TopicMessage.parse(parsed));
      updateSvg();
      break;
    case SHIFTR_CLONE_TOPIC.UNSUBSCRIBE:
      handleUnsubscribe(TopicMessage.parse(parsed));
      updateSvg();
      break;
    case SHIFTR_CLONE_TOPIC.PUBLISH:
      handlePublish(TopicMessage.parse(parsed));
      break;
    default:
      console.log("default", topic, message);
      break;
  }
}

function handleDisconnect(message: z.infer<typeof ClientMessage>) {
  const { clientId } = message;

  if (clientId.includes(CLIENT_ID_PREFIX)) return;

  const nodes = Store.getNodes().filter((node) => node.id !== clientId);
  const edges = Store.getEdges().filter(
    ({ source, target }) =>
      (source as MqttEdge).id !== clientId &&
      (target as MqttEdge).id !== clientId,
  );

  Store.updateStore(nodes, edges);
}

function handleConnect(message: z.infer<typeof ClientMessage>) {
  if (message.clientId.includes(CLIENT_ID_PREFIX)) {
    return;
  }
  createClientNodeIfNotExist(message.clientId);
  Store.addEdge({
    id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
    source: findOrCreateNode(MQTT_BROKER_NODE_ID),
    target: findOrCreateNode(message.clientId),
  });
}

function handleSubscribe(message: z.infer<typeof TopicMessage>) {
  const { clientId, topic } = message;
  if (clientId.includes(CLIENT_ID_PREFIX)) return;
  createPathNodesIfNotExist(topic, clientId);
}

function handleUnsubscribe(message: z.infer<typeof TopicMessage>) {
  const { clientId, topic } = message;
  if (clientId.includes(CLIENT_ID_PREFIX)) return;
  const edges = Store.getEdges().filter((edge) => {
    const path = topic.split("/");
    const expectedToRemove = createLinkId(path.at(-1)!, clientId, topic);

    return edge.id !== expectedToRemove;
  });

  Store.setEdges(edges);
}

function handlePublish(message: z.infer<typeof TopicMessage>) {
  const { clientId, topic } = message;

  const currentNodesLength = Store.getNodes().length;
  const currentEdgessLength = Store.getEdges().length;
  createClientNodeIfNotExist(clientId);
  Store.addEdge({
    id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
    source: findOrCreateNode(MQTT_BROKER_NODE_ID),
    target: findOrCreateNode(clientId),
  });
  createPathNodesIfNotExist(topic);

  const hasChanged =
    Store.getNodes().length !== currentNodesLength ||
    Store.getEdges().length !== currentEdgessLength;

  if (hasChanged) updateSvg();

  if (window.document.hidden) return;

  const animationId = generateUUID();
  animations.set(animationId, [clientId, MQTT_BROKER_NODE_ID]);
  animationCallbacks.set(animationId, () => {
    const edgesInTopic = Store.getEdges().filter(
      (edge) => edge.topic === topic,
    );
    const leafs = findLeafNodes(edgesInTopic);

    leafs
      .map((leaf) => (leaf.target as MqttNode).id)
      .forEach((leafId) => {
        const path = getPathFromBrokerToNodeId(leafId, edgesInTopic)

        animations.set(generateUUID(), [MQTT_BROKER_NODE_ID, ...path]);
      });
  });
}

function findLeafNodes(edges: MqttEdge[]) {
  const sources = new Set(edges.map(({ source }) => (source as MqttNode).id));

  return edges.filter(({ target }) => !sources.has((target as MqttNode).id));
}

function getPathFromBrokerToNodeId(nodeId: string, edges: MqttEdge[]) {
  let currentId = nodeId;
  const nodeIds = [nodeId];

  while (currentId !== MQTT_BROKER_NODE_ID) {
    const edge = edges.find((edge) => {
      const edgeId = (edge.target as MqttNode).id;
      return edgeId === currentId;
    });
    if (edge) {
      const id = (edge.source as MqttNode).id;
      currentId = id;
      nodeIds.unshift(id);
    }
  }

  return nodeIds;
}
