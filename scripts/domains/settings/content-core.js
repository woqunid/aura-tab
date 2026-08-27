import { t } from '../../platform/i18n.js';
import { patchBackgroundSettings, patchSyncSettings } from '../../platform/settings-repo.js';
import { getSyncSettings, SYNC_SETTINGS_DEFAULTS, createBackgroundSettingsDefaults } from '../../platform/settings-contract.js';
import { toast } from '../../shared/toast.js';
import {
    SHORTCUT_ACTIONS,
    SHORTCUT_SETTING_KEYS,
    formatShortcutForDisplay,
    normalizeShortcutFromEvent,
    resolveShortcutSettings
} from '../../platform/shortcut-manager.js';
import { createSettingsBuilder } from './builder.js';
import { createStepperRow } from './content-dock.js';
import { escapeHtml } from '../../shared/text.js';
import { QUICKLINKS_BOUNDS, QUICKLINKS_SYNC_KEYS } from '../quicklinks/store.js';

const ONLINE_BACKGROUND_SOURCES = ['unsplash', 'pixabay', 'pexels', 'bing'];
const BACKGROUND_UI_DEFAULTS = createBackgroundSettingsDefaults();
const QUICKLINKS_KEYS = QUICKLINKS_SYNC_KEYS;
const LAUNCHPAD_DENSITY_STEPPERS = [
    {
        prefix: 'macGridCols',
        labelKey: 'settingsLaunchpadColumns',
        storageKey: QUICKLINKS_KEYS.gridColumns,
        min: QUICKLINKS_BOUNDS.gridColumns.min,
        max: QUICKLINKS_BOUNDS.gridColumns.max
    },
    {
        prefix: 'macGridRows',
        labelKey: 'settingsLaunchpadRows',
        storageKey: QUICKLINKS_KEYS.gridRows,
        min: QUICKLINKS_BOUNDS.gridRows.min,
        max: QUICKLINKS_BOUNDS.gridRows.max
    }
];
const SHORTCUT_EDITABLE_ACTIONS = Object.freeze([
    SHORTCUT_ACTIONS.focusSearch,
    SHORTCUT_ACTIONS.openLaunchpad
]);

const SHORTCUT_ACTION_TO_SETTING_KEY = Object.freeze({
    [SHORTCUT_ACTIONS.focusSearch]: SHORTCUT_SETTING_KEYS.focusSearch,
    [SHORTCUT_ACTIONS.openLaunchpad]: SHORTCUT_SETTING_KEYS.openLaunchpad
});

