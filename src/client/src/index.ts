import * as d3 from "d3";
import { showLove } from "../../common/madeWithLove";
import { animate } from "./d3/animation";
import { drawSvg, updateSvg } from "./d3/svg";
import { initClient } from "./mqtt";
import { fetchConnections } from "./mqtt/connections";
import { addKeyboardHandler, showHiddenNodes } from "./ui";

document.querySelector("#host")!.innerHTML = window.location.host;

const svg = d3.create("svg");

requestAnimationFrame(animate);
drawSvg(svg);

initClient().finally(fetchConnections);

addKeyboardHandler("c", "clear graph", fetchConnections);
addKeyboardHandler("r", "reload page", () => window.location.reload());
addKeyboardHandler("h", "hidden nodes", () => showHiddenNodes());

d3.select(window).on("resize", () => {
  svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  updateSvg();
});

showLove();
