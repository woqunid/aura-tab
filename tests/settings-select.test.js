import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enhanceMacSelects, syncMacSelect } from '../scripts/domains/settings/select.js';

describe('settings select', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('uses the shared menu while keeping the native select change event', () => {
        document.body.innerHTML = `
            <div class="mac-select">
                <select class="mac-select-input">
                    <option value="system">Follow system</option>
                    <option value="zh-CN">简体中文</option>
                </select>
                <span class="mac-select-arrow"></span>
            </div>
        `;
        const select = document.querySelector('select');
        const onChange = vi.fn();
        select.addEventListener('change', onChange);

        enhanceMacSelects(document);

        const trigger = document.querySelector('.mac-select-trigger');
        const menu = document.querySelector('.mac-select-menu');
        expect(trigger?.textContent).toContain('Follow system');

        trigger.click();
        expect(menu.hidden).toBe(false);
        menu.querySelector('[data-value="zh-CN"]').click();

        expect(select.value).toBe('zh-CN');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(menu.hidden).toBe(true);

        select.disabled = true;
        syncMacSelect(select);
        expect(trigger.disabled).toBe(true);
    });
});
