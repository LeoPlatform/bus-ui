import type { HighlighterCore } from "shiki";

let instance: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
    if (!instance) {
        instance = import("shiki").then((m) =>
            m.createHighlighter({
                themes: ["github-dark"],
                langs: ["json"],
            }),
        );
    }
    return instance;
}
