import * as d3 from "d3";
import { SimulationLink, SimulationNode } from "./types";
import { pushIfNotExists } from "../array";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";

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

export function findOrCreateNode(
  id: string,
  nodes: SimulationNode[],
  name?: string,
) {
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

export function createPathNodesIfNotExist(
  topic: string,
  links: SimulationLink[],
  nodes: SimulationNode[],
  clientId?: string,
) {
  const paths = topic.split("/");

  let pathWalked = "";
  paths.forEach((path, index, array) => {
    const id = `${pathWalked}${pathWalked === "" ? "" : "_SLASH_"}${path}`;

    if (index === 0) {
      pushIfNotExists(links, {
        id: createLinkId(MQTT_BROKER_NODE_ID, path, topic),
        source: findOrCreateNode(MQTT_BROKER_NODE_ID, nodes),
        target: findOrCreateNode(id, nodes, path),
        topic,
      });
    }

    if (index > 0) {
      pushIfNotExists(links, {
        id: createLinkId(array.at(index - 1)!, path, topic),
        source: findOrCreateNode(pathWalked, nodes, path),
        target: findOrCreateNode(id, nodes, path),
        topic,
      });
    }

    if (index === array.length - 1 && clientId) {
      pushIfNotExists(links, {
        id: createLinkId(path, clientId, topic),
        source: findOrCreateNode(id, nodes, path),
        target: findOrCreateNode(clientId, nodes),
        topic,
      });
    }

    pathWalked = id;
  });

  addImplicitSubscriptions(links, nodes);
}

function addImplicitSubscriptions(
  links: SimulationLink[],
  nodes: SimulationNode[],
) {
  // step 1 get all clients subscribed to a wildcard
  // step 2 get all topics that match the wildcard
  // step 3 create links between topics and clients
  links
    .filter((link) => {
      // step 1
      const target = link.target as SimulationNode;
      if (!target.isClient) return false;

      return link.topic?.includes("#") || link.topic?.includes("+");
    })
    .forEach((link) => {
      // step 2
      const clientId = (link.target as SimulationNode).id;
      if (!link.topic) return;

      const originalTopic = link.topic;

      const topicRegex = link.topic
        .replace(/\//g, "\\/")
        .replace(/\+/g, "[^/]+")
        .replace(/#/g, "\\S+$");

      const regex = new RegExp(`^${topicRegex}$`);
      links.forEach((link) => {
        // step 3
        const target = link.target as SimulationNode;
        if (!link.topic) return false;
        if (link.topic === originalTopic) return false;
        if (link.topic !== target.id.replace(/_SLASH_/g, "/")) return false;
        if (!regex.test(link.topic)) return false;

        pushIfNotExists(links, {
          id: createLinkId(link.topic, clientId, link.topic),
          source: findOrCreateNode(target.id, nodes, link.topic),
          target: findOrCreateNode(clientId, nodes),
          topic: link.topic,
        });
      });
    });
}
