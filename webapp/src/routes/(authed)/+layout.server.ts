import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    const currentPath = url.pathname + url.search;
    throw redirect(303, `${base}/signin?redirectTo=${encodeURIComponent(currentPath)}`);
  }
  return { user: locals.user };
};