import * as d3 from "d3";
import { SimulationLink, SimulationNode } from "./types";
import { runSimulation } from "./simulation";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";

function addLinkStyles(
  linkSelection: d3.Selection<
    SVGLineElement,
    SimulationLink,
    SVGGElement,
    undefined
  >,
) {
  linkSelection
    .attr("id", (d) => d.id)
    .attr("class", "link")
    .attr("stroke-opacity", ({ source, target }) => {
      const sourceNode = source as SimulationNode;
      const sourceIsMqttBroker = sourceNode.id === MQTT_BROKER_NODE_ID;
      const isToClient = (target as SimulationNode).isClient;

      if (sourceIsMqttBroker && isToClient) return 0.1;
      if (isToClient) return 0.5;

      return 1;
    })
    .attr("stroke-dasharray", (d) => {
      const toClient = (d.target as SimulationNode).isClient;

      if (toClient) return "10,5";

      return "0";
    });
}

function addNodeStyles(
  nodeSelection: d3.Selection<
    SVGCircleElement,
    SimulationNode,
    SVGGElement,
    undefined
  >,
) {
  nodeSelection
    .attr("id", ({ id }) => id)
    .attr("class", "node")
    .attr("stroke-opacity", ({ isClient }) => {
      if (isClient) return 0.5;

      return 1;
    })
    .attr("stroke-width", ({ id }) => (id === MQTT_BROKER_NODE_ID ? 4 : 2.5))
    .attr("r", ({ id }) => (id === MQTT_BROKER_NODE_ID ? 20 : 7.5));
}

function addLabelStyles(
  labelSelection: d3.Selection<
    SVGTextElement,
    SimulationNode,
    SVGGElement,
    undefined
  >,
) {
  labelSelection
    .attr("fill-opacity", ({ isClient }) => {
      if (isClient) return 0.5;

      return 1;
    })
    .attr("id", ({ id }) => id)
    .text(({ id, name }) => (id === MQTT_BROKER_NODE_ID ? null : name ?? id))
    .attr("class", "label");
}

export function drawSvg(
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
  links: SimulationLink[],
  nodes: SimulationNode[],
) {
  const style = getComputedStyle(document.documentElement);
  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.attr("width", width).attr("height", height);

  const link = svg
    .append("g")
    .attr("stroke-width", 1.5)
    .attr("stroke", style.getPropertyValue("--color-secondary-lightest"))
    .attr("id", "links")
    .selectAll<SVGLineElement, SimulationLink>("g")
    .data(links)
    .join("line");
  addLinkStyles(link);

  const node = svg
    .append("g")
    .attr("stroke", style.getPropertyValue("--color-secondary-lightest"))
    .attr("fill", style.getPropertyValue("--color-primary"))
    .attr("id", "nodes")
    .selectAll<SVGCircleElement, SimulationNode>("g")
    .data(nodes)
    .join("circle");
  addNodeStyles(node);

  const text = svg
    .append("g")
    .attr("id", "labels")
    .attr("fill", style.getPropertyValue("--color-secondary"))
    .attr("font-family", "Arial, sans-serif")
    .attr("font-size", 16)
    .attr("stroke", style.getPropertyValue("--color-primary"))
    .attr("paint-order", "stroke")
    .attr("stroke-width", 4)
    .selectAll<SVGTextElement, SimulationNode>("g")
    .data(nodes)
    .join("text");
  addLabelStyles(text);

  svg
    .append("g")
    .attr("class", "packets")
    .attr("fill", style.getPropertyValue("--color-secondary-lightest"));

  runSimulation(links, nodes, link, node, text);

  const svgNode = svg.node();
  const chart = document.querySelector<HTMLDivElement>("#chart");
  if (!svgNode || !chart) return;

  chart.append(svgNode);
}

export function updateSvg(links: SimulationLink[], nodes: SimulationNode[]) {
  const linkGroup = d3.select<SVGGElement, undefined>("#links");
  const link = linkGroup
    .selectAll<SVGLineElement, SimulationLink>("#links line")
    .data(links);

  const newLinks = link.enter().append("line").merge(link);
  link.exit().remove();
  addLinkStyles(newLinks);

  const nodeGroup = d3.select<SVGGElement, undefined>("#nodes");
  const node = nodeGroup
    .selectAll<SVGCircleElement, SimulationNode>("#nodes circle")
    .data(nodes);

  const newNodes = node.enter().append("circle").merge(node);
  node.exit().remove();
  addNodeStyles(newNodes);

  const labelGroup = d3.select<SVGGElement, undefined>("#labels");
  const text = labelGroup
    .selectAll<SVGTextElement, SimulationNode>("#labels text")
    .data(nodes, (d) => d.id);

  const newTexts = text.enter().append("text").merge(text);
  text.exit().remove();
  addLabelStyles(newTexts);

  runSimulation(links, nodes, newLinks, newNodes, newTexts);
}
