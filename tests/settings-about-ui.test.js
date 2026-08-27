import { beforeEach, describe, expect, it, vi } from 'vitest';

function createWindowStub() {
    const renderers = new Map();
    return {
        registerContentRenderer: vi.fn((key, renderer) => {
            renderers.set(key, renderer);
        }),
        getRenderer(key) {
            return renderers.get(key);
        },
        close: vi.fn()
    };
}

async function flushAsync() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('settings about UI', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        document.body.innerHTML = '';
        chrome.runtime.getManifest = vi.fn(() => ({
            name: 'Aura Tab',
            version: '9.9.9'
        }));
    });

    it('about page should render compact brand and shortcut sections without related links', async () => {
        const { registerAboutContent } = await import('../scripts/domains/settings/content-core.js');
        const win = createWindowStub();
        const container = document.createElement('div');

        registerAboutContent(win);
        const renderer = win.getRenderer('about');

        expect(typeof renderer).toBe('function');
        renderer(container);
        await flushAsync();

        expect(container.querySelector('.mac-about-header')).toBeTruthy();
        expect(container.querySelector('.mac-about-header--hero')).toBeTruthy();
        expect(container.querySelector('.mac-about-description')).toBeTruthy();

        expect(container.querySelector('a')).toBeNull();

        const shortcutButtons = Array.from(
            container.querySelectorAll('.mac-shortcut-btn[data-shortcut-action]')
        );
        expect(shortcutButtons).toHaveLength(2);
        expect(shortcutButtons.every((button) => button.classList.contains('mac-keycap'))).toBe(true);

        const keycaps = Array.from(container.querySelectorAll('.mac-keycap'));
        expect(keycaps).toHaveLength(4);
    });
});