export function registerGeneralContent(window) {
    window.registerContentRenderer('general', (container) => {
        const builder = createSettingsBuilder(container, {
            sections: [
                {
                    type: 'section',
                    titleKey: 'settingsLanguageSection',
                    rows: [
                        {
                            type: 'select',
                            id: 'macInterfaceLanguage',
                            labelKey: 'settingsLanguage',
                            options: [
                                { value: 'auto', labelKey: 'langAuto' },
                                { value: 'zh-CN', labelKey: 'langZhCN' },
                                { value: 'zh-TW', labelKey: 'langZhTW' },
                                { value: 'en', labelKey: 'langEn' }
                            ],
                            read: async () => {
                                const { getLanguageSetting } = await import('../../platform/i18n.js');
                                return getLanguageSetting();
                            },
                            write: async (value) => {
                                const { setLanguage } = await import('../../platform/i18n.js');
                                await setLanguage(value);
                                const { toast } = await import('../../shared/toast.js');
                                toast(t('langChanged'));
                            }
                        }
                    ]
                },
                {
                    type: 'section',
                    titleKey: 'settingsUiSection',
                    rows: [
                        {
                            type: 'toggle',
                            id: 'macShowRefreshBtn',
                            labelKey: 'settingsUiShowRefreshBtn',
                            storageKey: 'backgroundSettings',
                            defaultValue: BACKGROUND_UI_DEFAULTS.showRefreshButton,
                            read: ({ storage }) => storage?.sync?.backgroundSettings?.showRefreshButton,
                            write: (value) => patchBackgroundSettings({ showRefreshButton: value })
                        },
                        {
                            type: 'toggle',
                            id: 'macShowSettingsBtn',
                            labelKey: 'settingsUiShowSettingsBtn',
                            storageKey: 'showSettingsBtn',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.showSettingsBtn
                        },
                        {
                            type: 'toggle',
                            id: 'macShowSearchBtn',
                            labelKey: 'settingsUiShowSearchBtn',
                            storageKey: 'showSearchBtn',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.showSearchBtn
                        },
                        {
                            type: 'toggle',
                            id: 'macShowClock',
                            labelKey: 'settingsUiShowClock',
                            storageKey: 'showClock',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.showClock
                        },
                        {
                            type: 'toggle',
                            id: 'macShowSeconds',
                            labelKey: 'settingsClockShowSeconds',
                            storageKey: 'showSeconds',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.showSeconds
                        },
                        {
                            type: 'toggle',
                            id: 'macSearchOpenNewTab',
                            labelKey: 'settingsUiSearchNewTab',
                            storageKey: 'searchOpenInNewTab',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.searchOpenInNewTab
                        },
                        {
                            type: 'toggle',
                            id: 'macShowPhotoInfo',
                            rowId: 'macPhotoInfoSetting',
                            labelKey: 'settingsUiShowPhotoInfo',
                            storageKey: 'backgroundSettings',
                            defaultValue: BACKGROUND_UI_DEFAULTS.showPhotoInfo,
                            read: ({ storage }) => storage?.sync?.backgroundSettings?.showPhotoInfo,
                            write: (value) => patchBackgroundSettings({ showPhotoInfo: value })
                        },
                        {
                            type: 'toggle',
                            id: 'macLaunchpadShowNames',
                            labelKey: 'settingsUiLaunchpadShowNames',
                            storageKey: 'launchpadShowNames',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.launchpadShowNames
                        },
                        {
                            type: 'toggle',
                            id: 'macCloseSettingsOnOutsideClick',
                            labelKey: 'settingsUiCloseSettingsOnOutsideClick',
                            storageKey: 'macSettingsDismissOnOutsideClick',
                            defaultValue: SYNC_SETTINGS_DEFAULTS.macSettingsDismissOnOutsideClick,
                            toInput: (value) => value === true,
                            fromInput: (value) => value === true
                        }
                    ]
                },
                {
                    type: 'section',
                    titleKey: 'settingsLaunchpadDensity',
                    rows: LAUNCHPAD_DENSITY_STEPPERS.map(createStepperRow)
                }
            ],
            onAfterLoad: ({ builder, storage }) => {
                const photoInfoRow = builder.getById('macPhotoInfoSetting');
                if (!photoInfoRow) return;

                const source = storage?.sync?.backgroundSettings?.type || BACKGROUND_UI_DEFAULTS.type;
                photoInfoRow.style.display = ONLINE_BACKGROUND_SOURCES.includes(source) ? 'flex' : 'none';
            }
        });

        void builder.init();
    });
}

export function registerAboutContent(window) {
    window.registerContentRenderer('about', (container) => {
        const manifest = chrome.runtime.getManifest();
        const version = manifest.version || '1.0.0';
        const name = manifest.name || 'Aura Tab';
        const safeName = escapeHtml(name);
        const currentYear = new Date().getFullYear();

        container.innerHTML = `
            <div class="mac-about-content">
                <div class="mac-about-header mac-about-header--hero">
                    <div class="mac-about-icon">
                        <img src="assets/icons/icon128.png" alt="${safeName}" width="112" height="112">
                    </div>
                    <div class="mac-about-header-copy">
                        <h2 class="mac-about-name">${safeName}</h2>
                        <p class="mac-about-version">${t('macSettingsVersion') || 'Version'} ${version}</p>
                    </div>
                </div>

                <div id="macAboutSections" class="mac-about-sections"></div>

                <div class="mac-about-footer">
                    <p>© ${currentYear} Aura Tab. ${t('macSettingsAllRightsReserved') || 'All rights reserved.'}</p>
                </div>
            </div>
        `;

        const sectionHost = container.querySelector('#macAboutSections');
        if (!sectionHost) return;

        const builder = createSettingsBuilder(sectionHost, {
            sections: [
                {
                    type: 'section',
                    rows: [
                        {
                            type: 'custom',
                            html: `
                                <div class="mac-settings-row mac-about-copy-row">
                                    <p class="mac-about-description">
                                        ${t('macSettingsAboutDesc') || 'A beautiful new tab page with macOS-style design, featuring quick links, wallpapers, and more.'}
                                    </p>
                                </div>
                            `
                        }
                    ]
                },
                {
                    type: 'section',
                    titleKey: 'macSettingsShortcuts',
                    rows: [
                        {
                            type: 'custom',
                            labelKey: 'shortcutFocusSearch',
                            label: 'Focus Search',
                            controlHtml: `
                                <button type="button"
                                        class="mac-shortcut-btn mac-keycap"
                                        data-shortcut-action="${SHORTCUT_ACTIONS.focusSearch}">
                                </button>
                            `
                        },
                        {
                            type: 'custom',
                            labelKey: 'shortcutOpenLaunchpad',
                            label: 'Open Launchpad',
                            controlHtml: `
                                <button type="button"
                                        class="mac-shortcut-btn mac-keycap"
                                        data-shortcut-action="${SHORTCUT_ACTIONS.openLaunchpad}">
                                </button>
                            `
                        },
                        {
                            type: 'custom',
                            labelKey: 'macSettingsOpenSettings',
                            label: 'Open Settings',
                            controlHtml: '<span class="mac-keycap" aria-label="Space">Space</span>'
                        },
                        {
                            type: 'custom',
                            labelKey: 'macSettingsCloseOverlay',
                            label: 'Close Overlay',
                            controlHtml: '<span class="mac-keycap" aria-label="Escape">Esc</span>'
                        }
                    ]
                }
            ]
        });

        void builder.init()
            .then(() => _initShortcutEditors(sectionHost))
            .catch((error) => {
                console.error('[MacSettings] Failed to initialize about shortcuts:', error);
            });
    });
}

