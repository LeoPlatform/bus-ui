import { redirect } from "@sveltejs/kit";

export async function load({locals}) {
    const session = await locals.auth();
    
    // if(!session?.user) {
        
    //     throw redirect(303, `/signin?redirectTo=${'/'}`)
    // }

    return {
        user: session?.user
    }
}