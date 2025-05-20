import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";
import { getRelationShips } from "$lib/services/dynamoService.js";


export const load: LayoutServerLoad = async({ locals, url }) => {
    const session = await locals.auth();

    if(!session?.user) {
        console.log('no user found');
        const currentPath = url.pathname + url.search;
        throw redirect(303, `/signin?redirectTo=${encodeURIComponent(currentPath)}`)
    }

    const relationship =  await getRelationShips(session.aws_credentials!);


    return {
        user: session.user,
        botData: relationship
    }
}