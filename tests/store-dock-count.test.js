import { describe, it, expect, vi } from 'vitest';
import { getStorageData, setStorageData, triggerStorageChange } from './setup.js';

async function freshStore() {
    vi.resetModules();
    const mod = await import('../scripts/domains/quicklinks/store.js');
    return mod.store;
}

function seedItems(count, dockCount, pinnedCount) {
    const ids = [];
    const chunk = {};
    for (let i = 0; i < count; i++) {
        const id = `qlink_${String(i).padStart(3, '0')}`;
        ids.push(id);
        chunk[id] = {
            _id: id,
            title: `Item ${i}`,
            url: `https://example.com/${i}`,
            icon: '',
            createdAt: Date.now() - i
        };
    }

    setStorageData({
        storageVersion: 6,
        quicklinksItems: ids,
        quicklinksDockPins: ids.slice(0, pinnedCount),
        quicklinksDockCount: dockCount,
        quicklinksActiveSet: 'seed_dock_count',
        quicklinksChunkSet_seed_dock_count_index: ['quicklinksChunkSet_seed_dock_count_0'],
        quicklinksChunkSet_seed_dock_count_0: chunk
    }, 'sync');
}

describe('Store Dock count behavior', () => {
    it('fills the Dock with existing top-level links when the display count increases', async () => {
        seedItems(12, 5, 5);
        const store = await freshStore();
        await store.init();

        expect(store.getDockItems()).toHaveLength(5);

        triggerStorageChange({
            quicklinksDockCount: { oldValue: 5, newValue: 12 }
        }, 'sync');

        await vi.waitFor(() => {
            expect(store.getDockItems()).toHaveLength(12);
        });
        expect(store.getDockItems().map(item => item._id)).toEqual([
            ...Array.from({ length: 5 }, (_, index) => `qlink_${String(index).padStart(3, '0')}`),
            '__SYSTEM_SETTINGS__',
            ...Array.from({ length: 6 }, (_, index) => `qlink_${String(index + 5).padStart(3, '0')}`)
        ]);
        expect(getStorageData().quicklinksDockPins).toHaveLength(12);

        store.destroy?.();
    });

    it('does not add folders to fill Dock capacity', async () => {
        seedItems(4, 5, 1);
        const store = await freshStore();
        await store.init();
        const folder = await store.createFolder('Folder', ['qlink_001']);

        triggerStorageChange({
            quicklinksDockCount: { oldValue: 5, newValue: 12 }
        }, 'sync');

        await vi.waitFor(() => {
            expect(store.getDockItems().length).toBeGreaterThan(0);
        });
        expect(store.getDockItems().some(item => item._id === folder._id)).toBe(false);

        store.destroy?.();
    });
});
