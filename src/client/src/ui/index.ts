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
    default:
      keyHandlers.get(key)?.();
      const element = document.querySelector(`[data-trigger="${key}"]`);
      if (!element) return;

      pressElement(element);
      break;
  }
});
