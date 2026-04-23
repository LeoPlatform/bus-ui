import type { ServerLoadEvent } from '@sveltejs/kit';

export async function load({ locals }: ServerLoadEvent): Promise<{ customData: Record<string, unknown> | undefined }> {
    return { customData: (locals as any).customData };
}
