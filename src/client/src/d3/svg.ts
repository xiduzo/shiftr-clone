import * as d3 from "d3";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";
import { runSimulation } from "./simulation";
import { Store } from "./store";
import { MqttEdge, MqttNode } from "./types";

enum Opacity {
  Full = 1,
  Shallow = 0.5,
  Ghost = 0.2,
}

function addEdgeStyles(
  edgeSelection: d3.Selection<SVGLineElement, MqttEdge, SVGGElement, undefined>,
) {
  edgeSelection
    .attr("id", (d) => d.id)
    .attr("class", "link")
    .attr("stroke-opacity", ({ source, target }) => {
      const sourceNode = source as MqttNode;
      const targetNode = target as MqttNode;

      const sourceIsMqttBroker = sourceNode.id === MQTT_BROKER_NODE_ID;
      const isToClient = targetNode.isClient;

      if (sourceIsMqttBroker && isToClient) return Opacity.Ghost;
      if (isToClient) return Opacity.Shallow;

      return Opacity.Full;
    })
    .attr("stroke-dasharray", (d) => {
      const toClient = (d.target as MqttNode).isClient;

      if (toClient) return "10,5";

      return "0";
    });
}

function addNodeStyles(
  nodeSelection: d3.Selection<
    SVGCircleElement,
    MqttNode,
    SVGGElement,
    undefined
  >,
) {
  nodeSelection
    .attr("data-topic", ({ id }) => id)
    .attr("class", "node")
    .attr("stroke-opacity", ({ isClient }) => {
      if (isClient) return Opacity.Shallow;

      return Opacity.Full;
    })
    .attr("stroke-width", ({ id }) => (id === MQTT_BROKER_NODE_ID ? 4 : 2.5))
    .attr("r", ({ id }) => (id === MQTT_BROKER_NODE_ID ? 20 : 7.5));
}

function addLabelStyles(
  labelSelection: d3.Selection<
    SVGTextElement,
    MqttNode,
    SVGGElement,
    undefined
  >,
) {
  labelSelection
    .attr("fill-opacity", ({ isClient }) => {
      if (isClient) return Opacity.Shallow;

      return Opacity.Full;
    })
    .attr("id", ({ id }) => id)
    .text(({ id, name }) => (id === MQTT_BROKER_NODE_ID ? null : (name ?? id)))
    .attr("class", "label");
}

export function drawSvg(
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
) {
  const edges = Store.getEdges(false);
  const nodes = Store.getNodes(false);

  const style = getComputedStyle(document.documentElement);
  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.attr("width", width).attr("height", height);

  const svgContent = svg.append("g");
  svgContent.attr("class", "content");

  const link = svgContent
    .append("g")
    .attr("stroke-width", 1.5)
    .attr("stroke", style.getPropertyValue("--color-secondary-lightest"))
    .attr("id", "links")
    .selectAll<SVGLineElement, MqttEdge>("g")
    .data(edges)
    .join("line");
  addEdgeStyles(link);

  const node = svgContent
    .append("g")
    .attr("stroke", style.getPropertyValue("--color-secondary-lightest"))
    .attr("fill", style.getPropertyValue("--color-primary"))
    .attr("id", "nodes")
    .selectAll<SVGCircleElement, MqttNode>("g")
    .data(nodes)
    .join("circle");
  addNodeStyles(node);

  const text = svgContent
    .append("g")
    .attr("id", "labels")
    .attr("fill", style.getPropertyValue("--color-secondary"))
    .attr("font-family", "Arial, sans-serif")
    .attr("font-size", 16)
    .attr("stroke", style.getPropertyValue("--color-primary"))
    .attr("paint-order", "stroke")
    .attr("stroke-width", 4)
    .selectAll<SVGTextElement, MqttNode>("g")
    .data(nodes)
    .join("text");
  addLabelStyles(text);

  svgContent
    .append("g")
    .attr("class", "packets")
    .attr("fill", style.getPropertyValue("--color-secondary-lightest"));

  runSimulation(link, node, text);

  // TODO: fix translate after viewport resize
  const zoom = d3
    .zoom<SVGSVGElement, undefined>()
    .scaleExtent([0.5, 2]) // Set the zoom scale extent
    .on("zoom", ({ transform }) => {
      const scale = transform.k;

      // Calculate the center of the viewport
      const viewportCenterX = width / 2;
      const viewportCenterY = height / 2;

      // Calculate the center of the svgContent based on the current zoom scale
      const contentCenterX = (width / 2) * scale;
      const contentCenterY = (height / 2) * scale;

      // Calculate the translation to keep the svgContent centered
      const translateX = viewportCenterX - contentCenterX;
      const translateY = viewportCenterY - contentCenterY;

      // Apply the transformation
      svgContent.attr(
        "transform",
        `translate(${translateX}, ${translateY}) scale(${scale})`,
      );
    });

  svg.call(zoom);

  const svgNode = svg.node();
  const chart = document.querySelector<HTMLDivElement>("#chart");
  if (!svgNode || !chart) return;

  chart.append(svgNode);
}

export function updateSvg() {
  const edges = Store.getEdges(false);
  const nodes = Store.getNodes(false);

  const linkGroup = d3.select<SVGGElement, undefined>("#links");
  const link = linkGroup
    .selectAll<SVGLineElement, MqttEdge>("#links line")
    .data(edges);

  const newLinks = link.enter().append("line").merge(link);
  link.exit().remove();
  addEdgeStyles(newLinks);

  const nodeGroup = d3.select<SVGGElement, undefined>("#nodes");
  const node = nodeGroup
    .selectAll<SVGCircleElement, MqttNode>("#nodes circle")
    .data(nodes);

  const newNodes = node.enter().append("circle").merge(node);
  node.exit().remove();
  addNodeStyles(newNodes);

  const labelGroup = d3.select<SVGGElement, undefined>("#labels");
  const text = labelGroup
    .selectAll<SVGTextElement, MqttNode>("#labels text")
    .data(nodes, (d) => d.id);

  const newTexts = text.enter().append("text").merge(text);
  text.exit().remove();
  addLabelStyles(newTexts);

  runSimulation(newLinks, newNodes, newTexts);
}
