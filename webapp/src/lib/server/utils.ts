import { env } from '$env/dynamic/private';


export function getLeoCronTable(): string {

    const result = env.LEO_CRON_TABLE ?? process.env.LEO_CRON_TABLE;
    if (!result) {
        throw new Error(`process.env.LEO_CRON_TABLE is not set`);
    } else {
        return result;
    }
}
