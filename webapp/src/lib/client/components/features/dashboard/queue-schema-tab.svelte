<script lang="ts">
    import { getContext } from "svelte";
    import type { AppState } from "$lib/client/appstate.svelte";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "$lib/client/components/ui/card/index";
    import { Button } from "$lib/client/components/ui/button/index";

    let { id }: { id: string } = $props();
    const appState = getContext<AppState>("appState");
    const compState = appState.dashboardState;

    let schemaText = $state<string>('');
    let loading = $state(true);
    let saving = $state(false);
    let saveError = $state<string | null>(null);
    let saveSuccess = $state(false);
    let parseError = $state<string | null>(null);
    let hasSchema = $state(false);
    const schemaPlaceholder = '{"$schema": "http://json-schema.org/draft-07/schema#", "type": "object", "properties": {}}';

    $effect(() => {
        const currentId = id;
        if (!currentId) return;

        let cancelled = false;
        loading = true;
        parseError = null;
        saveError = null;
        saveSuccess = false;

        (async () => {
            try {
                const schema = await compState.getSchema(currentId);
                if (cancelled) return;
                hasSchema = schema !== null;
                schemaText = schema ? JSON.stringify(schema, null, 2) : "";
            } catch {
                if (!cancelled) schemaText = "";
            } finally {
                if (!cancelled) loading = false;
            }
        })();

        return () => {
            cancelled = true;
        };
    });

    function validateJson(text: string): Record<string, any> | null {
        try {
            parseError = null;
            return JSON.parse(text);
        } catch (e: any) {
            parseError = e.message;
            return null;
        }
    }

    function onTextInput(e: Event) {
        const val = (e.target as HTMLTextAreaElement).value;
        schemaText = val;
        // Validate but don't block editing
        if (val.trim()) {
            try {
                JSON.parse(val);
                parseError = null;
            } catch (err: any) {
                parseError = err.message;
            }
        } else {
            parseError = null;
        }
    }

    function formatJson() {
        const parsed = validateJson(schemaText);
        if (parsed) {
            schemaText = JSON.stringify(parsed, null, 2);
        }
    }

    async function saveSchema() {
        const parsed = validateJson(schemaText);
        if (!parsed) return;

        saving = true;
        saveError = null;
        saveSuccess = false;

        try {
            await compState.saveSchema(parsed);
            hasSchema = true;
            saveSuccess = true;
            setTimeout(() => { saveSuccess = false; }, 3000);
        } catch (e: any) {
            saveError = e.message ?? 'Save failed';
        } finally {
            saving = false;
        }
    }
</script>

<div class="space-y-4">
    <Card>
        <CardHeader>
            <CardTitle>Queue Schema</CardTitle>
            <CardDescription>
                JSON Schema definition for events in this queue.
                {#if !hasSchema && !loading}
                    No schema defined yet.
                {/if}
            </CardDescription>
        </CardHeader>
        <CardContent>
            {#if loading}
                <div class="flex items-center justify-center p-8">
                    <p class="text-muted-foreground">Loading schema…</p>
                </div>
            {:else}
                <div class="relative">
                    <textarea
                        class="w-full min-h-[400px] font-mono text-sm bg-background text-foreground border border-border rounded-md p-3 resize-y focus:outline-none focus:ring-1 focus:ring-ring {parseError ? 'border-destructive' : ''}"
                        value={schemaText}
                        oninput={onTextInput}
                        placeholder={schemaPlaceholder}
                        spellcheck={false}
                    ></textarea>
                </div>
                {#if parseError}
                    <p class="text-xs text-destructive mt-1">JSON error: {parseError}</p>
                {/if}
                {#if saveError}
                    <p class="text-sm text-destructive mt-2">{saveError}</p>
                {/if}
                {#if saveSuccess}
                    <p class="text-sm text-green-500 mt-2">Schema saved.</p>
                {/if}
            {/if}
        </CardContent>
        {#if !loading}
            <CardFooter class="flex justify-end gap-2">
                <Button variant="outline" onclick={formatJson} disabled={saving || !!parseError || !schemaText.trim()}>
                    Format JSON
                </Button>
                <Button onclick={saveSchema} disabled={saving || !!parseError || !schemaText.trim()}>
                    {saving ? 'Saving…' : 'Save Schema'}
                </Button>
            </CardFooter>
        {/if}
    </Card>
</div>
