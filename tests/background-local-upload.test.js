import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStorageData } from './setup.js';

const state = vi.hoisted(() => ({
    runBackgroundTransition: vi.fn(),
    addFiles: vi.fn(),
    selectFile: vi.fn()
}));

vi.mock('../scripts/domains/backgrounds/image-pipeline.js', () => ({
    runBackgroundTransition: state.runBackgroundTransition,
    applyBackgroundMethodsTo: vi.fn(),
    analyzeCropForBackground: vi.fn(),
    clearCropAnalysisCache: vi.fn(),
    getCropFallbackPosition: vi.fn(),
    blobUrlManager: {
        releaseScope: vi.fn(),
        releaseAll: vi.fn()
    },
    needsBackgroundChange: vi.fn(() => true),
    showNotification: vi.fn()
}));

vi.mock('../scripts/domains/backgrounds/source-local.js', () => ({
    localFilesManager: {
        init: vi.fn(),
        addFiles: state.addFiles,
        selectFile: state.selectFile
    }
}));

vi.mock('../scripts/domains/backgrounds/source-remote.js', () => ({
    getProvider: vi.fn()
}));

describe('Background local file uploads', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        state.runBackgroundTransition.mockImplementation(async (system, options) => {
            const prepared = options.background;
            system.currentBackground = prepared;
            await options.afterApply?.(prepared);
            if (options.save) {
                await system._saveBackgroundState(prepared);
            }
            return prepared;
        });
    });

    afterEach(async () => {
        const { backgroundSystem } = await import('../scripts/domains/backgrounds/controller.js');
        backgroundSystem.destroy();
    });

    it('activates, selects and persists the first uploaded image for new tabs', async () => {
        const uploaded = {
            format: 'image',
            id: 'uploaded-1',
            file: { name: 'uploaded.jpg', selected: false },
            urls: {
                full: 'blob:uploaded-full',
                small: 'blob:uploaded-small'
            }
        };
        state.addFiles.mockResolvedValue([uploaded]);

        const { backgroundSystem } = await import('../scripts/domains/backgrounds/controller.js');
        backgroundSystem.settings = { ...backgroundSystem.settings, type: 'unsplash' };

        await backgroundSystem.addLocalFiles([new File(['image'], 'uploaded.jpg', { type: 'image/jpeg' })], {
            origin: 'mac-settings'
        });

        const appliedBackground = state.runBackgroundTransition.mock.calls[0][1].background;
        expect(backgroundSystem.settings.type).toBe('files');
        expect(getStorageData('sync').backgroundSettings.type).toBe('files');
        expect(appliedBackground).toEqual(expect.objectContaining({
            id: 'uploaded-1',
            file: expect.objectContaining({ selected: true })
        }));
        expect(state.selectFile).toHaveBeenCalledWith('uploaded-1');
        expect(backgroundSystem.currentBackground).toBe(appliedBackground);
        expect(getStorageData('local').currentBackground).toEqual(expect.objectContaining({
            id: 'uploaded-1',
            file: expect.objectContaining({
                name: 'uploaded.jpg',
                selected: true
            })
        }));
    });

    it('does not change the active source when no image was accepted', async () => {
        state.addFiles.mockResolvedValue([]);

        const { backgroundSystem } = await import('../scripts/domains/backgrounds/controller.js');
        backgroundSystem.settings = { ...backgroundSystem.settings, type: 'pexels' };

        const results = await backgroundSystem.addLocalFiles([], { origin: 'mac-settings' });

        expect(results).toEqual([]);
        expect(backgroundSystem.settings.type).toBe('pexels');
        expect(state.runBackgroundTransition).not.toHaveBeenCalled();
        expect(state.selectFile).not.toHaveBeenCalled();
    });
});
