<script lang="ts">
    interface ClientAuthData {
        adminTokenUrl: string;
        tokenUrl: string;
        loginUrl: string;
        adminLoginUrl: string;
    }

    interface Props {
        data: {
            customData: ClientAuthData | undefined;
        };
    }

    const { data }: Props = $props();
    const { customData } = data;

    import { onMount } from 'svelte';
    import { dev } from '$app/environment';

    let statusMessages = $state<string[]>([]);
    let authStarted = false;

    /**
     * In local dev, DSCO endpoints are CORS-blocked from localhost.
     * Vite proxy rewrites /dsco-proxy/* → https://{stage}-core.dsco.io/*
     * In production the URL is used as-is.
     */
    function proxyUrl(dscoUrl: string): string {
        if (!dev) return dscoUrl;
        try {
            const u = new URL(dscoUrl);
            // e.g. https://test-core.dsco.io/micro-service/dw-auth-token → /dsco-proxy/micro-service/dw-auth-token
            return '/dsco-proxy' + u.pathname;
        } catch {
            return dscoUrl;
        }
    }

    function log(msg: string) {
        console.log(msg);
        statusMessages = [...statusMessages, msg];
    }

    onMount(() => {
        if (authStarted) return;
        authStarted = true;
        if (customData) {
            doClientAuth();
        } else {
            document.location.href = '/signin';
        }
    });

    async function doClientAuth() {
        if (!customData) return;

        try {
            const redirectUrl = getRedirectUrlFromDasCookie();
            log(`Redirect URL from das cookie: ${redirectUrl}`);
            const urls = [customData.tokenUrl, customData.adminTokenUrl];
            let authRedirectUrl: string | undefined;
            let lastError: unknown;
            let lastErrorStr: string | undefined;

            for (const url of urls) {
                const isNormal = url === customData.tokenUrl;
                const loginUrl = isNormal ? customData.loginUrl : customData.adminLoginUrl;

                try {
                    const fetchUrl = proxyUrl(url);
                    log(`Trying ${isNormal ? 'normal' : 'admin'}: ${url}${dev ? ` (proxied → ${fetchUrl})` : ''}`);
                    const res = await fetch(fetchUrl, { credentials: 'include' });
                    log(`Response: ${res.status} ${res.statusText}`);
                    const text = await res.text();
                    log(`Body (first 500): ${text.substring(0, 500)}`);

                    // 401/403 means not authenticated with DSCO — need to log in
                    if (res.status === 401 || res.status === 403) {
                        log(`${res.status} — need DSCO login at ${loginUrl}`);
                        authRedirectUrl = loginUrl;
                        lastErrorStr = 'authentication required';
                        continue;
                    }

                    // Detect SSO HTML redirect page
                    if (text.includes('window.location.href') && text.includes('dsco.io')) {
                        log(`SSO HTML redirect detected → ${loginUrl}`);
                        authRedirectUrl = loginUrl;
                        lastErrorStr = 'authentication required';
                        continue;
                    }

                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(text);
                    } catch {
                        log(`JSON parse failed for ${url}`);
                        lastError = 'JSON parse error';
                        continue;
                    }

                    if (
                        parsed &&
                        typeof parsed === 'object' &&
                        'data' in parsed &&
                        parsed.data &&
                        typeof parsed.data === 'object' &&
                        'redirect' in (parsed.data as object)
                    ) {
                        log(`JSON redirect field detected → ${loginUrl}`);
                        authRedirectUrl = loginUrl;
                        lastErrorStr = 'authentication required';
                        continue;
                    }

                    if (
                        parsed &&
                        typeof parsed === 'object' &&
                        'errors' in parsed &&
                        Array.isArray((parsed as { errors: unknown[] }).errors) &&
                        (parsed as { errors: unknown[] }).errors.length > 0
                    ) {
                        const errors = (parsed as { errors: { message?: string }[] }).errors;
                        lastError = errors;
                        lastErrorStr = errors.map((e) => e.message ?? '').join(' ').toLowerCase();
                        log(`Errors in response: ${lastErrorStr}`);
                        continue;
                    }

                    if (
                        !parsed ||
                        typeof parsed !== 'object' ||
                        !('token' in parsed) ||
                        !(parsed as { token?: string }).token
                    ) {
                        log(`No token in response from ${url}. Keys: ${parsed && typeof parsed === 'object' ? Object.keys(parsed).join(', ') : 'N/A'}`);
                        lastError = 'No token found';
                        continue;
                    }

                    const { token, identity_id: identityId } = parsed as { token: string; identity_id: string };
                    log(`SUCCESS! Got token from ${isNormal ? 'normal' : 'admin'} endpoint. identity_id: ${identityId?.substring(0, 20)}...`);

                    document.cookie = `did=${JSON.stringify({ token, identityId })}; path=/; secure; sameSite=lax`;
                    deleteDasCookie();

                    log(`Redirecting to: ${redirectUrl}`);
                    document.location.href = redirectUrl;
                    return;
                } catch (e) {
                    log(`Fetch ERROR for ${url}: ${e}`);
                    lastError = e;
                }
            }

            // Both endpoints failed/redirected
            if (authRedirectUrl) {
                log(`All endpoints need auth → redirecting to: ${authRedirectUrl}`);
                document.location.href = authRedirectUrl;
                return;
            }

            // Handle specific error messages
            if (lastErrorStr) {
                if (lastErrorStr.includes('expired') || lastErrorStr.includes('log in') || lastErrorStr.includes('login')) {
                    log(`Error indicates login needed → ${customData.loginUrl}`);
                    document.location.href = customData.loginUrl;
                    return;
                }
            }

            log(`ALL FAILED. lastError: ${lastError}, lastErrorStr: ${lastErrorStr}`);
            // Don't redirect immediately — let the user see the logs
        } catch (err) {
            log(`FATAL ERROR: ${err}`);
        }
    }

    function getRedirectUrlFromDasCookie(): string {
        const raw = document.cookie
            .split('; ')
            .find((row) => row.startsWith('das='))
            ?.split('=')
            .slice(1)
            .join('=');

        if (raw) {
            try {
                const decoded = decodeURIComponent(raw);
                const parsed = JSON.parse(decoded);
                if (parsed?.redirectUrl) return parsed.redirectUrl as string;
            } catch { /* fall through */ }
        }
        return '/';
    }

    function deleteDasCookie() {
        document.cookie = 'das=; path=/; secure; sameSite=lax; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
</script>

<div class="flex flex-col justify-center items-center h-screen bg-background text-foreground p-8">
    <div class="text-lg mb-4">Authenticating...</div>
    {#if statusMessages.length > 0}
        <div class="w-full max-w-2xl bg-muted rounded-lg p-4 font-mono text-xs overflow-y-auto max-h-96">
            {#each statusMessages as msg}
                <div class="py-0.5 border-b border-muted-foreground/10">{msg}</div>
            {/each}
        </div>
    {/if}
</div>
