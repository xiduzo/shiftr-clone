import { Link, MQTT_BROKER_NODE_ID, Node } from "./constants";
import * as d3 from "d3";
import { dragended, dragged, dragstarted } from "./dragHandlers";
import { tick } from "./tick";

export function getCenter() {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
}

export function addSimulation(
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
  links: Link[],
  nodes: Node[],
  link: d3.Selection<SVGLineElement, Link, SVGElement, undefined>,
  node: d3.Selection<SVGCircleElement, Node, SVGElement, undefined>,
  text: d3.Selection<SVGTextElement, Node, SVGElement, undefined>,
) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .distance((link) => {
          const sourceIsMqttBroker =
            (link.source as Node).id === MQTT_BROKER_NODE_ID;
          const isToIoTDevice = (link.target as Node).isClient;

          if (sourceIsMqttBroker && isToIoTDevice) return 350;
          if (sourceIsMqttBroker || isToIoTDevice) return 175;
          return 100;
        })
        .id((d) => (d as Node).id),
    )
    .force("charge", d3.forceManyBody())
    .force("node", d3.forceCollide(15))
    .on("tick", () => {
      nodes[0].x = width / 2;
      nodes[0].y = height / 2;
      tick(link, node, text);
    });

  (node as any as d3.Selection<Element, any, any, any>).call(
    d3
      .drag()
      .on("start", (event) => dragstarted(event, simulation))
      .on("drag", dragged)
      .on("end", (event) => dragended(event, simulation)),
  );

  window.addEventListener("resize", () => {
    nodes[0].x = window.innerWidth / 2;
    nodes[0].y = window.innerHeight / 2;
    tick(link, node, text);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  });
}
