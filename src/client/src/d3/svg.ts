import * as d3 from "d3";
import { Link, MQTT_BROKER_NODE_ID, Node } from "./constants";
import { runSimulation } from "./simulation";

function addLinkStyles(
  linkSelection: d3.Selection<SVGLineElement, Link, SVGGElement, undefined>,
) {
  linkSelection
    .attr("id", (d) => d.id)
    .attr("class", "link")
    .attr("stroke-opacity", ({ source, target }) => {
      const sourceIsMqttBroker = (source as Node).id === MQTT_BROKER_NODE_ID;
      const isToIoTDevice = (target as Node).isClient;
      const isWildcardTarget = (target as Node).id.includes("_+_");
      const isWildcardSource = (source as Node).id.includes("_+_");
      if (isWildcardTarget || isWildcardSource) return 0.05;
      if (sourceIsMqttBroker && isToIoTDevice) return 0.2;
      if (isToIoTDevice) return 0.5;

      return 1;
    })
    .attr("stroke-dasharray", (d) => {
      const sourceIsMqttBroker = (d.source as Node).id === MQTT_BROKER_NODE_ID;
      const isToIoTDevice = (d.target as Node).isClient;

      if (sourceIsMqttBroker && isToIoTDevice) return "10,5";
      if (isToIoTDevice) return "10,5";

      return "0";
    });
}

function addNodeStyles(
  nodeSelection: d3.Selection<SVGCircleElement, Node, SVGGElement, undefined>,
) {
  nodeSelection
    .attr("id", ({ id }) => id)
    .attr("class", "node")
    .attr("stroke-opacity", ({ isClient, id }) => {
      if (isClient) return 0.5;
      if (id.includes("_+_")) return 0.05;

      return 1;
    })
    .attr("stroke-width", ({ id }) => (id === MQTT_BROKER_NODE_ID ? 4 : 2.5))
    .attr("r", ({ id }) => (id === MQTT_BROKER_NODE_ID ? 20 : 7.5));
}

function addTextStyles(
  textSelection: d3.Selection<SVGTextElement, Node, SVGGElement, undefined>,
) {
  textSelection
    .attr("fill-opacity", ({ isClient, name }) => {
      if (isClient) return 0.5;
      if (name === "+") return 0.05;

      return 1;
      // return isClient ? 0.5 : 1
    })
    .attr("id", ({ id }) => id)
    .text(({ id, name }) => (id === MQTT_BROKER_NODE_ID ? null : name ?? id))
    .attr("class", "text");
}

export function drawSvg(
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
  links: Link[],
  nodes: Node[],
) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.attr("width", width).attr("height", height);

  const link = svg
    .append("g")
    .attr("stroke-width", 1.5)
    .attr("stroke", "#E1F1F6")
    .attr("class", "links")
    .selectAll<SVGLineElement, Link>("g")
    .data(links)
    .join("line");
  addLinkStyles(link);

  const node = svg
    .append("g")
    .attr("stroke", "#E1F1F6")
    .attr("fill", "#193F52")
    .attr("class", "nodes")
    .selectAll<SVGCircleElement, Node>("g")
    .data(nodes)
    .join("circle");
  addNodeStyles(node);

  const text = svg
    .append("g")
    .attr("class", "texts")
    .attr("fill", "#81CBDF")
    .attr("font-family", "Arial, sans-serif")
    .attr("stroke", "#193f52")
    .attr("paint-order", "stroke")
    .attr("stroke-width", 4)
    .selectAll<SVGTextElement, Node>("g")
    .data(nodes)
    .join("text");
  addTextStyles(text);

  svg
    .append("g")
    .attr("class", "packets")
    .attr("fill", "#E1F1F6")
    .append("g")
    .attr("class", "paths")
    .attr("stroke", "none")
    .attr("fill", "none");

  runSimulation(links, nodes, link, node, text);

  const svgNode = svg.node();
  const chart = document.querySelector<HTMLDivElement>("#chart");
  if (!svgNode || !chart) return;

  chart.append(svgNode);
}

export function updateSvg(links: Link[], nodes: Node[]) {
  const linkGroup = d3.select<SVGGElement, undefined>(".links");
  const link = linkGroup
    .selectAll<SVGLineElement, Link>(".links line")
    .data(links);

  const newLinks = link.enter().append("line").merge(link);
  link.exit().remove();
  addLinkStyles(newLinks);

  const nodeGroup = d3.select<SVGGElement, undefined>(".nodes");
  const node = nodeGroup
    .selectAll<SVGCircleElement, Node>(".nodes circle")
    .data(nodes);

  const newNodes = node.enter().append("circle").merge(node);
  node.exit().remove();
  addNodeStyles(newNodes);

  const textGroup = d3.select<SVGGElement, undefined>(".texts");
  const text = textGroup
    .selectAll<SVGTextElement, Node>(".texts text")
    .data(nodes, (d) => d.id);

  const newTexts = text.enter().append("text").merge(text);
  text.exit().remove();
  addTextStyles(newTexts);

  runSimulation(links, nodes, newLinks, newNodes, newTexts);
}
