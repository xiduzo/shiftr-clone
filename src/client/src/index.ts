import { MqttClient } from "../../common/MqttClient";
import * as d3 from "d3";
import { drawSvg, updateSvg } from "./d3/svg";
import { CLIENT_ID_PREFIX, Link, Node } from "./d3/constants";

const svg = d3.create("svg");
const MQTT_BROKER_NODE_ID = "MQTT_BROKER_CENTER";
let nodes: Node[] = [
  {
    id: MQTT_BROKER_NODE_ID,
    name: "MQTT Broker",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  },
];
let links: Link[] = [];

function pushIfNotExists<T extends { id: string }>(array: T[], item: T) {
  if (array.find((x) => x.id === item.id)) return item;
  array.push(item);
  return item;
}

function findOrCreateNode(id: string, name?: string) {
  const item = nodes.find((node) => node.id === id);

  return (
    item ??
    pushIfNotExists(nodes, {
      id,
      name,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
  );
}

function createLinkId(source: string, target: string, topic: string) {
  return `FROM_${source}_TO_${target}_ON_${topic}`;
}

function createClientNodeIfNotExist(clientId: string) {
  pushIfNotExists(nodes, {
    id: clientId.replace("/", "_"), // to avoid d3 crash with topics and clients with same id
    name: clientId,
    isClient: true,
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
}

function getNodePosition(nodeId: string) {
  const node = d3.select(`.node#${nodeId}`);

  if (!node) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  const x = +node.attr("cx");
  const y = +node.attr("cy");

  return { x, y };
}

function createPathNodesIfNotExist(topic: string, clientId?: string) {
  const paths = topic.split("/");

  let pathWalked = "";
  paths.forEach((path, index, array) => {
    const id = `${pathWalked}${path}/`;

    if (index === 0) {
      pushIfNotExists(links, {
        id: createLinkId(MQTT_BROKER_NODE_ID, path, topic),
        source: findOrCreateNode(MQTT_BROKER_NODE_ID),
        target: findOrCreateNode(id, path),
      });
    }

    if (index > 0) {
      pushIfNotExists(links, {
        id: createLinkId(path, array.at(-1)!, topic),
        source: findOrCreateNode(id, path),
        target: findOrCreateNode(pathWalked),
      });
    }

    if (index === array.length - 1 && clientId) {
      pushIfNotExists(links, {
        id: createLinkId(path, clientId, topic),
        source: findOrCreateNode(id, path),
        target: findOrCreateNode(clientId),
      });
    }

    pathWalked = id;
  });
}

function generateUUID(): string {
  const pattern: string = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return pattern.replace(/[xy]/g, function (c) {
    const r: number = (Math.random() * 16) | 0;
    const v: number = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const animations = new Map<string, Array<{ x: number; y: number }>>();
const firstTime = new Map<string, boolean>();
async function animate() {
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
    .data(currentAnimations, ({ id }) => id);

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
    .on("end", function ({ isLast }) {
      if (!isLast) return;
      d3.select(this).remove();
    });

  requestAnimationFrame(animate);
}

const handleMessage = (topic: string, message: Buffer | Uint8Array) => {
  switch (topic) {
    case "$CONNECTIONS/disconnect":
      const disconnectedClientId = JSON.parse(message.toString());
      if (disconnectedClientId.includes(CLIENT_ID_PREFIX)) return;

      nodes = nodes.filter((node) => node.id !== disconnectedClientId);
      links = links.filter(
        (link) =>
          (link.source as Link).id !== disconnectedClientId &&
          (link.target as Link).id !== disconnectedClientId,
      );
      break;
    case "$CONNECTIONS/connect":
      const connectedClientId = JSON.parse(message.toString());
      if (connectedClientId.includes(CLIENT_ID_PREFIX)) return;
      createClientNodeIfNotExist(connectedClientId);
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_NODE_ID}_${connectedClientId}`,
        source: findOrCreateNode(MQTT_BROKER_NODE_ID),
        target: findOrCreateNode(connectedClientId),
      });
      break;
    case "$CONNECTIONS/subscribe":
      const subscription = JSON.parse(message.toString());
      if (subscription.clientId.includes(CLIENT_ID_PREFIX)) return;
      createPathNodesIfNotExist(subscription.topic, subscription.clientId);
      break;
    case "$CONNECTIONS/unsubscribe":
      const unsubscription = JSON.parse(message.toString());
      if (unsubscription.clientId.includes(CLIENT_ID_PREFIX)) return;
      links = links.filter((link) => {
        const { clientId, topic } = unsubscription;
        const path = topic.split("/");

        const expectedToRemove = createLinkId(path.at(-1), clientId, topic);
        return link.id !== expectedToRemove;
      });
      break;
    case "$CONNECTIONS/publish":
      const publish = JSON.parse(message.toString());
      const { clientId, topic } = publish;
      console.log("publish", publish);
      createClientNodeIfNotExist(clientId);
      createPathNodesIfNotExist(topic, clientId);
      // TODO: animate from publisher to broker center
      const publisher = getNodePosition(clientId);
      const broker = getNodePosition(MQTT_BROKER_NODE_ID);

      animations.set(generateUUID(), [publisher, broker]);

      // TODO: animate to all subscribers
      break;
    default:
      console.log("default", topic, message);
      break;
  }
  updateSvg(svg, links, nodes);
};

const client = new MqttClient("ws://127.0.0.1:9001", {
  username: "username",
  password: "password",
});
client.on("message", handleMessage);

fetch("http://127.0.0.1:8080")
  .then((res) => res.json())
  .then(async (data: { [key: string]: string[] }) => {
    Object.entries(data).forEach(([clientId, topics]) => {
      if (clientId.includes(CLIENT_ID_PREFIX)) return;
      createClientNodeIfNotExist(clientId);
      pushIfNotExists(links, {
        id: `${MQTT_BROKER_NODE_ID}_${clientId}`,
        source: findOrCreateNode(MQTT_BROKER_NODE_ID),
        target: findOrCreateNode(clientId),
      });
      topics.forEach((topic) => createPathNodesIfNotExist(topic, clientId));
      requestAnimationFrame(animate);
    });

    drawSvg(svg, links, nodes);
    await client.subscribeAsync("$CONNECTIONS/#");
  });
