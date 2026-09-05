import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { backgroundApplyMethods } from '../scripts/domains/backgrounds/image-pipeline.js';

async function loadFirstPaintScript() {
    vi.resetModules();
    delete globalThis.__AURA_FIRST_PAINT__;
    await import('../scripts/boot/first-paint.js');
    return globalThis.__AURA_FIRST_PAINT__;
}

describe('first paint boot script', () => {
    beforeEach(() => {
        localStorage.clear();
        delete globalThis.__AURA_FIRST_PAINT__;
        document.documentElement.style.removeProperty('--solid-background');
        document.documentElement.style.backgroundColor = '';
        document.documentElement.style.backgroundImage = '';
        document.documentElement.removeAttribute('data-first-paint');
        if (document.body) {
            document.body.style.backgroundColor = '';
            document.body.style.backgroundImage = '';
        }
    });

    afterEach(() => {
        document.getElementById('first-paint-overlay')?.remove();
    });

    it('arms first paint with stored color', async () => {
        localStorage.setItem('aura:firstPaintColor', '#123456');

        const api = await loadFirstPaintScript();

        expect(api).toBeTruthy();
        expect(document.documentElement.dataset.firstPaint).toBe('armed');
        expect(document.documentElement.style.getPropertyValue('--solid-background')).toBe('#123456');
    });

    it('falls back to default color when stored color is invalid', async () => {
        localStorage.setItem('aura:firstPaintColor', 'not-a-color');

        const api = await loadFirstPaintScript();

        expect(api).toBeTruthy();
        expect(document.documentElement.style.getPropertyValue('--solid-background')).toBe('#1a1a2e');
    });

    it('disarmFirstPaint completes immediately for pure-color mode (no overlay)', async () => {
        // No snapshot stored → no overlay created → disarm should be instant
        localStorage.setItem('aura:firstPaintColor', '#aabbcc');
        const api = await loadFirstPaintScript();

        api.disarmFirstPaint();

        expect(document.documentElement.dataset.firstPaint).toBe('done');
        expect(document.documentElement.style.backgroundColor).toBe('');
    });

    it('disarmFirstPaint is idempotent', async () => {
        localStorage.setItem('aura:firstPaintColor', '#112233');
        const api = await loadFirstPaintScript();

        api.disarmFirstPaint();
        api.disarmFirstPaint();

        expect(document.documentElement.dataset.firstPaint).toBe('done');
        expect(document.documentElement.style.backgroundColor).toBe('');
    });

    it('persistFirstPaintColor persists valid colors only', async () => {
        const api = await loadFirstPaintScript();

        expect(api.persistFirstPaintColor('#abcdef')).toBe(true);
        expect(localStorage.getItem('aura:firstPaintColor')).toBe('#abcdef');

        expect(api.persistFirstPaintColor('bad-color')).toBe(false);
        expect(localStorage.getItem('aura:firstPaintColor')).toBe('#abcdef');
    });

    it('renders the stored snapshot image on the first paint overlay', async () => {
        const snapshot = {
            v: 1,
            backgroundId: 'background-1',
            color: '#224466',
            previewDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
            size: 'cover',
            position: '50% 50%',
            repeat: 'no-repeat',
            ts: Date.now()
        };
        localStorage.setItem('aura:firstPaintSnapshot', JSON.stringify(snapshot));
        localStorage.setItem('aura:firstPaintTarget', 'background-1');
        localStorage.setItem('aura:firstPaintColor', '#ffffff');

        await loadFirstPaintScript();

        expect(document.documentElement.style.getPropertyValue('--solid-background')).toBe('#224466');
        const overlay = document.getElementById('first-paint-overlay');
        expect(overlay).toBeTruthy();
        expect(overlay.style.backgroundImage).toContain('data:image/jpeg;base64,ZmFrZQ==');
        expect(document.documentElement.style.backgroundImage).toBe('');
    });

    it('does not render a stale snapshot for another background target', async () => {
        const snapshot = {
            v: 1,
            backgroundId: 'old-background',
            color: '#334455',
            previewDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
            size: 'cover',
            position: '50% 50%',
            repeat: 'no-repeat',
            ts: Date.now()
        };
        localStorage.setItem('aura:firstPaintSnapshot', JSON.stringify(snapshot));
        localStorage.setItem('aura:firstPaintTarget', 'new-background');
        localStorage.setItem('aura:firstPaintColor', '#445566');

        await loadFirstPaintScript();

        expect(document.documentElement.style.getPropertyValue('--solid-background')).toBe('#445566');
        expect(document.getElementById('first-paint-overlay')).toBeNull();
    });

    it('disarmFirstPaint removes the snapshot overlay without a fade', async () => {
        vi.useFakeTimers();
        const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
        localStorage.setItem('aura:firstPaintSnapshot', JSON.stringify({
            v: 1,
            color: '#224466',
            previewDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
            size: 'cover',
            position: '50% 50%',
            repeat: 'no-repeat',
            ts: Date.now()
        }));

        const api = await loadFirstPaintScript();
        api.disarmFirstPaint();

        expect(document.documentElement.dataset.firstPaint).toBe('done');
        expect(document.getElementById('first-paint-overlay')).toBeNull();
        expect(rafSpy).not.toHaveBeenCalled();

        rafSpy.mockRestore();
        vi.useRealTimers();
    });

    it('persistFirstPaintSnapshot persists snapshot and syncs first-paint color', async () => {
        const api = await loadFirstPaintScript();
        const ok = api.persistFirstPaintSnapshot({
            backgroundId: 'background-1',
            color: '#556677',
            previewDataUrl: 'data:image/jpeg;base64,AAAA',
            size: 'cover',
            position: '40% 60%',
            repeat: 'no-repeat',
            ts: Date.now()
        });

        expect(ok).toBe(true);
        expect(localStorage.getItem('aura:firstPaintColor')).toBe('#556677');

        const rawSnapshot = localStorage.getItem('aura:firstPaintSnapshot');
        expect(rawSnapshot).toBeTruthy();
        const parsed = JSON.parse(rawSnapshot);
        expect(parsed.backgroundId).toBe('background-1');
        expect(parsed.color).toBe('#556677');
        expect(parsed.previewDataUrl).toBe('data:image/jpeg;base64,AAAA');
    });
});

