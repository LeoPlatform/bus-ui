import type { Preview } from '@storybook/svelte';

const preview: Preview = {
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
