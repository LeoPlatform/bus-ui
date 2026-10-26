import { describe, expect, it } from 'vitest';

import { getHighlighter, SHIKI_THEMES, tokenStyle } from '$lib/client/components/ui/code-view/highlighter';

const sample = '{"a": 1, "b": "x", "c": [true, null]}';

describe('code view highlighter', () => {
	it('emits light and dark colors as CSS variables instead of a fixed color', async () => {
		const hl = await getHighlighter();
		const html = hl.codeToHtml(sample, { lang: 'json', themes: SHIKI_THEMES, defaultColor: false });
		expect(html).toContain('--shiki-light:');
		expect(html).toContain('--shiki-dark:');
		expect(html).not.toMatch(/style="color:/);
	});

	it('keeps the dark variable identical to the previous single-theme github-dark colors', async () => {
		const hl = await getHighlighter();
		const legacy = hl.codeToTokens(sample, { lang: 'json', theme: 'github-dark' }).tokens.flat();
		const dual = hl
			.codeToTokens(sample, { lang: 'json', themes: SHIKI_THEMES, defaultColor: false })
			.tokens.flat();
		expect(dual.map((t) => t.content)).toEqual(legacy.map((t) => t.content));
		expect(dual.map((t) => t.htmlStyle?.['--shiki-dark'])).toEqual(legacy.map((t) => t.color));
	});

	it('serialises token styles for the diff view', async () => {
		const hl = await getHighlighter();
		const [token] = hl
			.codeToTokens(sample, { lang: 'json', themes: SHIKI_THEMES, defaultColor: false })
			.tokens.flat();
		const style = tokenStyle(token);
		expect(style).toMatch(/--shiki-light:#[0-9a-f]+/i);
		expect(style).toMatch(/--shiki-dark:#[0-9a-f]+/i);
	});
});
