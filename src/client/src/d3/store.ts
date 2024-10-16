import { MQTT_BROKER_NODE_ID } from "../../../common/constants";
import { pushIfNotExists } from "../array";
import { MqttEdge, MqttNode } from "./types";
import { getRandomCoordinatesOnCircle } from "./utils";

let globalNodes: MqttNode[] = [
  {
    id: MQTT_BROKER_NODE_ID,
    name: "MQTT Broker",
    ...getRandomCoordinatesOnCircle(),
  },
];
let globalEdges: MqttEdge[] = [];
const localIgnoredNodeIds = localStorage.getItem("ignoredNodeIds");
let globalIgnoredNodeIds: Set<string> = new Set(JSON.parse(localIgnoredNodeIds ?? "[]"));

export class Store {
  static getNodes(includeIgnored = true) {
    if(includeIgnored) {
      return globalNodes;
    }

    return globalNodes.filter(node => {
      return !Store.isIngoredNodeId(node.id);
    });
  }

  static getEdges(includeIgnored = true) {
    if(includeIgnored) {
      return globalEdges;
    }

    return globalEdges.filter(edge => {
      const sourceId = (edge.source as MqttNode).id;
      const targetId = (edge.target as MqttNode).id;

      return !Store.isIngoredNodeId(sourceId) && !Store.isIngoredNodeId(targetId);
    });
  }

  static addNode(node: MqttNode) {
    return pushIfNotExists(globalNodes, node);
  }

  static addEdge(edge: MqttEdge) {
    return pushIfNotExists(globalEdges, edge);
  }

  static updateStore(nodes: MqttNode[], edges: MqttEdge[]) {
    globalNodes = nodes;
    globalEdges = edges;
  }

  static setNodes(nodes: MqttNode[]) {
    globalNodes = nodes;
  }

  static setEdges(edges: MqttEdge[]) {
    globalEdges = edges;
  }

  static addIgnoredNodeId(id: string) {
    globalIgnoredNodeIds.add(id);
    localStorage.setItem("ignoredNodeIds", JSON.stringify(Array.from(globalIgnoredNodeIds)));
  }

  static removeIgnoredNodeId(id: string) {
    globalIgnoredNodeIds.delete(id);
    localStorage.setItem("ignoredNodeIds", JSON.stringify(Array.from(globalIgnoredNodeIds)));
  }

  static isIngoredNodeId(id: string) {
    // Should ignore if the id is the start id of any item in the ignore list
    return Array.from(globalIgnoredNodeIds).some((ignoredId) =>
      id.startsWith(ignoredId),
    );
  }

  static getIgnoredNodeIds() {
    return Array.from(globalIgnoredNodeIds);
  }
}
