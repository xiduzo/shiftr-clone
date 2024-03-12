import { Link, Node } from "./constants";

function getAttr(
  source: string | number | d3.SimulationNodeDatum,
  attr: keyof d3.SimulationNodeDatum = "x",
) {
  if (typeof source === "string") return Number(source);
  if (typeof source === "number") return source;

  return source[attr] ? Number(source[attr]) : 0;
}

export function tick(
  link: d3.Selection<SVGLineElement, Link, SVGElement, undefined>,
  node: d3.Selection<SVGCircleElement, Node, SVGElement, undefined>,
  text: d3.Selection<SVGTextElement, Node, SVGElement, undefined>,
) {
  node
    .attr("cx", ({ x }) => {
      if (Number.isNaN(x)) return 0;
      return x ?? 0;
    })
    .attr("cy", ({ y }) => {
      if (Number.isNaN(y)) return 0;
      return y ?? 0;
    });

  link
    .attr("x1", ({ source }) => getAttr(source, "x"))
    .attr("y1", ({ source }) => getAttr(source, "y"))
    .attr("x2", ({ target }) => getAttr(target, "x"))
    .attr("y2", ({ target }) => getAttr(target, "y"));

  text
    .attr("x", ({ x }) => {
      const horizontal = x ?? 0;
      const horizontalOffset = 12;
      return horizontal < window.innerWidth / 2
        ? horizontal + horizontalOffset
        : horizontal - horizontalOffset;
    })
    .attr("y", ({ y }) => {
      return (y ?? 0) + 5;
    })
    .attr("text-anchor", ({ x }) =>
      (x ?? 0) < window.innerWidth / 2 ? "start" : "end",
    );
}
