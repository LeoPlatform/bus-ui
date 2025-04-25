import * as Icons from '$lib/components/icons';
export interface AppState {
    // TODO
}

export type Route = {
    title: string;
    label: string;
    icon: (typeof Icons)[keyof typeof Icons];
    route: string;
    forServicesNotDevs: boolean;
};


export interface BotSettings {
    id: string,
    checkpoints?: Checkpoints
    description?: string,
    errorCount?: number
    name?: string,
    lambdaName?: string,
    paused?: boolean,
    tags?: string,
    trigger?: number,
    triggers?: string[]
    type?: string,
    health?: BotHealth

}

export interface BotHealth {
    write_lag?: number,
    source_lag?: number,
    consecutive_errors?: number,
    error_limit?: number,
}

export interface Checkpoints {
    read?: Record<string, CheckpointDetail>,
    write?: Record<string, CheckpointDetail>,
}

export interface CheckpointDetail {
    checkpoint?: string | number,
    records?: number,
}

export interface RelationshipTree {
    id: string,
    children: RelationshipTree[]
    parents: RelationshipTree[]
}

export interface TreeNode {
    id: string,
    name?: string,
    type: "bot" | "queue" | "system",
    size: number,
    parent?: TreeNode,
    depth: number,
    direction: "left" | "right",
    children: TreeNode[],
    _children: TreeNode[]
}