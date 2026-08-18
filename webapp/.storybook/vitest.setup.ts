import { beforeAll } from 'vitest';
import { setProjectAnnotations } from '@storybook/sveltekit';
import * as projectAnnotations from './preview';

// Applies Storybook's project-level annotations (from .storybook/preview) to the portable
// stories the vitest storybook project runs in the browser. Referenced by vitest.workspace.ts.
const project = setProjectAnnotations([projectAnnotations]);

beforeAll(project.beforeAll);
