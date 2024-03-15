import * as d3 from "d3";
import { SimulationLink, SimulationNode } from "./types";
import { pushIfNotExists } from "../array";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";

export function createLinkId(source: string, target: string, topic: string) {
  return `FROM_${source}_TO_${target}_ON_${topic}`;
}

export function getNodePosition(nodeId: string) {
  const node = d3.select(`.node#${nodeId}`);

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
    const id = `${pathWalked}${pathWalked === "" ? "" : "_"}${path}`;

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

    if (index === array.length - 1) {
      links
        .filter(({ source, target }) => {
          const sourceIsWildcard =
            (source as SimulationNode).id === id.replace(path, "+");
          const targetIsClient = (target as SimulationNode).isClient;
          return sourceIsWildcard && targetIsClient;
        })
        .forEach(({ target }) => {
          pushIfNotExists(links, {
            id: createLinkId(id, (target as SimulationNode).id, topic),
            source: findOrCreateNode(id, nodes, path),
            target: findOrCreateNode((target as SimulationNode).id, nodes),
            topic,
          });
        });

      if (clientId) {
        pushIfNotExists(links, {
          id: createLinkId(path, clientId, topic),
          source: findOrCreateNode(id, nodes, path),
          target: findOrCreateNode(clientId, nodes),
          topic,
        });
      }
    }

    pathWalked = id;
  });
}