describe('background first-paint color persistence', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        delete globalThis.__AURA_FIRST_PAINT__;
        document.documentElement.style.removeProperty('--solid-background');
        document.documentElement.style.removeProperty('--ct-wallpaper-color');
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        delete globalThis.__AURA_FIRST_PAINT__;
        vi.clearAllMocks();
    });

    it('does not persist fallback solid color when payload color is missing', () => {
        document.documentElement.style.setProperty('--solid-background', '#101820');

        const persistSpy = vi.fn();
        globalThis.__AURA_FIRST_PAINT__ = { persistFirstPaintColor: persistSpy };

        const ctx = { wrapper: { dataset: { type: 'files' } } };
        backgroundApplyMethods._emitBackgroundApplied.call(ctx, {
            type: 'files',
            element: null,
            color: null
        });

        expect(persistSpy).not.toHaveBeenCalled();
        expect(document.documentElement.style.getPropertyValue('--ct-wallpaper-color').trim()).toBe('#101820');
    });

    it('persists explicit color when payload color is available', () => {
        const persistSpy = vi.fn();
        const targetSpy = vi.fn();
        globalThis.__AURA_FIRST_PAINT__ = {
            persistFirstPaintColor: persistSpy,
            persistFirstPaintTarget: targetSpy
        };

        const ctx = { wrapper: { dataset: { type: 'files' } } };
        backgroundApplyMethods._emitBackgroundApplied.call(ctx, {
            type: 'files',
            background: { id: 'background-1' },
            element: null,
            color: '  #aabbcc  '
        });

        expect(targetSpy).toHaveBeenCalledWith('background-1');
        expect(persistSpy).toHaveBeenCalledWith('#aabbcc');
        expect(document.documentElement.style.getPropertyValue('--ct-wallpaper-color').trim()).toBe('#aabbcc');
    });

    it('clears the first-paint target for a pure-color background', () => {
        const targetSpy = vi.fn();
        globalThis.__AURA_FIRST_PAINT__ = {
            persistFirstPaintTarget: targetSpy
        };

        const ctx = { wrapper: { dataset: { type: 'color' } } };
        backgroundApplyMethods._emitBackgroundApplied.call(ctx, {
            type: 'color',
            background: null,
            element: null,
            color: '#ddeeff'
        });

        expect(targetSpy).toHaveBeenCalledWith(null);
    });

    it('persists a decoded preview immediately instead of waiting for idle image loading', async () => {
        const persistSnapshotSpy = vi.fn();
        globalThis.__AURA_FIRST_PAINT__ = {
            persistFirstPaintSnapshot: persistSnapshotSpy,
            persistFirstPaintTarget: vi.fn()
        };

        const ctx = { wrapper: { dataset: { type: 'files' } } };
        backgroundApplyMethods._emitBackgroundApplied.call(ctx, {
            type: 'files',
            background: { id: 'background-2' },
            element: null,
            color: '#ccddee',
            previewDataUrl: 'data:image/jpeg;base64,AAAA'
        });

        await vi.runAllTimersAsync();

        expect(persistSnapshotSpy).toHaveBeenCalledTimes(1);
        expect(persistSnapshotSpy.mock.calls[0][0]).toMatchObject({
            backgroundId: 'background-2',
            color: '#ccddee',
            previewDataUrl: 'data:image/jpeg;base64,AAAA'
        });
    });

    it('persists first-paint snapshot when explicit color is available', async () => {
        const persistColorSpy = vi.fn();
        const persistSnapshotSpy = vi.fn();
        const targetSpy = vi.fn();
        globalThis.__AURA_FIRST_PAINT__ = {
            persistFirstPaintColor: persistColorSpy,
            persistFirstPaintSnapshot: persistSnapshotSpy,
            persistFirstPaintTarget: targetSpy
        };

        const ctx = { wrapper: { dataset: { type: 'files' } } };
        backgroundApplyMethods._emitBackgroundApplied.call(ctx, {
            type: 'files',
            background: { id: 'background-1' },
            element: null,
            color: '#ccddee'
        });

        await vi.runAllTimersAsync();

        expect(targetSpy).toHaveBeenCalledWith('background-1');
        expect(persistColorSpy).toHaveBeenCalledWith('#ccddee');
        expect(persistSnapshotSpy).toHaveBeenCalledTimes(1);
        const persistedSnapshot = persistSnapshotSpy.mock.calls[0][0];
        expect(persistedSnapshot.backgroundId).toBe('background-1');
        expect(persistedSnapshot.color).toBe('#ccddee');
        expect(persistedSnapshot.previewDataUrl).toBeNull();
    });
});

describe('newtab first paint markup', () => {
    it('keeps the body transparent while the first-paint preview is armed', async () => {
        const cssPath = path.join(process.cwd(), 'styles/bundle.css');
        const css = await fs.readFile(cssPath, 'utf8');
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        document.documentElement.dataset.firstPaint = 'armed';
        document.body.style.setProperty('background-color', '#123456');

        expect(getComputedStyle(document.body).backgroundColor).toBe('rgba(0, 0, 0, 0)');

        style.remove();
        document.body.style.removeProperty('background-color');
        document.documentElement.removeAttribute('data-first-paint');
    });

    it('body does not use inline background styles overriding persisted first-paint color', async () => {
        const filePath = path.join(process.cwd(), 'newtab.html');
        const html = await fs.readFile(filePath, 'utf8');
        const bodyTag = html.match(/<body\b[^>]*>/i)?.[0] ?? '';

        expect(bodyTag).not.toMatch(/\bstyle\s*=\s*["'][^"']*\bbackground(?:-color)?\s*:/i);
    });
});
