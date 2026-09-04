(function bootstrapFirstPaint(global) {
    const API_KEY = '__AURA_FIRST_PAINT__';
    const STORAGE_KEY = 'aura:firstPaintColor';
    const SNAPSHOT_STORAGE_KEY = 'aura:firstPaintSnapshot';
    const TARGET_STORAGE_KEY = 'aura:firstPaintTarget';
    const FALLBACK_COLOR = '#1a1a2e';
    const SNAPSHOT_VERSION = 1;
    const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
    const SAFE_STYLE_STRING = /^[a-zA-Z0-9%(),.\s/#-]+$/;
    const SAFE_BACKGROUND_ID = /^[a-zA-Z0-9_-]{1,200}$/;
    const SAFE_PREVIEW_DATA_URL = /^data:image\/(?:bmp|gif|jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i;

    function normalizeColor(input) {
        if (typeof input !== 'string') return null;
        const value = input.trim();
        if (!value) return null;

        if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
            return CSS.supports('color', value) ? value : null;
        }

        if (/^#(?:[\da-fA-F]{3}|[\da-fA-F]{4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/.test(value)) {
            return value;
        }
        if (/^rgba?\(([^)]+)\)$/i.test(value)) {
            return value;
        }
        return null;
    }

    function readStoredColor() {
        try {
            if (typeof localStorage === 'undefined') return null;
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    }

    function writeStoredColor(color) {
        const safeColor = normalizeColor(color);
        if (!safeColor) return false;

        try {
            if (typeof localStorage === 'undefined') return false;
            localStorage.setItem(STORAGE_KEY, safeColor);
            return true;
        } catch {
            return false;
        }
    }

    function normalizeBackgroundId(input) {
        if (typeof input !== 'string') return null;
        const value = input.trim();
        return SAFE_BACKGROUND_ID.test(value) ? value : null;
    }

    function readStoredTarget() {
        try {
            if (typeof localStorage === 'undefined') return undefined;
            const value = localStorage.getItem(TARGET_STORAGE_KEY);
            return value === null ? undefined : normalizeBackgroundId(value);
        } catch {
            return undefined;
        }
    }

    function normalizeStyleString(input, fallback) {
        if (typeof input !== 'string') return fallback;
        const value = input.trim();
        if (!value || value.length > 64) return fallback;
        return SAFE_STYLE_STRING.test(value) ? value : fallback;
    }

    function normalizePreviewDataUrl(input) {
        if (typeof input !== 'string') return null;
        const value = input.trim();
        if (!value || value.length > 2_000_000) return null;
        return SAFE_PREVIEW_DATA_URL.test(value) ? value : null;
    }

    function normalizeSnapshot(input) {
        if (!input || typeof input !== 'object') return null;

        const color = normalizeColor(input.color) || FALLBACK_COLOR;
        const previewDataUrl = normalizePreviewDataUrl(input.previewDataUrl);
        const size = normalizeStyleString(input.size, 'cover');
        const position = normalizeStyleString(input.position, '50% 50%');
        const repeat = normalizeStyleString(input.repeat, 'no-repeat');
        const tsRaw = Number(input.ts);
        const ts = Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : Date.now();

        return {
            v: SNAPSHOT_VERSION,
            backgroundId: normalizeBackgroundId(input.backgroundId),
            color,
            previewDataUrl,
            size,
            position,
            repeat,
            ts
        };
    }

    function readStoredSnapshot() {
        try {
            if (typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const snapshot = normalizeSnapshot(parsed);
            if (!snapshot) return null;
            if (Date.now() - snapshot.ts > SNAPSHOT_MAX_AGE_MS) return null;
            return snapshot;
        } catch {
            return null;
        }
    }

    function writeStoredSnapshot(snapshot) {
        const normalized = normalizeSnapshot(snapshot);
        if (!normalized) return false;

        try {
            if (typeof localStorage === 'undefined') return false;
            localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(normalized));
            writeStoredColor(normalized.color);
            return true;
        } catch {
            return false;
        }
    }

    function applyColor(color, { armed = false } = {}) {
        if (typeof document === 'undefined') {
            return normalizeColor(color) || FALLBACK_COLOR;
        }

        const safeColor = normalizeColor(color) || FALLBACK_COLOR;
        const root = document.documentElement;
        root?.style?.setProperty('--solid-background', safeColor);
        if (root) {
            root.style.backgroundColor = safeColor;
            if (armed) {
                root.dataset.firstPaint = 'armed';
            }
        }

        if (document.body) {
            document.body.style.backgroundColor = safeColor;
        }

        return safeColor;
    }

    function isSnapshotForTarget(snapshot, target) {
        if (target === undefined) return true;
        if (target === null) return !snapshot.previewDataUrl;
        return snapshot.backgroundId === target;
    }

    function createFirstPaintOverlay(snapshot) {
        if (typeof document === 'undefined') return;
        if (!snapshot.previewDataUrl) return;
        if (document.getElementById('first-paint-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'first-paint-overlay';

        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.contain = 'strict';
        overlay.style.backgroundColor = snapshot.color;
        overlay.style.backgroundImage = `url("${snapshot.previewDataUrl}")`;
        overlay.style.backgroundSize = snapshot.size;
        overlay.style.backgroundPosition = snapshot.position;
        overlay.style.backgroundRepeat = snapshot.repeat;

        document.documentElement.appendChild(overlay);
    }

    function applySnapshot(snapshot, { armed = false } = {}) {
        const normalized = normalizeSnapshot(snapshot);
        if (!normalized) {
            return applyColor(readStoredColor(), { armed });
        }

        const target = readStoredTarget();
        if (!isSnapshotForTarget(normalized, target)) {
            return applyColor(readStoredColor(), { armed });
        }

        // The preview image is used for the first visual frame. The background
        // system removes this overlay only after the full wallpaper has painted.
        const appliedColor = applyColor(normalized.color, { armed });
        createFirstPaintOverlay(normalized);
        return appliedColor;
    }

    function armFirstPaint() {
        const snapshot = readStoredSnapshot();
        if (snapshot) {
            return applySnapshot(snapshot, { armed: true });
        }
        return applyColor(readStoredColor(), { armed: true });
    }

    function disarmFirstPaint() {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        if (!root) return;

        root.style.removeProperty('background-color');
        if (document.body) {
            document.body.style.removeProperty('background-color');
        }

        const overlay = document.getElementById('first-paint-overlay');
        if (overlay) {
            overlay.remove();
        }

        root.dataset.firstPaint = 'done';
    }

    function persistFirstPaintColor(color) {
        return writeStoredColor(color);
    }

    function persistFirstPaintSnapshot(snapshot) {
        return writeStoredSnapshot(snapshot);
    }

    function persistFirstPaintTarget(backgroundId) {
        const safeId = normalizeBackgroundId(backgroundId);
        try {
            if (typeof localStorage === 'undefined') return false;
            localStorage.setItem(TARGET_STORAGE_KEY, safeId || '');
            return true;
        } catch {
            return false;
        }
    }

    const api = {
        STORAGE_KEY,
        SNAPSHOT_STORAGE_KEY,
        TARGET_STORAGE_KEY,
        FALLBACK_COLOR,
        normalizeColor,
        normalizeSnapshot,
        readStoredSnapshot,
        armFirstPaint,
        disarmFirstPaint,
        persistFirstPaintColor,
        persistFirstPaintSnapshot,
        persistFirstPaintTarget
    };

    global[API_KEY] = api;
    api.armFirstPaint();
})(globalThis);
