import { t } from "../../platform/i18n.js";
import { backgroundSystem } from "../backgrounds/controller.js";
import { toast } from "../../shared/toast.js";
import {
  SYNC_SETTINGS_DEFAULTS,
  createBackgroundSettingsDefaults,
  getSyncSettings,
} from "../../platform/settings-contract.js";
import {
  patchBackgroundSettings as rawPatchBackgroundSettings,
  patchSyncSettings as rawPatchSyncSettings,
} from "../../platform/settings-repo.js";
import { enhanceMacSelects, syncMacSelect } from "./select.js";

async function patchBackgroundSettings(patch) {
  try {
    return await rawPatchBackgroundSettings(patch);
  } catch (error) {
    console.error(
      "[settings:appearance] patchBackgroundSettings failed:",
      error,
    );
    toast(t("settingsSaveFailed") || "Failed to save settings");
    return null;
  }
}

async function patchSyncSettings(patch) {
  try {
    return await rawPatchSyncSettings(patch);
  } catch (error) {
    console.error("[settings:appearance] patchSyncSettings failed:", error);
    toast(t("settingsSaveFailed") || "Failed to save settings");
    return null;
  }
}

let _activeAppearanceContainer = null;
let _appearanceGlobalListenersBound = false;

function _ensureAppearanceGlobalListeners() {
  if (_appearanceGlobalListenersBound) return;
  _appearanceGlobalListenersBound = true;

  window.addEventListener("background:localfiles-changed", () => {
    if (!_activeAppearanceContainer) return;
    void _loadLocalFiles(_activeAppearanceContainer);
  });

  window.addEventListener("background:applied", () => {
    if (!_activeAppearanceContainer) return;
    void _loadLocalFiles(_activeAppearanceContainer);
  });

  window.addEventListener("mac-settings:close", () => {
    _activeAppearanceContainer = null;
  });
}

const BACKGROUND_APPEARANCE_DEFAULTS = createBackgroundSettingsDefaults();
const HIDDEN_BACKGROUND_SOURCES = new Set(["color"]);
const REMOVED_BACKGROUND_SOURCES = new Set([
  "unsplash",
  "pixabay",
  "pexels",
]);

