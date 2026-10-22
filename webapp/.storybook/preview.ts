import type { Preview } from '@storybook/svelte';

import { applyResolvedTheme, type ResolvedTheme } from '../src/lib/client/theme-mode';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [
    (story, context) => {
      if (typeof document !== 'undefined') {
        applyResolvedTheme(document.documentElement, context.globals.theme as ResolvedTheme);
      }
      return story();
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // addon-svelte-csf's source-snippet effect reads `parameters.__svelteCsf.rawCode`. Under
    // the vitest storybook (browser) runner the csf source metadata isn't injected, so that
    // read throws during render. Defaulting `__svelteCsf` here makes the effect skip source
    // emission (rawCode is undefined) instead of crashing, so the play tests can run.
    __svelteCsf: {},
  },
};

export default preview;
