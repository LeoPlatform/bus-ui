<script lang="ts">
  import { NodeType } from "$lib/types";
  import { getLogicalId, getNodeTypeLink } from "$lib/utils";
  import { Button } from "../../ui/button";
  import ListTree from '@lucide/svelte/icons/list-tree';
  import { Label } from "../../ui/label";
  import type { DashboardTag } from "./types";
  import * as Tooltip from "$lib/client/components/ui/tooltip/index";
  import { Badge } from "../../ui/badge";
  import Tag from "@lucide/svelte/icons/tag";
  import CheckpointActionBar from "./checkpoint-action-bar.svelte";

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


<div class="flex flex-row overflow-hidden w-full">
    <img src={getNodeTypeLink(type)} alt={type} class="w-17 h-17" />
    <div class="flex flex-col no-wrap overflow-hidden">
        <div class="flex flex-row gap-2">
            <div class="text-2xl font-bold">
                {name}
            </div>
            <Tooltip.Provider >
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        
                        <Button variant="ghost" size="icon">
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
                        <a href={awsUrl} target="_blank" aria-label="View in AWS Lambda">
                            <img src={'/aws/lambda.png'} class="w-6 h-6" alt="AWS Lambda" />
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
                        <a href={repoUrl} target="_blank" aria-label="View in Repo">
                            <img src={repoImagePath} class="w-6 h-6" alt="Repo" />
                        </a>
                    </Tooltip.Trigger>
                    <Tooltip.Content>
                        View in Repo
                    </Tooltip.Content>
                </Tooltip.Root>
            </Tooltip.Provider>
            {/if}
        </div>

        <div class="flex flex-row gap-2">
            <Label class="text-gray-500"> ID </Label>
            <div class="text-gray-800">
                {getLogicalId({id, type})}
            </div>
        </div>

        {#if tags && Object.keys(tags).length > 0}
            <div class="flex flex-row gap-2">
                {#each Object.entries(tags) as [key, value]}
                    {#if key !== 'repo'}
                        <Badge variant="secondary" class="bg-lime-600 text-white">
                            <Tag />
                            {key}: {value}
                        </Badge>
                    {/if}
                {/each}
            </div>
        {/if}


    </div>
    <div class="grow shrink-0"></div>
    <div class="flex flex-row gap-2 p-2">
        <CheckpointActionBar currentCheckpoint={currentCheckpoint} isPaused={isPaused} />
    </div>
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