import { SimulationLink, SimulationNode } from "./types";
import * as d3 from "d3";
import { dragended, dragged, dragstarted } from "./dragHandlers";
import { tick } from "./tick";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";

const simulation = d3
  .forceSimulation()
  .force(
    "link",
    d3.forceLink().id((d) => (d as SimulationNode).id),
  )
  .force("charge", d3.forceManyBody())
  .force("node", d3.forceCollide(2));

export function runSimulation(
  links: SimulationLink[],
  nodes: SimulationNode[],
  link: d3.Selection<SVGLineElement, SimulationLink, SVGElement, undefined>,
  node: d3.Selection<SVGCircleElement, SimulationNode, SVGElement, undefined>,
  text: d3.Selection<SVGTextElement, SimulationNode, SVGElement, undefined>,
) {
  // Update simulation's links and nodes
  simulation.nodes(nodes);
  simulation.force(
    "link",
    d3
      .forceLink(links)
      .distance((link) => {
        const source = link.source as SimulationNode;
        const target = link.target as SimulationNode;
        const sourceIsMqttBroker = source.id === MQTT_BROKER_NODE_ID;
        const isToIoTDevice = target.isClient;

        const base = Math.min(window.innerHeight, window.innerWidth) / 2.25;
        if (sourceIsMqttBroker && isToIoTDevice) return base;
        if (sourceIsMqttBroker || isToIoTDevice) return base / 3;
        const path = link.topic?.split("/") ?? [];
        return base / (path.length + 1);
      })
      .id((d) => (d as SimulationNode).id),
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
