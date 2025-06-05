import {fromIni} from "@aws-sdk/credential-provider-ini";
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import yargs from "yargs"

async function main(): Promise<void> {

    let argv = yargs(process.argv.slice(2)).options({
        configLocation: {type: 'string', demandOption: true, describe: 'The location to the auth config file'}
    }).help().parseSync();

    if (!argv.configLocation) {
        throw new Error("No path for a local config file provided");
    }



    const env_path = './.env.local';

    const env_props = {
        aws_access_key_id: "",
        aws_secret_access_key: "",
        aws_session_token: "",
        aws_region: "us-east-1",
        environment: 'test',
        leo_cron_table: 'TestBus-LeoCron-OJ8ZNCEBL8GM',
        leo_stats_table: 'TestBotmon-LeoStats-1X4QJ2RV6XCYA',
        local: true,
        auth_config_source: argv.configLocation,
        auth_secret:'',
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

    try {
        const auth_secret = execSync('npx auth secret --raw', {encoding: 'utf-8'});
        env_props.auth_secret = auth_secret.trimEnd();
    } catch(error) {
        console.error("Error generating auth secret:", error);
    }

    const data: string[] = [];
    for(const [key, val] of Object.entries(env_props)) {

        data.push(`${key.toUpperCase()}="${val}"`);

    }

    writeFileSync(env_path, data.join('\n'));


}

(async () => {
    try {
        await main();
    } catch(e) {
        console.error(e);
    }
})();
