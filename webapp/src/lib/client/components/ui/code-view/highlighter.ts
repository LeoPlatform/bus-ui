import type { HighlighterCore, ThemedToken } from "shiki";

export const SHIKI_THEMES = { light: "github-light", dark: "github-dark" } as const;

export function tokenStyle(token: ThemedToken): string {
    return Object.entries(token.htmlStyle ?? {})
        .map(([prop, value]) => `${prop}:${value}`)
        .join(";");
}

let instance: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
    if (!instance) {
        instance = import("shiki").then((m) =>
            m.createHighlighter({
                themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
                langs: ["json"],
            }),
        );
    }
    return instance;
}
