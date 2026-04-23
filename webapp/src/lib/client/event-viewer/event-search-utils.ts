/** Ported from legacy Botmon `payloadSearch.jsx` / `eventViewer.jsx` token + URL helpers. */

const EID_TRIM_RE = /^z\/\d{4}(\/\d{2}){4}\/\d{13}-\d{1,8}$/;

export function buildZTokenFromUtcMs(ms: number): string {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    const y = d.getUTCFullYear();
    const mo = p(d.getUTCMonth() + 1);
    const day = p(d.getUTCDate());
    const h = p(d.getUTCHours());
    const min = p(d.getUTCMinutes());
    return `z/${y}/${mo}/${day}/${h}/${min}/${ms}`;
}

/** Trim trailing sub-event suffix so we start just before the exact EID (legacy behavior). */
export function trimEidToken(token: string): string {
    if (!EID_TRIM_RE.test(token)) return token;
    if (token.slice(-1) === '0') {
        return token.slice(0, -1);
    }
    const last = token.slice(-1);
    const n = parseInt(last, 10);
    return Number.isNaN(n) ? token : token.slice(0, -1) + String(n - 1);
}

/** Legacy allowed ISO-style `z/2024-01-02T...` and normalized to slash form. */
export function normalizeIsoZToken(resumptionToken: string): string {
    if (!/^z\/\d{4}-/.test(resumptionToken)) {
        return resumptionToken;
    }
    const iso = resumptionToken.replace(/^z\//, '');
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid ISO 8601 date: ${iso}`);
    }
    return buildZTokenFromUtcMs(parsed);
}

/**
 * Search text sent as third path segment; strips leading `z/...` token when user pasted EID + filter.
 */
export function filterSearchPathSegment(searchText: string, resumptionToken: string): string {
    let getSearchText = searchText === resumptionToken || /^z\/\d{4}\//.test(searchText) ? '' : searchText;
    const m = searchText.match(/(^z\/.*?)(?:$|\s)/);
    if (m) {
        const token = m[1].replace(/\s/g, '');
        getSearchText = searchText.replace(token, '').trim();
    }
    return getSearchText;
}

export function calendarFormat(ts: number | undefined): string {
    if (ts == null || Number.isNaN(ts)) return 'Unspecified';
    const d = new Date(ts);
    const now = new Date();
    const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((sod(now) - sod(d)) / 86_400_000);
    const timeStr = d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
    if (diffDays === 0) return timeStr;
    if (diffDays === 1) return `Yesterday, ${timeStr}`;
    return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
}

const S3_PATTERNS: RegExp[] = [
    /s3:\/\/(.*?)\/(.*?\/z\/.*)/g,
    /"[bB]ucket":\s*"(.*?)",\s*"[kK]ey":\s*"(.*?\/z\/.*?)"/g,
];

export type S3LinkSegment = { type: 'text'; value: string } | { type: 'link'; href: string; label: string };

/** Split JSON string into text + S3 console link segments (legacy regexes). */
export function linkifyS3Segments(jsonPretty: string): S3LinkSegment[] {
    type Match = { start: number; end: number; href: string; raw: string };
    const matches: Match[] = [];
    for (const re of S3_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(jsonPretty)) !== null) {
            const href = encodeURI(
                `https://console.aws.amazon.com/s3/buckets/${m[1]}/${m[2]}/details?region=us-west-2&tab=overview`,
            );
            matches.push({ start: m.index, end: m.index + m[0].length, href, raw: m[0] });
        }
    }
    matches.sort((a, b) => a.start - b.start);
    const merged: Match[] = [];
    for (const x of matches) {
        const last = merged[merged.length - 1];
        if (last && x.start < last.end) continue;
        merged.push(x);
    }
    const out: S3LinkSegment[] = [];
    let cursor = 0;
    for (const x of merged) {
        if (x.start > cursor) {
            out.push({ type: 'text', value: jsonPretty.slice(cursor, x.start) });
        }
        out.push({ type: 'link', href: x.href, label: x.raw });
        cursor = x.end;
    }
    if (cursor < jsonPretty.length) {
        out.push({ type: 'text', value: jsonPretty.slice(cursor) });
    }
    return out.length ? out : [{ type: 'text', value: jsonPretty }];
}
