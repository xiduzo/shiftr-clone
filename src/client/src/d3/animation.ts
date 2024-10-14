import * as d3 from "d3";
import { MqttNode } from "./types";
import { getNodePosition } from "./utils";

const packetSpawns = new Map<string, boolean>();
const movingPackets = new Map<string, boolean>();

export const animations = new Map<string, string[]>();
export const animationCallbacks = new Map<string, () => void>();

export async function animate() {
  const currentAnimations = Object.entries(Object.fromEntries(animations))
    .filter(([id]) => !movingPackets.get(id))
    .map(([id, steps]) => {
      movingPackets.set(id, true);
      const [current, ...rest] = steps;

      const isSpawningOfPacket = packetSpawns.get(id) ?? true;
      rest.length ? packetSpawns.set(id, false) : packetSpawns.delete(id);

      const position = getNodePosition(current);

      return { ...position, id, isSpawningOfPacket };
    });

  const packetGroup = d3.select<SVGGElement, unknown>(".packets");
  const packet = packetGroup
    .selectAll<SVGCircleElement, MqttNode>(".packet")
    .data(currentAnimations, ({ id }: MqttNode) => id);

  const newPackets = packet.enter().append("circle").merge(packet);

  newPackets
    .attr("id", ({ id }) => id)
    .attr("class", "packet")
    .attr("r", 7)
    .attr("fill-opacity", ({ isSpawningOfPacket }) => (isSpawningOfPacket ? 0 : 1))
    .transition(d3.easeElasticInOut.toString())
    .duration(({ isSpawningOfPacket }) => (isSpawningOfPacket ? 0 : 450))
    .attr("cx", ({ x }) => x)
    .attr("cy", ({ y }) => y)
    .on("end", function ({ id }) {
      const [_current, ...rest] = animations.get(id) ?? [];
      rest.length ? animations.set(id, rest) : animations.delete(id);
      movingPackets.delete(id);
      if (rest.length) return;
      animationCallbacks.get(id)?.();
      animationCallbacks.delete(id);
      d3.select(this).remove();
    });

  requestAnimationFrame(animate);
}