export function registerAppearanceContent(window) {
  window.registerContentRenderer("appearance", (container) => {
    container.innerHTML = `
            <!-- Theme Settings -->
            <div class="mac-settings-section">
                <h3 class="mac-settings-section-title" data-i18n="macSettingsTheme"></h3>
                <div class="mac-settings-section-content">
                    <div class="mac-settings-row">
                        <div class="mac-settings-row-label">
                            <span class="mac-settings-row-title" data-i18n="macSettingsDarkMode"></span>
                        </div>
                        <div class="mac-settings-row-control">
                            <label class="mac-toggle">
                                <input type="checkbox" class="mac-toggle-input" id="macThemeDark">
                                <span class="mac-toggle-track"></span>
                                <span class="mac-toggle-thumb"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Background Source -->
            <div class="mac-settings-section">
                <h3 class="mac-settings-section-title" data-i18n="settingsBgSection"></h3>
                <div class="mac-settings-section-content">
                    <div class="mac-settings-row" id="macBgSourceRow">
                        <div class="mac-settings-row-label">
                            <span class="mac-settings-row-title" data-i18n="settingsBgSource"></span>
                        </div>
                        <div class="mac-settings-row-control">
                            <div class="mac-select">
                                <select class="mac-select-input" id="macBgSource">
                                    <option value="files" data-i18n="settingsBgSourceLocal"></option>
                                    <option value="bing" data-i18n="settingsBgSourceBing"></option>
                                </select>
                                <span class="mac-select-arrow">
                                    <svg viewBox="0 0 12 12"><path d="M3 5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Auto Refresh -->
                    <div class="mac-settings-row" id="macAutoRefreshRow">
                        <div class="mac-settings-row-label">
                            <span class="mac-settings-row-title" data-i18n="settingsBgInterval"></span>
                        </div>
                        <div class="mac-settings-row-control">
                            <div class="mac-select">
                                <select class="mac-select-input" id="macAutoRefresh">
                                    <option value="never" data-i18n="settingsBgIntervalNever"></option>
                                    <option value="tabs" data-i18n="settingsBgIntervalTab"></option>
                                    <option value="hour" data-i18n="settingsBgIntervalHour"></option>
                                    <option value="day" data-i18n="settingsBgIntervalDay"></option>
                                </select>
                                <span class="mac-select-arrow">
                                    <svg viewBox="0 0 12 12"><path d="M3 5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.5"/></svg>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Upload Area (shown when source is local files) -->
                    <div class="mac-settings-row hidden" id="macLocalUploadRow" style="flex-direction: column; align-items: stretch; gap: 12px;">
                        <div class="mac-local-upload" id="macLocalUpload">
                            <input type="file" id="macLocalFileInput" accept="image/*" multiple style="display: none;">
                            <div class="mac-local-upload-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                    <polyline points="17 8 12 3 7 8"/>
                                    <line x1="12" y1="3" x2="12" y2="15"/>
                                </svg>
                            </div>
                            <div class="mac-local-upload-text" data-i18n="settingsBgUploadHint"></div>
                        </div>
                        <div class="mac-local-files-grid" id="macLocalFilesGrid"></div>
                    </div>
                </div>
            </div>

            <!-- Effect Settings -->
            <div class="mac-settings-section">
                <h3 class="mac-settings-section-title" data-i18n="settingsBgEffects"></h3>
                <div class="mac-settings-section-content">
                    <!-- Overlay Opacity -->
                    <div class="mac-settings-row">
                        <div class="mac-settings-row-label">
                            <span class="mac-settings-row-title" data-i18n="settingsBgOverlayOpacity"></span>
                        </div>
                        <div class="mac-settings-row-control" style="flex: 1; max-width: 200px;">
                            <div class="mac-slider">
                                <div class="mac-slider-track-container">
                                    <div class="mac-slider-fill" id="macOverlayFill"></div>
                                    <input type="range" class="mac-slider-input" id="macOverlaySlider" min="0" max="80" value="30" step="1">
                                </div>
                                <span class="mac-slider-value" id="macOverlayValue">30%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Blur Amount -->
                    <div class="mac-settings-row">
                        <div class="mac-settings-row-label">
                            <span class="mac-settings-row-title" data-i18n="settingsBgBlur"></span>
                        </div>
                        <div class="mac-settings-row-control" style="flex: 1; max-width: 200px;">
                            <div class="mac-slider">
                                <div class="mac-slider-track-container">
                                    <div class="mac-slider-fill" id="macBlurFill"></div>
                                    <input type="range" class="mac-slider-input" id="macBlurSlider" min="0" max="30" value="0" step="1">
                                </div>
                                <span class="mac-slider-value" id="macBlurValue">0px</span>
                            </div>
                        </div>
                    </div>

                    <!-- Texture -->
                    <div class="mac-settings-row">
                        <div class="mac-settings-row-label">
                            <span class="mac-settings-row-title" data-i18n="settingsBgTexture"></span>
                        </div>
                        <div class="mac-settings-row-control">
                            <div class="mac-texture-selector" id="macTextureSelector">
                                <button class="mac-texture-option active" data-texture="none" data-i18n="textureNone" data-i18n-attr="title" title="">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M4.93 4.93l14.14 14.14"/>
                                    </svg>
                                </button>
                                <button class="mac-texture-option" data-texture="grain" data-i18n="textureGrain" data-i18n-attr="title" title="">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="4" r="1"/><circle cx="20" cy="4" r="1.5"/>
                                        <circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1.5"/>
                                        <circle cx="4" cy="12" r="1"/><circle cx="12" cy="12" r="1.5"/><circle cx="20" cy="12" r="1"/>
                                        <circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1"/>
                                        <circle cx="4" cy="20" r="1"/><circle cx="12" cy="20" r="1.5"/><circle cx="20" cy="20" r="1"/>
                                    </svg>
                                </button>
                                <button class="mac-texture-option" data-texture="grid" data-i18n="textureGrid" data-i18n-attr="title" title="">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <rect x="3" y="3" width="18" height="18"/>
                                        <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                                        <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                                    </svg>
                                </button>
                                <button class="mac-texture-option" data-texture="lines" data-i18n="textureLines" data-i18n-attr="title" title="">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                        <line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    enhanceMacSelects(container);
    _bindAppearanceEvents(container);
    _loadAppearanceSettings(container);

    queueMicrotask(() => enhanceMacSelects(container));

    _activeAppearanceContainer = container;
    _ensureAppearanceGlobalListeners();
  });
}

function _bindAppearanceEvents(container) {
  const themeToggle = container.querySelector("#macThemeDark");
  if (themeToggle) {
    themeToggle.addEventListener("change", async (e) => {
      const isDark = e.target.checked;
      await patchSyncSettings({ uiTheme: isDark ? "dark" : "light" });
    });
  }

  const bgSourceSelect = container.querySelector("#macBgSource");
  if (bgSourceSelect) {
    bgSourceSelect.addEventListener("change", async (e) => {
      const source = e.target.value;
      const patch =
        source === "bing"
          ? { type: source, frequency: "day" }
          : { type: source };
      await patchBackgroundSettings(patch);
      _updateSourceUI(container, source);
    });
  }

  const autoRefreshSelect = container.querySelector("#macAutoRefresh");
  if (autoRefreshSelect) {
    autoRefreshSelect.addEventListener("change", async (e) => {
      await patchBackgroundSettings({ frequency: e.target.value });
    });
  }

  _bindLocalFilesEvents(container);

  _bindSliderEvents(
    container,
    "macOverlaySlider",
    "macOverlayValue",
    "macOverlayFill",
    "%",
    80,
    "overlay",
  );
  _bindSliderEvents(
    container,
    "macBlurSlider",
    "macBlurValue",
    "macBlurFill",
    "px",
    30,
    "blur",
  );

  const textureSelector = container.querySelector("#macTextureSelector");
  if (textureSelector) {
    textureSelector.addEventListener("click", async (e) => {
      const option = e.target.closest(".mac-texture-option");
      if (!option) return;

      const texture = option.dataset.texture;
      textureSelector.querySelectorAll(".mac-texture-option").forEach((opt) => {
        opt.classList.toggle("active", opt === option);
      });
      await patchBackgroundSettings({ texture: { type: texture } });
    });
  }
}

function _bindLocalFilesEvents(container) {
  const uploadArea = container.querySelector("#macLocalUpload");
  const fileInput = container.querySelector("#macLocalFileInput");
  const filesGrid = container.querySelector("#macLocalFilesGrid");

  if (!uploadArea || !fileInput) return;

  uploadArea.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (files?.length > 0) {
      await _handleLocalFilesUpload(container, files);
    }
    fileInput.value = "";
  });

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove("dragover");

    const files = e.dataTransfer?.files;
    if (files?.length > 0) {
      await _handleLocalFilesUpload(container, files);
    }
  });

  if (filesGrid) {
    filesGrid.addEventListener("click", async (e) => {
      const deleteBtn = e.target.closest(".mac-local-file-delete");
      const item = e.target.closest(".mac-local-file-item");

      if (deleteBtn && item) {
        e.stopPropagation();
        await _deleteLocalFile(container, item.dataset.id);
        return;
      }

      if (item) {
        await _selectLocalFile(container, item.dataset.id);
      }
    });
  }
}

async function _handleLocalFilesUpload(container, files) {
  try {
    await backgroundSystem.whenReady();
    await backgroundSystem.addLocalFiles(files, { origin: "mac-settings" });
    await _loadLocalFiles(container);
    toast(t("bgUploadSuccess") || "Images uploaded");
  } catch (error) {
    console.error("[MacSettings] Failed to upload local files:", error);
    toast(t("bgUploadFailed") + ": " + (error.message || t("unknownError")));
  }
}

async function _loadLocalFiles(container) {
  const filesGrid = container.querySelector("#macLocalFilesGrid");
  if (!filesGrid) return;

  try {
    await backgroundSystem.whenReady();
    const localFiles = await backgroundSystem.getLocalFiles();
    const systemFiles = backgroundSystem.getSystemBackgrounds();

    const files = [...systemFiles, ...localFiles];

    filesGrid.innerHTML = "";

    for (const file of files) {
      const item = document.createElement("div");
      item.className = "mac-local-file-item";
      item.dataset.id = file.id;

      const currentBg = backgroundSystem.getCurrentBackground();
      if (currentBg?.id === file.id) {
        item.classList.add("selected");
      } else if (file.file?.selected) {
        item.classList.add("selected");
      }

      const img = document.createElement("img");
      img.src = file.urls.small;
      img.alt = "Background";
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        item.classList.add("broken");
      };

      item.appendChild(img);

      if (!file.isSystem) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "mac-local-file-delete";
        deleteBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6L6 18"/><path d="M6 6l12 12"/>
                    </svg>
                `;
        deleteBtn.type = "button";
        item.appendChild(deleteBtn);
      }

      filesGrid.appendChild(item);
    }
  } catch (error) {
    console.error("[MacSettings] Failed to load local files:", error);
  }
}

