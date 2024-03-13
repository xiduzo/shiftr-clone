export const animations = new Map<string, string[]>();
export const animationCallbacks = new Map<string, () => void>();

import * as d3 from "d3";
import { SimulationNode } from "./types";
import { getNodePosition } from "./utils";

const firstTime = new Map<string, boolean>();
const activeAnimations = new Map<string, boolean>();
export async function animate(
  _time: number,
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>
) {
  const currentAnimations = Object.entries(Object.fromEntries(animations))
    .filter(([id]) => !activeAnimations.get(id))
    .map(([id, steps]) => {
      const [current, ...rest] = steps;

      const isFirst = firstTime.get(id) ?? true;
      rest.length ? firstTime.set(id, false) : firstTime.delete(id);

      const position = getNodePosition(current);
      activeAnimations.set(id, true);
      return { ...position, id, isFirst };
    });

  const packetGroup = svg.select<SVGGElement>(".packets");
  const packet = packetGroup
    .selectAll<SVGCircleElement, SimulationNode>(".packet")
    .data(currentAnimations, ({ id }: SimulationNode) => id);

  const newPackets = packet.enter().append("circle").merge(packet);
  newPackets
    .attr("id", ({ id }) => id)
    .attr("class", "packet")
    .attr("r", 7)
    .transition(d3.easeElasticInOut.toString())
    .duration(({ isFirst }) => (isFirst ? 0 : 450))
    .attr("cx", ({ x }) => x)
    .attr("cy", ({ y }) => y)
    .on("end", function ({ id }) {
      const [_current, ...rest] = animations.get(id) ?? [];
      rest.length ? animations.set(id, rest) : animations.delete(id);
      activeAnimations.delete(id);
      if (rest.length) return;
      animationCallbacks.get(id)?.();
      animations.delete(id);
      d3.select(this).remove();
    });

  requestAnimationFrame((time) => animate(time, svg));
}
