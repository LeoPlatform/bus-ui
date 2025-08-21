import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NodeType } from "./types";
import type { SearchItem } from "./client/components/features/search-bar/types";


export const queueSystemReplaceRegex = /queue:|system:/g;
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function humanize(milliseconds: number, showMilliseconds: boolean = false) {
	if (showMilliseconds && milliseconds < 1000) {
		return Math.round(milliseconds) + 'ms'
	}
	var seconds = Math.round(milliseconds / (1000))
	if (seconds < 60) {
		return seconds + 's'
	} else {
		var minutes = Math.floor(milliseconds / (1000 * 60))
		if (minutes < 60) {
			return minutes + 'm' + (seconds % 60 ? ', ' + (seconds % 60) + 's' : '')
		} else {
			var hours = Math.floor(milliseconds / (1000 * 60 * 60))
			if (hours < 24) {
				return hours + 'h' + (minutes % 60 ? ', ' + (minutes % 60) + 'm' : '')
			} else {
				var days = Math.floor(milliseconds / (1000 * 60 * 60 * 24))
				return days + 'd' + (hours % 24 ? ', ' + (hours % 24) + 'h' : '')
			}
		}
	}
}

export function getNodeTypeLink(nodeType: NodeType): string {
    switch (nodeType) {
		case NodeType.Bot:
			return '/bot.png';
		case NodeType.Queue:
			return '/queue.png';
		case NodeType.System:
			return '/system.png';
		default:
			console.warn('Unknown node type:', nodeType);
			return '/bot.png'; // fallback to bot icon
    }
}

export function getLogicalId(item: SearchItem): string {
	switch (item.type) {
		case 'bot':
			return item.id;
		case 'queue':
			return item.type + ':' + item.id;
		case 'system':
			return item.type + ':' + item.id;
		default:
			return item.id; // fallback to just the id
	}
}