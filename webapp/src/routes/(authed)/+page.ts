import { error } from "@sveltejs/kit";

export async function load({parent}) {
    const {botData} = await parent();

    if (!botData || botData.length == 0) {
        error(500, 'Failed to load bot settings')
    } else {
        return {
           botData
        }
    }
}