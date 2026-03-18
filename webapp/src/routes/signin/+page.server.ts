import { signIn } from '../../auth';
import type { Actions, PageServerLoad } from "./$types"
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, url }) => {
    // If we're in local mode and somehow ended up here, just redirect to home
    // The hooks.server.ts will automatically authenticate us
    const isLocal = env.LOCAL === 'true' || process.env.LOCAL === 'true';
    if (isLocal) {
        const redirectTo = url.searchParams.get('redirectTo') || '/';
        throw redirect(303, redirectTo);
    }
    
    // If already logged in, redirect away
    if (locals.user) {
        const redirectTo = url.searchParams.get('redirectTo') || '/';
        throw redirect(303, redirectTo);
    }
};

export const actions: Actions = {default: signIn}