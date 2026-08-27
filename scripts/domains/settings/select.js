const instances = new WeakMap();
let activeInstance = null;
let globalListenersBound = false;
let listboxId = 0;

function getOptions(select) {
  return Array.from(select.options).filter((option) => !option.hidden);
}

function close(instance, restoreFocus = false) {
  if (!instance) return;

  instance.wrapper.classList.remove("is-open", "is-open-upward");
  instance.trigger.setAttribute("aria-expanded", "false");
  instance.menu.hidden = true;

  if (activeInstance === instance) {
    activeInstance = null;
  }

  if (restoreFocus) {
    instance.trigger.focus();
  }
}

function focusOption(instance, direction) {
  const options = Array.from(
    instance.menu.querySelectorAll(".mac-select-option:not(:disabled)"),
  );
  if (options.length === 0) return;

  const currentIndex = options.indexOf(document.activeElement);
  const nextIndex = direction === "first"
    ? 0
    : direction === "last"
      ? options.length - 1
      : (currentIndex + direction + options.length) % options.length;
  options[nextIndex].focus();
}

function selectValue(instance, value) {
  if (instance.select.value !== value) {
    instance.select.value = value;
    instance.select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  syncMacSelect(instance.select);
  close(instance, true);
}

function renderOptions(instance) {
  const selectedValue = instance.select.value;
  const options = getOptions(instance.select);

  instance.menu.replaceChildren(
    ...options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mac-select-option";
      button.dataset.value = option.value;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.value === selectedValue));
      button.disabled = option.disabled;
      button.tabIndex = -1;
      button.textContent = option.textContent.trim();
      button.classList.toggle("is-selected", option.value === selectedValue);
      return button;
    }),
  );
}

function open(instance) {
  if (instance.select.disabled) return;
  if (activeInstance && activeInstance !== instance) close(activeInstance);

  renderOptions(instance);
  instance.menu.hidden = false;

  const scrollContainer = instance.wrapper.closest(".mac-content-body");
  if (scrollContainer) {
    const menuHeight = Math.min(instance.menu.scrollHeight, 240);
    const triggerRect = instance.trigger.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const below = containerRect.bottom - triggerRect.bottom;
    const above = triggerRect.top - containerRect.top;
    instance.wrapper.classList.toggle(
      "is-open-upward",
      below < menuHeight && above > below,
    );
  }

  instance.wrapper.classList.add("is-open");
  instance.trigger.setAttribute("aria-expanded", "true");
  activeInstance = instance;
}

function bindGlobalListeners() {
  if (globalListenersBound) return;
  globalListenersBound = true;

  document.addEventListener("pointerdown", (event) => {
    if (activeInstance && !activeInstance.wrapper.contains(event.target)) {
      close(activeInstance);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeInstance) {
      event.preventDefault();
      close(activeInstance, true);
    }
  });
}

function createInstance(select) {
  const wrapper = select.closest(".mac-select");
  if (!wrapper) return null;

  const label = wrapper
    .closest(".mac-settings-row")
    ?.querySelector(".mac-settings-row-title")
    ?.textContent.trim();
  const trigger = document.createElement("button");
  const value = document.createElement("span");
  const arrow = document.createElement("span");
  const menu = document.createElement("div");

  trigger.type = "button";
  trigger.className = "mac-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (label) trigger.setAttribute("aria-label", label);

  value.className = "mac-select-value";
  arrow.className = "mac-select-chevron";
  arrow.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>';
  trigger.append(value, arrow);

  menu.className = "mac-select-menu";
  menu.id = `macSelectMenu${++listboxId}`;
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  trigger.setAttribute("aria-controls", menu.id);

  wrapper.querySelector(".mac-select-arrow")?.classList.add("hidden");
  select.classList.add("is-enhanced");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");
  wrapper.append(trigger, menu);

  const instance = { wrapper, select, trigger, value, menu };
  trigger.addEventListener("click", () => {
    if (activeInstance === instance) {
      close(instance);
    } else {
      open(instance);
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open(instance);
      focusOption(instance, event.key === "ArrowDown" ? "first" : "last");
    }
  });
  menu.addEventListener("click", (event) => {
    const option = event.target.closest(".mac-select-option");
    if (option && !option.disabled) selectValue(instance, option.dataset.value);
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(instance, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusOption(instance, event.key === "Home" ? "first" : "last");
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = event.target.closest(".mac-select-option");
      if (option && !option.disabled) selectValue(instance, option.dataset.value);
    }
  });
  select.addEventListener("change", () => syncMacSelect(select));

  instances.set(select, instance);
  return instance;
}

export function syncMacSelect(select) {
  const instance = instances.get(select);
  if (!instance) return;

  const label = instance.wrapper
    .closest(".mac-settings-row")
    ?.querySelector(".mac-settings-row-title")
    ?.textContent.trim();
  if (label) instance.trigger.setAttribute("aria-label", label);

  const selected = select.selectedOptions[0];
  instance.value.textContent = selected?.textContent.trim() || "";
  instance.trigger.disabled = select.disabled;
  if (select.disabled) close(instance);
  renderOptions(instance);
}

export function enhanceMacSelects(root = document) {
  root.querySelectorAll("select.mac-select-input").forEach((select) => {
    const instance = instances.get(select) || createInstance(select);
    if (instance) syncMacSelect(select);
  });
  bindGlobalListeners();
}