async function _selectLocalFile(container, id) {
  const filesGrid = container.querySelector("#macLocalFilesGrid");
  if (!filesGrid) return;

  try {
    await backgroundSystem.whenReady();

    const localFiles = await backgroundSystem.getLocalFiles();
    const systemFiles = backgroundSystem.getSystemBackgrounds();
    const files = [...systemFiles, ...localFiles];

    const file = files.find((f) => f.id === id);
    if (!file) return;

    filesGrid.querySelectorAll(".mac-local-file-item").forEach((item) => {
      item.classList.toggle("selected", item.dataset.id === id);
    });

    await backgroundSystem.applyBackground(file);
  } catch (error) {
    console.error("[MacSettings] Failed to select local file:", error);
  }
}

async function _deleteLocalFile(container, id) {
  if (id === "default") return;

  try {
    await backgroundSystem.whenReady();
    await backgroundSystem.deleteLocalFile(id, { origin: "mac-settings" });
    await _loadLocalFiles(container);
  } catch (error) {
    console.error("[MacSettings] Failed to delete local file:", error);
    toast(t("bgDeleteFailed") || "Delete failed");
  }
}

function _bindSliderEvents(
  container,
  sliderId,
  valueId,
  fillId,
  unit,
  max,
  settingKey,
  min = 0,
) {
  const slider = container.querySelector(`#${sliderId}`);
  const valueEl = container.querySelector(`#${valueId}`);
  const fillEl = container.querySelector(`#${fillId}`);

  if (!slider) return;

  const updateUI = (value) => {
    const percent = ((value - min) / (max - min)) * 100;
    if (valueEl) valueEl.textContent = `${value}${unit}`;
    slider.style.setProperty("--mac-slider-percent", `${percent}%`);
    if (fillEl) {
      fillEl.style.width = `${percent}%`;
    }
  };

  slider.addEventListener("input", (e) => {
    const value = parseInt(e.target.value, 10);
    updateUI(value);
  });

  slider.addEventListener("change", async (e) => {
    const value = parseInt(e.target.value, 10);
    await patchBackgroundSettings({ [settingKey]: value });
  });
}

