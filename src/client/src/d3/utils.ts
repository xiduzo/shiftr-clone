import * as d3 from "d3";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";
import { Store } from "./store";
import { MqttNode } from "./types";

export function createLinkId(source: string, target: string, topic: string) {
  return `FROM_${source}_TO_${target}_ON_${topic}`;
}

export function getNodePosition(nodeId: string) {
  const node = d3.select(`#nodes #${nodeId}`);

  try {
    const x = +node.attr("cx");
    const y = +node.attr("cy");

    return { x, y };
  } catch {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
}

export function findOrCreateNode(id: string, name?: string) {
  const item = Store.getNodes().find((node) => node.id === id);

  if (item) {
    return item;
  }

  return Store.addNode({
    id,
    name,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
}

export function getRandomCoordinatesOnCircle(radius = 400) {
  const angle = Math.random() * 2 * Math.PI;

  return {
    x: radius * Math.cos(angle) + window.innerWidth / 2,
    y: radius * Math.sin(angle) + window.innerHeight / 2,
  };
}

export function createClientNodeIfNotExist(clientId: string) {
  return Store.addNode({
    id: clientId,
    name: clientId,
    isClient: true,
    ...getRandomCoordinatesOnCircle(),
  });
}

export function createPathNodesIfNotExist(topic: string, clientId?: string) {
  const paths = topic.split("/");

  let pathWalked = "";
  paths.forEach((path, index, array) => {
    const id = `${pathWalked}${pathWalked === "" ? "" : "_SLASH_"}${path}`;

    if (index === 0) {
      Store.addEdge({
        id: createLinkId(MQTT_BROKER_NODE_ID, path, topic),
        source: findOrCreateNode(MQTT_BROKER_NODE_ID),
        target: findOrCreateNode(id, path),
        topic,
      });
    }

    if (index > 0) {
      Store.addEdge({
        id: createLinkId(array.at(index - 1)!, path, topic),
        source: findOrCreateNode(pathWalked, path),
        target: findOrCreateNode(id, path),
        topic,
      });
    }

    if (index === array.length - 1 && clientId) {
      Store.addEdge({
        id: createLinkId(path, clientId, topic),
        source: findOrCreateNode(id, path),
        target: findOrCreateNode(clientId),
        topic,
      });
    }

    pathWalked = id;
  });

  addImplicitSubscriptions();
}

function addImplicitSubscriptions() {
  // step 1 get all clients subscribed to a wildcard
  // step 2 get all topics that match the wildcard
  // step 3 create links between topics and clients
  Store.getEdges()
    .filter((edge) => {
      // step 1
      const target = edge.target as MqttNode;
      if (!target.isClient) return false;

      return edge.topic?.includes("#") || edge.topic?.includes("+");
    })
    .forEach((edge) => {
      // step 2
      const clientId = (edge.target as MqttNode).id;
      if (!edge.topic) return;

      const originalTopic = edge.topic;

      const topicRegex = edge.topic
        .replace(/\//g, "\\/")
        .replace(/\+/g, "[^/]+")
        .replace(/#/g, "\\S+$");

      const regex = new RegExp(`^${topicRegex}$`);
      Store.getEdges().forEach((edge) => {
        // step 3
        const target = edge.target as MqttNode;
        if (!edge.topic) return false;
        if (edge.topic === originalTopic) return false;
        if (edge.topic !== target.id.replace(/_SLASH_/g, "/")) return false;
        if (!regex.test(edge.topic)) return false;

        Store.addEdge({
          id: createLinkId(edge.topic, clientId, edge.topic),
          source: findOrCreateNode(target.id, edge.topic),
          target: findOrCreateNode(clientId),
          topic: edge.topic,
        });
      });
    });
}
