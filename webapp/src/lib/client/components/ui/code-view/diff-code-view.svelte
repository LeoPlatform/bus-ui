<script lang="ts">
    import { browser } from "$app/environment";
    import { diffJson } from "diff";
    import { getHighlighter } from "./highlighter";
    import type { ThemedToken } from "shiki";

    type DiffCodeViewProps = {
        oldObj: Record<string, unknown>;
        newObj: Record<string, unknown>;
    };

    let { oldObj, newObj }: DiffCodeViewProps = $props();

    type RenderedPart = {
        kind: "added" | "removed" | "unchanged";
        tokens: ThemedToken[][];
    };

    let parts = $state<RenderedPart[]>([]);
    let fallbackParts = $derived(diffJson(oldObj, newObj));
    let ready = $state(false);

    $effect(() => {
        if (!browser) return;

        const diffParts = diffJson(oldObj, newObj);
        let cancelled = false;

        getHighlighter().then((highlighter) => {
            if (cancelled) return;

            const rendered: RenderedPart[] = [];
            for (const part of diffParts) {
                const kind = part.added ? "added" : part.removed ? "removed" : "unchanged";
                const result = highlighter.codeToTokens(part.value, {
                    lang: "json",
                    theme: "github-dark",
                });
                rendered.push({ kind, tokens: result.tokens });
            }
            parts = rendered;
            ready = true;
        });

        return () => {
            cancelled = true;
        };
    });
</script>

{#if ready && parts.length}
    <pre class="font-mono text-xs whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 overflow-auto">{#each parts as part}{#each part.tokens as line, lineIdx}{#if lineIdx > 0}
{/if}{#each line as token}<span
                        class={part.kind === "added"
                            ? "diff-added"
                            : part.kind === "removed"
                              ? "diff-removed"
                              : ""}
                        style:color={token.color}>{token.content}</span>{/each}{/each}{/each}</pre>
{:else}
    <pre class="font-mono text-xs whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 overflow-auto">{#each fallbackParts as part}<span
                class={part.added
                    ? "text-green-600 dark:text-green-400"
                    : part.removed
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"}>{part.value}</span>{/each}</pre>
{/if}

<style>
    .diff-added {
        background-color: rgba(46, 160, 67, 0.15);
    }
    .diff-removed {
        background-color: rgba(248, 81, 73, 0.15);
        text-decoration: line-through;
        text-decoration-color: rgba(248, 81, 73, 0.4);
    }
</style>
