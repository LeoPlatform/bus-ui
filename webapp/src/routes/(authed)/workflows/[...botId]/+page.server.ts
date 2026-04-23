export async function load({parent}) {


    const {id} = await parent();

    return {
        id: id
    }
    
}


