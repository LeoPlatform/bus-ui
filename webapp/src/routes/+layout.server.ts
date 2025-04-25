import { getRelationShips } from "$lib/services/dynamoService";

export async function load() {
    const relationship =  await getRelationShips();
    return {
        botData: relationship
    }
    
}