import * as d3 from "d3";
import { Link, MQTT_BROKER_NODE_ID, Node } from "./constants";
import { pushIfNotExists } from "../array";

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

export function findOrCreateNode(id: string, nodes: Node[], name?: string) {
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
  links: Link[],
  nodes: Node[],
  clientId?: string,
) {
  const paths = topic.split("/");

  let pathWalked = "";
  paths.forEach((path, index, array) => {
    const id = `${pathWalked}${path}_`;

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
            (source as Node).id === id.replace(path, "+");
          const targetIsClient = (target as Node).isClient;
          return sourceIsWildcard && targetIsClient;
        })
        .forEach(({ target }) => {
          console.log(target);
          pushIfNotExists(links, {
            id: createLinkId(id, (target as Node).id, topic),
            source: findOrCreateNode(id, nodes, path),
            target: findOrCreateNode((target as Node).id, nodes),
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
