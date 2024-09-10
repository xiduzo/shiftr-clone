import * as d3 from "d3";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";
import { dragended, dragged, dragstarted } from "./dragHandlers";
import { tick } from "./tick";
import { MqttEdge, MqttNode } from "./types";

const simulation = d3
  .forceSimulation()
  .force(
    "link",
    d3.forceLink().id((d) => (d as MqttNode).id),
  )
  .force("charge", d3.forceManyBody())
  .force("node", d3.forceCollide(2));

export function runSimulation(
  links: MqttEdge[],
  nodes: MqttNode[],
  link: d3.Selection<SVGLineElement, MqttEdge, SVGElement, undefined>,
  node: d3.Selection<SVGCircleElement, MqttNode, SVGElement, undefined>,
  text: d3.Selection<SVGTextElement, MqttNode, SVGElement, undefined>,
) {
  // Update simulation's links and nodes
  simulation.nodes(nodes);
  simulation.force(
    "link",
    d3
      .forceLink(links)
      .distance((link) => {
        const source = link.source as MqttNode;
        const target = link.target as MqttNode;
        const sourceIsMqttBroker = source.id === MQTT_BROKER_NODE_ID;
        const isToIoTDevice = target.isClient;

        const base = Math.min(window.innerHeight, window.innerWidth) / 2.25;
        if (sourceIsMqttBroker && isToIoTDevice) return base;
        if (sourceIsMqttBroker || isToIoTDevice) return base / 3;
        const path = link.topic?.split("/") ?? [];
        return base / (path.length + 1);
      })
      .id((d) => (d as MqttNode).id),
  );

  // Start the simulation
  simulation.alpha(1).restart();

  simulation.on("tick", () => {
    nodes[0].x = window.innerWidth / 2;
    nodes[0].y = window.innerHeight / 2;
    tick(link, node, text);
  });

  const typedNode = node as any as d3.Selection<Element, any, any, any>;
  typedNode.on(".drag", null).call(
    d3
      .drag()
      .on("start", (event) => dragstarted(event, simulation))
      .on("drag", dragged)
      .on("end", (event) => dragended(event, simulation)),
  );
}
