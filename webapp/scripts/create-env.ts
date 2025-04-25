import {fromIni} from "@aws-sdk/credential-provider-ini";
import { writeFileSync } from "fs";

async function main(): Promise<void> {

    const env_path = './.env.local';

    const env_props = {
        aws_access_key_id: "",
        aws_secret_access_key: "",
        aws_session_token: "",
        aws_region: "us-east-1",
        environment: 'test',
        leo_cron_table: 'TestBus-LeoCron-OJ8ZNCEBL8GM'
    };
    const creds = await fromIni({profile: "default"})();

    env_props.aws_access_key_id = creds.accessKeyId;
    env_props.aws_secret_access_key = creds.secretAccessKey;
    if(creds.sessionToken) {
        env_props.aws_session_token = creds.sessionToken;
    } else {
        throw new Error("No session token provided, this is needed in order to create the local environment");
    }

    const data: string[] = [];
    for(const [key, val] of Object.entries(env_props)) {

        data.push(key.toUpperCase() + "=" + val);

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
