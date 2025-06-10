export interface LinkStats {
    eventCount: number,
    lastWrite: number,
    linkType: 'read' | 'write';
}