import { writable } from "svelte/store";
import type { AuthProviderType } from "./config";
import { browser } from "$app/environment";

// Store to track the available auth providers
export const availableProviders = writable<AuthProviderType[]>([]);

// Function to initialize available providers (called from +layout.svelte)
export async function initAvailableProviders(): Promise<void> {
  if (browser) {
    try {
      // Fetch available providers from the server
      const response = await fetch('/api/auth/providers');
      if (response.ok) {
        const providers = await response.json();
        availableProviders.set(providers);
      } else {
        console.error('Failed to fetch available providers');
        availableProviders.set([]);
      }
    } catch (error) {
      console.error('Error fetching available providers:', error);
      availableProviders.set([]);
    }
  }
}