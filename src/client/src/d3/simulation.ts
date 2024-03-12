import { Link, MQTT_BROKER_CENTER, Node } from "./constants";
import * as d3 from "d3";
import { dragended, dragged, dragstarted } from "./dragHandlers";
import { tick } from "./tick";

export function addSimulation(
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
  links: Link[],
  nodes: Node[],
) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const link = d3.selectAll<SVGLineElement, Link>(".links line").data(links);
  const node = d3
    .selectAll<SVGCircleElement, Node>(".nodes circle")
    .data(nodes);
  const text = d3.selectAll<SVGTextElement, Node>(".texts text").data(nodes);

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .distance((link) => {
          const sourceIsMqttBroker =
            (link.source as Node).id === MQTT_BROKER_CENTER;
          const isToIoTDevice = (link.target as Node).isClient;

          if (sourceIsMqttBroker && isToIoTDevice) return 500;
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