function _buildShortcutSettingsRequest() {
    return {
        [SHORTCUT_SETTING_KEYS.focusSearch]: undefined,
        [SHORTCUT_SETTING_KEYS.openLaunchpad]: undefined
    };
}

function _renderShortcutButtons(container, shortcuts) {
    if (!container) return;
    const buttons = container.querySelectorAll('.mac-shortcut-btn[data-shortcut-action]');
    buttons.forEach((button) => {
        const action = button.dataset.shortcutAction;
        const shortcut = shortcuts[action];
        button.textContent = formatShortcutForDisplay(shortcut);
    });
}

function _validateShortcutConflict(action, normalizedShortcut, shortcuts) {
    for (const candidate of SHORTCUT_EDITABLE_ACTIONS) {
        if (candidate === action) continue;
        if (shortcuts[candidate] === normalizedShortcut) {
            return false;
        }
    }
    return true;
}

async function _initShortcutEditors(container) {
    if (!container) return;

    const stored = await getSyncSettings(_buildShortcutSettingsRequest());
    const base = resolveShortcutSettings(stored);
    const shortcuts = {
        [SHORTCUT_ACTIONS.focusSearch]: base.focusSearch,
        [SHORTCUT_ACTIONS.openLaunchpad]: base.openLaunchpad
    };

    _renderShortcutButtons(container, shortcuts);

    let recordingAction = '';

    const stopRecording = () => {
        recordingAction = '';
        container.querySelectorAll('.mac-shortcut-btn').forEach((btn) => {
            btn.classList.remove('recording');
        });
        _renderShortcutButtons(container, shortcuts);
    };

    container.querySelectorAll('.mac-shortcut-btn[data-shortcut-action]').forEach((button) => {
        const action = button.dataset.shortcutAction;
        if (!SHORTCUT_EDITABLE_ACTIONS.includes(action)) return;

        button.addEventListener('click', () => {
            if (recordingAction === action) {
                stopRecording();
                return;
            }
            recordingAction = action;
            container.querySelectorAll('.mac-shortcut-btn').forEach((btn) => {
                btn.classList.toggle('recording', btn === button);
            });
            button.textContent = t('shortcutPressKeys');
            button.focus();
        });

        button.addEventListener('blur', () => {
            if (recordingAction === action) {
                stopRecording();
            }
        });

        button.addEventListener('keydown', async (event) => {
            if (recordingAction !== action) return;

            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                stopRecording();
                return;
            }

            const normalizedShortcut = normalizeShortcutFromEvent(event);
            if (!normalizedShortcut) {
                return;
            }

            if (!_validateShortcutConflict(action, normalizedShortcut, shortcuts)) {
                toast(t('shortcutConflict'));
                return;
            }

            const key = SHORTCUT_ACTION_TO_SETTING_KEY[action];
            if (!key) {
                stopRecording();
                return;
            }

            try {
                const result = await patchSyncSettings({ [key]: normalizedShortcut });
                if (!result?.ok) {
                    toast(t('shortcutSaveFailed'));
                    return;
                }
                shortcuts[action] = normalizedShortcut;
                toast(t('shortcutSaved'));
            } catch (error) {
                console.error('[MacSettings] Failed to save shortcut:', error);
                toast(t('shortcutSaveFailed'));
            } finally {
                stopRecording();
            }
        });
    });
}
