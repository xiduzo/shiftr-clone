import { Store } from "../d3/store";
import { updateSvg } from "../d3/svg";
import { MqttNode } from "../d3/types";

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
  const key = event.key.toLowerCase();

  switch (key) {
    case "enter":
      const activeElement = document.activeElement;
      if (!activeElement) return;

      const trigger =
        activeElement?.attributes.getNamedItem("data-trigger")?.value;
      if (!trigger) return;

      keyHandlers.get(trigger)?.();
      pressElement(activeElement);
      break;
    case "h":
    case "u":
      const dialog = document.querySelector("dialog");
      console.log(dialog);
      if (!dialog) {
        return;
      }
      toggleIgnoreNode(dialog.id);
      break;
    default:
      keyHandlers.get(key)?.();
      const element = document.querySelector(`[data-trigger="${key}"]`);
      if (!element) return;

      pressElement(element);
      break;
  }
});

function toggleIgnoreNode(nodeId: string) {
  const dialog = document.querySelector("dialog");

  if (Store.isIngoredNodeId(nodeId)) {
    Store.removeIgnoredNodeId(nodeId);
  } else {
    Store.addIgnoredNodeId(nodeId);
  }

  updateSvg();
  console.log(dialog);
  dialog?.close();
  dialog?.remove();
}

export function showNodePopup(_event: PointerEvent, node: MqttNode) {
  let topic = node.id.replace(/_SLASH_/g, "/");

  const dialog = document.createElement("dialog");
  dialog.id = node.id;

  const ignore = document.createElement("button");
  ignore.innerHTML = Store.isIngoredNodeId(node.id)
    ? `<u>U</u>n-hide ${topic}`
    : `<u>H</u>ide ${topic}`;
  ignore.onclick = () => {
    toggleIgnoreNode(node.id);
  };

  dialog.appendChild(ignore);

  document.body.appendChild(dialog);
  dialog.showModal();
  dialog.onclose = () => dialog.remove();
}
