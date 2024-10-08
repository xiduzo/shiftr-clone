import * as d3 from "d3";
import { MQTT_BROKER_NODE_ID } from "../../../common/constants";
import { MqttNode } from "./types";

export function dragstarted(
  event: d3.D3DragEvent<SVGCircleElement, MqttNode, MqttNode>,
  simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>,
) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

export function dragged(
  event: d3.D3DragEvent<SVGCircleElement, MqttNode, MqttNode>,
) {
  if (event.subject.id === MQTT_BROKER_NODE_ID) return;
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

export function dragended(
  event: d3.D3DragEvent<SVGCircleElement, MqttNode, MqttNode>,
  simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>,
) {
  if (!event.active) simulation.alphaTarget(0);
  event.subject.fx = null;
  event.subject.fy = null;
}
