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

export class Store {
  static getNodes() {
    return globalNodes;
  }

  static getEdges() {
    return globalEdges;
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
}
