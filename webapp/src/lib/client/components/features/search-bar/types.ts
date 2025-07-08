import type { NodeType } from "$lib/types";

export interface SearchItem {
    name?: string;
    id: string;
    type: NodeType;
}

export interface ResourcesApiResponse {
    items: SearchItem[];
}