function _updateSourceUI(container, source) {
  const isHiddenSource = HIDDEN_BACKGROUND_SOURCES.has(source);
  const isLocalSource = source === "files";
  const isBingSource = source === "bing";
  const sourceRow = container.querySelector("#macBgSourceRow");
  const autoRefreshRow = container.querySelector("#macAutoRefreshRow");

  // Keep hidden stored sources runnable without exposing them in the UI again.
  if (sourceRow) {
    sourceRow.classList.toggle("hidden", isHiddenSource);
  }
  if (autoRefreshRow) {
    autoRefreshRow.classList.toggle("hidden", isHiddenSource);
  }

  const localFilesRow = container.querySelector("#macLocalUploadRow");
  if (localFilesRow) {
    localFilesRow.classList.toggle("hidden", isHiddenSource || !isLocalSource);
  }

  const autoRefreshSelect = container.querySelector("#macAutoRefresh");
  if (autoRefreshSelect) {
    if (isBingSource) {
      autoRefreshSelect.value = "day";
    }
    autoRefreshSelect.disabled = isHiddenSource || isBingSource;
    syncMacSelect(autoRefreshSelect);
  }
}

async function _loadAppearanceSettings(container) {
  try {
    const {
      uiTheme = SYNC_SETTINGS_DEFAULTS.uiTheme,
      backgroundSettings = BACKGROUND_APPEARANCE_DEFAULTS,
    } = await getSyncSettings({
      uiTheme: undefined,
      backgroundSettings: undefined,
    });
    const themeToggle = container.querySelector("#macThemeDark");
    if (themeToggle) themeToggle.checked = uiTheme === "dark";

    const bgSourceSelect = container.querySelector("#macBgSource");
    const currentSource =
      backgroundSettings.type || BACKGROUND_APPEARANCE_DEFAULTS.type;
    if (bgSourceSelect) {
      if (
        !HIDDEN_BACKGROUND_SOURCES.has(currentSource) &&
        !REMOVED_BACKGROUND_SOURCES.has(currentSource)
      ) {
        bgSourceSelect.value = currentSource;
      }
      syncMacSelect(bgSourceSelect);
      _updateSourceUI(container, currentSource);
    }

    const autoRefreshSelect = container.querySelector("#macAutoRefresh");
    const effectiveFrequency =
      currentSource === "bing"
        ? "day"
        : backgroundSettings.frequency ||
          BACKGROUND_APPEARANCE_DEFAULTS.frequency;
    if (autoRefreshSelect) {
      autoRefreshSelect.value = effectiveFrequency;
      syncMacSelect(autoRefreshSelect);
    }

    if (currentSource === "files") {
      await _loadLocalFiles(container);
    }

    _loadSlider(
      container,
      "macOverlaySlider",
      "macOverlayValue",
      "macOverlayFill",
      backgroundSettings.overlay ?? BACKGROUND_APPEARANCE_DEFAULTS.overlay,
      "%",
      80,
    );
    _loadSlider(
      container,
      "macBlurSlider",
      "macBlurValue",
      "macBlurFill",
      backgroundSettings.blur ?? BACKGROUND_APPEARANCE_DEFAULTS.blur,
      "px",
      30,
    );

    const textureSelector = container.querySelector("#macTextureSelector");
    if (textureSelector) {
      const activeTexture =
        backgroundSettings.texture?.type ||
        BACKGROUND_APPEARANCE_DEFAULTS.texture.type;
      textureSelector.querySelectorAll(".mac-texture-option").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.texture === activeTexture);
      });
    }
  } catch (error) {
    console.error("[MacSettings] Failed to load appearance settings:", error);
  }
}

function _loadSlider(
  container,
  sliderId,
  valueId,
  fillId,
  value,
  unit,
  max,
  min = 0,
) {
  const slider = container.querySelector(`#${sliderId}`);
  const valueEl = container.querySelector(`#${valueId}`);
  const fillEl = container.querySelector(`#${fillId}`);

  if (slider) {
    slider.value = String(value);
    const percent = ((value - min) / (max - min)) * 100;
    slider.style.setProperty("--mac-slider-percent", `${percent}%`);
  }
  if (valueEl) valueEl.textContent = `${value}${unit}`;
  if (fillEl) {
    const percent = ((value - min) / (max - min)) * 100;
    fillEl.style.width = `${percent}%`;
  }
}
