import { MQTT_BROKER_NODE_ID } from "../../../common/constants";
import { Store } from "../d3/store";
import { updateSvg } from "../d3/svg";
import { type PayloadMessage } from "../mqtt/messaging";

const keyHandlers = new Map<string, Function>();

export function addKeyboardHandler(
  key: string,
  description: string,
  callback: Function,
) {
  keyHandlers.set(key, callback);
  const hotkeys = document.getElementById("hotkeys");
  if (!hotkeys) return;

  const li = document.createElement("li");
  li.ariaLabel = description;
  li.role = "button";
  li.tabIndex = 0;
  li.dataset.trigger = key;
  li.innerHTML = description.replace(key, `<span>${key}</span>`);
  li.onclick = () => callback();
  hotkeys.appendChild(li);
}

function pressElement(element: Element) {
  element.classList.add("active");
  setTimeout(() => element.classList.remove("active"), 100);
}

window.addEventListener("keydown", (event) => {
  const key = event.key?.toLowerCase();

  keyHandlers.get(key)?.();
  const element = document.querySelector(`[data-trigger="${key}"]`);
  if (!element) return;

  pressElement(element);
});

function toggleIgnoreNode(nodeId: string) {
  if (Store.isIngoredNodeId(nodeId)) {
    Store.removeIgnoredNodeId(nodeId);
  } else {
    Store.addIgnoredNodeId(nodeId);
  }

  updateSvg();
}

export function showHiddenNodes() {
  const currentDialog = document.querySelector("dialog");
  if (currentDialog) return;

  const dialog = document.createElement("dialog");
  dialog.id = "hiddenNodes";
  dialog.title = "Hidden nodes";

  const title = document.createElement("h1");
  title.innerHTML = dialog.title;
  dialog.appendChild(title)

  const close = document.createElement("button");
  close.innerHTML = "x";
  close.classList.add("close");
  close.classList.add("secondary");
  dialog.appendChild(close);
  close.onclick = () => dialog.remove();

  const ul = document.createElement("ul");

  const ignoredNodeIds = Store.getIgnoredNodeIds();
  ignoredNodeIds.forEach((nodeId) => {
    const li = document.createElement("li");
    li.innerHTML = nodeId;
    li.onclick = () => {
      toggleIgnoreNode(nodeId);
      li.remove();
      updateSvg();
    };
    ul.appendChild(li);
  });

  dialog.appendChild(ul);

  const section = document.createElement("section");
  section.style.display = "flex";
  section.style.flexDirection = "column";
  section.style.gap = "0.25rem";

  const label = document.createElement("label");
  label.innerHTML = "Node to ignore";
  label.htmlFor = "ignore-node";
  section.appendChild(label);

  const input = document.createElement("input");
  input.id = "ignore-node";
  input.type = "search";
  input.setAttribute('list', 'data-nodes');
  input.placeholder = "/topic/subtopic, clientId, etc...";
  section.appendChild(input);

  dialog.append(section)
  const dataList = document.createElement("datalist");
  dataList.id = "data-nodes";

  const nodes = Store.getNodes();
  nodes.filter(node => node.id !== MQTT_BROKER_NODE_ID).forEach(node => {
    const option = document.createElement("option");
    option.value = node.id;
    dataList.appendChild(option);
  })

  dialog.appendChild(dataList);

  const button = document.createElement("button");
  button.innerHTML = "Ignore node";
  button.classList.add("secondary");
  button.onclick = () => {
    if(input.value === '') return;
    toggleIgnoreNode(input.value);
    const li = document.createElement("li");
    li.innerHTML = input.value;
    li.onclick = () => {
      toggleIgnoreNode(input.value);
      li.remove();
      updateSvg();
    };
    ul.appendChild(li);
    input.value = "";
    updateSvg();
  };
  dialog.appendChild(button);


  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.onclose = () => dialog?.remove();
}

const messages: PayloadMessage[] = [];

const messagesList = document.getElementById("messages");

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
});

export function addReceivedMessage(message: PayloadMessage) {
  messages.push(message);

  if (!messagesList) return;

  const li = document.createElement("li");
  li.innerHTML = `
    <div class="topic">${message.topic} <time datetime="${message.dateTime}">${dateTimeFormatter.format(message.dateTime)}</time></div>
    <div class="clientId">${message.clientId}</div>
    <div class="message">${message.message}</div>
  `;
  setTimeout(() => li.remove(), 15000);
  messagesList.prepend(li);
}
