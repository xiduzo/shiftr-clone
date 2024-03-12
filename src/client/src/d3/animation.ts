export const animations = new Map<string, Array<{ x: number; y: number }>>();
export const animationCallbacks = new Map<string, () => void>();

import * as d3 from "d3";
import { Node } from "./constants";

const firstTime = new Map<string, boolean>();
export async function animate(
  _time: number,
  svg: d3.Selection<SVGSVGElement, undefined, null, undefined>,
) {
  const currentAnimations = Object.entries(Object.fromEntries(animations)).map(
    ([id, steps]) => {
      const [current, ...rest] = steps;

      const isFirst = firstTime.get(id) ?? true;

      if (rest.length) {
        animations.set(id, rest);
        firstTime.set(id, false);
      } else {
        animations.delete(id);
        firstTime.delete(id);
      }

      return { ...current, id, isFirst, isLast: !rest.length };
    },
  );

  const packetGroup = svg.select<SVGGElement>(".packets");
  const packet = packetGroup
    .selectAll<SVGCircleElement, Node>(".packet")
    .data(currentAnimations, ({ id }: Node) => id);

  const animationDuration = 600;
  const newPackets = packet.enter().append("circle").merge(packet);
  newPackets
    .attr("id", ({ id }) => id)
    .attr("class", "packet")
    .attr("r", 7)
    .transition(d3.easeElasticInOut.toString())
    .duration(({ isFirst }) => (isFirst ? 0 : animationDuration))
    .attr("cx", ({ x }) => x)
    .attr("cy", ({ y }) => y)
    .on("end", function ({ id, isLast }) {
      if (!isLast) return;
      animationCallbacks.get(id)?.();
      d3.select(this).remove();
    });

  requestAnimationFrame((time) => animate(time, svg));
}
