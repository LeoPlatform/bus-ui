<script lang="ts">
  import { NodeType } from "$lib/types";
  import { getLogicalId, getNodeTypeLink } from "$lib/utils";
  import { assets, base } from "$app/paths";
  import { Button } from "../../ui/button";
  import ListTree from '@lucide/svelte/icons/list-tree';
  import { Label } from "../../ui/label";
  import type { DashboardTag } from "./types";
  import * as Tooltip from "$lib/client/components/ui/tooltip/index";
  import { Badge } from "../../ui/badge";
  import Tag from "@lucide/svelte/icons/tag";
  import CheckpointActionBar from "./checkpoint-action-bar.svelte";
  import { getContext } from "svelte";
  import type { AppState } from "$lib/client/appstate.svelte";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

    type DashHeaderProps = {
        name: string;
        id: string;
        type: NodeType;
        currentCheckpoint?: string;
        lambdaName?: string;
        lambdaRegion?: string;
        tags?: DashboardTag;
        isPaused?: boolean;
    }

    let {name, id, type, currentCheckpoint, lambdaName, lambdaRegion = 'us-east-1', tags, isPaused}: DashHeaderProps = $props();

    const appState = getContext<AppState>("appState");

    // Look up alarm status from BotState (populated by fetchBotStats)
    let botEntry = $derived(appState.botState.botSettings.find((b) => b.id === id));
    let isAlarmed = $derived(botEntry?.isAlarmed ?? false);
    let alarms = $derived(botEntry?.alarms);
    
    let awsUrl = $derived.by(() => {
        if (lambdaName && lambdaRegion) {
            return `https://${lambdaRegion}.console.aws.amazon.com/lambda/home?region=${lambdaRegion}#/functions/${lambdaName}`;
        }
        return undefined;
    });

    let repoUrl = $derived.by(() => {
        if(tags?.repo && tags.repo.match(/^https?:\/\//)) { 
            return `https://${tags.repo}`;
        } else if (tags?.repo) {
            return tags.repo;
        }
        return undefined;
    });

    let repoImagePath: string | undefined = $derived.by(() => {
        if(repoUrl) {
            try {
                const url = new URL(repoUrl);
                const hostname = url.hostname;
                const hostnamesImages: Record<string, string> = {
                    "github.com": "github-mark.png",
                    "bitbucket.org": "bitbucket-mark.png",
                    "gitlab.com": "gitlab-mark.png",
                    "git": "git.png"
                };
                const image = hostnamesImages[hostname] || hostnamesImages.git;
                return '/repo/' + image;
            } catch (error) {
                console.warn('Invalid repo URL:', repoUrl, error);
                return undefined;
            }
        }
        return undefined;
    });

    



</script>


<div class="flex flex-row overflow-hidden w-full items-start">
    <div class="relative shrink-0 mr-4">
        <img src={getNodeTypeLink(type)} alt={type} class="w-16 h-16 object-contain" class:opacity-40={isPaused} class:grayscale={isPaused} />
        {#if isPaused}
            <div class="absolute inset-0 flex items-center justify-center">
                <svg class="w-6 h-6 text-amber-400 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            </div>
        {/if}
    </div>
    <div class="flex flex-col no-wrap overflow-hidden gap-1">
        <div class="flex flex-row gap-2 items-center">
            <div class="text-2xl font-bold text-foreground">
                {name}
            </div>
            {#if isPaused}
                <Badge variant="outline" class="border-amber-500/50 bg-amber-500/15 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                    Paused
                </Badge>
            {/if}
            {#if isAlarmed && alarms}
                <Tooltip.Provider>
                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            <div class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-1">
                                <TriangleAlert class="size-4 text-amber-500 shrink-0" />
                                <div class="flex flex-col text-xs leading-tight">
                                    {#each Object.values(alarms) as alarm}
                                        <span class="text-amber-400 font-medium">{alarm.msg}</span>
                                    {/each}
                                </div>
                            </div>
                        </Tooltip.Trigger>
                        <Tooltip.Content class="max-w-xs">
                            <span class="text-xs">Click a queue in the tables below for details</span>
                        </Tooltip.Content>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
            <Tooltip.Provider >
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        
                        <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => appState.navigateToRelationshipView(id)}>
                            <ListTree class="size-5" />
                        </Button>
                        
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        Go to Workflow View
                    </Tooltip.Content>
                </Tooltip.Root>

            </Tooltip.Provider>
            {#if awsUrl}
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <a href={awsUrl} target="_blank" aria-label="View in AWS Lambda" class="flex items-center justify-center h-8 w-8 hover:bg-accent rounded-md">
                            <img src={`${assets || base}/aws/lambda.png`} class="w-6 h-6 object-contain" alt="AWS Lambda" />
                        </a>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        View in AWS Lambda
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
            {/if}
            {#if repoUrl && repoImagePath}
            <Tooltip.Provider>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <a href={repoUrl} target="_blank" aria-label="View in Repo" class="flex items-center justify-center h-8 w-8 hover:bg-accent rounded-md">
                            <img src={repoImagePath} class="w-6 h-6 object-contain dark:invert" alt="Repo" />
                        </a>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        View in Repo
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
            {/if}
        </div>

        <div class="flex flex-row gap-2 items-center">
            <Label class="text-muted-foreground text-xs uppercase tracking-wider font-semibold">ID</Label>
            <div class="text-muted-foreground text-sm font-mono">
                {getLogicalId({id, type})}
            </div>
        </div>

        {#if tags && Object.keys(tags).length > 0}
            <div class="flex flex-row gap-2 mt-1 flex-wrap">
                {#each Object.entries(tags) as [key, value]}
                    {#if key !== 'repo'}
                        <Badge variant="secondary" class="bg-lime-600/20 text-lime-600 dark:bg-lime-500/20 dark:text-lime-400 hover:bg-lime-600/30 border-0">
                            <Tag class="w-3 h-3 mr-1" />
                            {key}: {value}
                        </Badge>
                    {/if}
                {/each}
            </div>
        {/if}


    </div>
    <div class="grow shrink-0"></div>
    {#if type === NodeType.Bot}
        <div class="flex flex-row gap-2 p-2">
            <CheckpointActionBar currentCheckpoint={currentCheckpoint} isPaused={isPaused} />
        </div>
    {/if}
</div>

<!-- <div class="flex flex-col"> 
    <div class="flex flex-row items-center gap-1">
        <img src={getNodeTypeLink(type)} alt={type} class="w-10 h-10" />
        <div class="flex flex-row items-center gap-1">
            <div class="text-2xl font-bold">
                {name}
            </div>
            <Button variant="ghost" size="icon">
                <ListTree size={24} />
            </Button>

        </div>
    </div>
    <div class="flex flex-row items-center gap-1">
        <Label class="text-gray-500"> ID </Label>
        <div class="text-gray-500">
            {id}
        </div>
    </div>

</div> -->