<script lang="ts">
    import { browser } from "$app/environment";
    import { getHighlighter } from "./highlighter";

    type CodeViewProps = {
        code: string;
        lang?: string;
    };

    let { code, lang = "json" }: CodeViewProps = $props();

    let html = $state("");

    $effect(() => {
        if (!browser || !code) {
            html = "";
            return;
        }

        let cancelled = false;

        getHighlighter().then((highlighter) => {
            if (cancelled) return;
            html = highlighter.codeToHtml(code, {
                lang,
                theme: "github-dark",
            });
        });

        return () => {
            cancelled = true;
        };
    });
</script>

{#if html}
    <div class="code-view overflow-auto rounded-md text-xs [&_pre]:!bg-transparent [&_pre]:p-3 [&_pre]:m-0 [&_code]:break-all [&_code]:whitespace-pre-wrap">
        {@html html}
    </div>
{:else}
    <pre class="font-mono text-xs whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3">{code}</pre>
{/if}
