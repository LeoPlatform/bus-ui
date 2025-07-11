import {fromIni} from "@aws-sdk/credential-provider-ini";
import { execSync } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import yargs from "yargs"

async function main(): Promise<void> {

    let argv = yargs(process.argv.slice(2)).options({
        configLocation: {type: 'string', demandOption: true, describe: 'The location to the auth config file'}
    }).help().parseSync();

    
    const env_path = './.env.local';
    
    const existingEnvFileData = readExistingEnvFile(env_path);
    if (!argv.configLocation && !existingEnvFileData['AUTH_CONFIG_SOURCE']) {
        throw new Error("No path for a local config file provided in the args or existing env file");
    }

    const env_props = {
        aws_access_key_id: "",
        aws_secret_access_key: "",
        aws_session_token: "",
        aws_region: "us-east-1",
        environment: 'test',
        leo_cron_table: 'TestBus-LeoCron-OJ8ZNCEBL8GM',
        leo_stats_table: 'TestBotmon-LeoStats-1X4QJ2RV6XCYA',
        leo_event_table: 'TestBus-LeoEvent-FNSO733D68CR',
        leo_system_table: 'TestBus-LeoSystem-L9OY6AV8E954',
        local: true,
        auth_config_source: argv.configLocation ?? existingEnvFileData['AUTH_CONFIG_SOURCE'],
        auth_secret: existingEnvFileData['AUTH_SECRET'],
        debug_auth: true,
    };
    const creds = await fromIni({profile: "default"})();

    env_props.aws_access_key_id = creds.accessKeyId;
    env_props.aws_secret_access_key = creds.secretAccessKey;
    if(creds.sessionToken) {
        env_props.aws_session_token = creds.sessionToken;
    } else {
        throw new Error("No session token provided, this is needed in order to create the local environment");
    }

    if(!env_props.auth_secret) {
        try {
            const auth_secret = execSync('npx auth secret --raw', {encoding: 'utf-8'});
            env_props.auth_secret = auth_secret.trimEnd();
        } catch(error) {
            console.error("Error generating auth secret:", error);
        }
    }

    const data: string[] = [];
    for(const [key, val] of Object.entries(env_props)) {

        data.push(`${key.toUpperCase()}=${val}`);

    }

    writeFileSync(env_path, data.join('\n'));


}

function readExistingEnvFile(path: string): Record<string, string> {
    const map = {};
    if(existsSync(path)) {
        const data = readFileSync(path, {encoding: 'utf-8'});
        if (data && data.trim().length > 0) {
            const props = data.split('\n');
            props.forEach((prop) => {
                if (prop.trim().length === 0) return;
                const idx = prop.indexOf('=');
                if (idx === -1) {
                    throw new Error(`Did not find = sign in prop ${prop}`);
                } else {
                    map[prop.substring(0, idx).trim()] = prop.substring(idx + 1).trim();
                }
            });
        }
    }

    return map;
}

(async () => {
    try {
        await main();
    } catch(e) {
        console.error(e);
    }
})();
