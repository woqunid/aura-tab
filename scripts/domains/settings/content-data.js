import { t } from '../../platform/i18n.js';

let linkManagerInstance = null;

export function registerDataContent(window) {
    window.registerContentRenderer('data', async (container, context = {}) => {
        container.innerHTML = `
            <div class="data-page-layout">
                <section class="data-settings-section data-settings-section--manager">
                    <div class="data-settings-section__header">
                        <h3 class="data-settings-section__title" data-i18n="linkManagerTitle"></h3>
                        <p class="data-settings-section__desc" data-i18n="linkManagerSectionDesc"></p>
                    </div>
                    <div class="data-settings-section__body">
                        <div id="linkManagerContainer"></div>
                    </div>
                </section>

                <section class="data-settings-section data-settings-section--bookmarks">
                    <div class="data-settings-section__header">
                        <h3 class="data-settings-section__title" data-i18n="settingsQuicklinksSection"></h3>
                    </div>
                    <div class="data-settings-section__body data-settings-section__body--compact">
                        <div class="data-settings-inline-row">
                            <div class="data-settings-inline-row__copy">
                                <span class="data-settings-inline-row__title" data-i18n="macSettingsLinksImportExport"></span>
                                <span class="data-settings-inline-row__desc" data-i18n="macSettingsLinksDesc"></span>
                            </div>
                            <div class="data-settings-inline-row__actions">
                                <div class="mac-button-group mac-button-group--fixed">
                                    <button class="mac-button" id="macExportLinks" data-i18n="linkExportBtn"></button>
                                    <button class="mac-button mac-button--primary" id="macImportBookmarks" data-i18n="bookmarkImportBtn"></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        `;

        bindDataEvents(container, window);
        await initLinkManager(container, context);
    });
}

async function initLinkManager(container, context = {}) {
    const managerContainer = container.querySelector('#linkManagerContainer');
    if (!managerContainer) return;

    linkManagerInstance?.destroy();
    linkManagerInstance = null;

    try {
        const { LinkManagerComponent } = await import('../quicklinks/link-manager.js');
        if (context.isCurrent && !context.isCurrent()) return;
        linkManagerInstance = new LinkManagerComponent(managerContainer);
    } catch (error) {
        if (context.isCurrent && !context.isCurrent()) return;
        console.error('[DataSettings] Failed to init Link Manager:', error);
        managerContainer.innerHTML = `<p style="color: var(--text-tertiary); font-size: 13px;">${t('linkManagerLoadError') || 'Failed to load link manager'}</p>`;
    }
}

function bindDataEvents(container, macWindow) {
    container.querySelector('#macExportLinks')?.addEventListener('click', async () => {
        macWindow.close();
        const { linkExportUI } = await import('../bookmarks/export-ui.js');
        linkExportUI.open();
    });

    container.querySelector('#macImportBookmarks')?.addEventListener('click', async () => {
        macWindow.close();
        const { bookmarkImportUI } = await import('../bookmarks/ui.js');
        bookmarkImportUI.open();
    });
}
