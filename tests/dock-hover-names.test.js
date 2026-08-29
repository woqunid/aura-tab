import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { setStorageData, triggerStorageChange } from './setup.js';

async function freshStore() {
    vi.resetModules();
    const mod = await import('../scripts/domains/quicklinks/store.js');
    return mod.store;
}

function seedMinimalV4() {
    setStorageData({
        storageVersion: 4,
        quicklinksDockPins: [],
        quicklinksItems: []
    }, 'sync');
}

describe('Dock hover names setting', () => {
    it('is enabled by default and can be disabled through sync storage', async () => {
        seedMinimalV4();
        const store = await freshStore();
        await store.init();

        expect(store.settings.hideHoverNames).toBe(true);

        const events = [];
        store.subscribe((event, data) => {
            if (event === 'settingsChanged') events.push(data);
        });

        triggerStorageChange({
            quicklinksHideHoverNames: { oldValue: true, newValue: false }
        }, 'sync');

        expect(events.at(-1)?.hideHoverNames).toBe(false);
        expect(store.settings.hideHoverNames).toBe(false);

        store.destroy?.();
    });

    it('keeps the toggle in Dock appearance and applies it to hover titles', () => {
        const settings = fs.readFileSync('scripts/domains/settings/content-dock.js', 'utf8');
        const dock = fs.readFileSync('scripts/domains/quicklinks/dock.js', 'utf8');
        const css = fs.readFileSync('styles/bundle.css', 'utf8');

        expect(settings).toContain('macQuicklinksHideHoverNames');
        expect(settings).toContain('settingsQuicklinksHideHoverNames');
        expect(dock).toContain("classList.toggle('hide-hover-names'");
        expect(css).toContain('.quicklinks-container.hide-hover-names .quicklink-title');
    });
});
