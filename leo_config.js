'use strict';
module.exports = {
    /**defaults applied to every system**/
    _global: {
        leoauth: process.env.leoauthsdk && JSON.parse(process.env.leoauthsdk).resources,
        leosdk: process.env.leosdk && JSON.parse(process.env.leosdk).resources,
        Resources: process.env.Resources && JSON.parse(process.env.Resources),
        ui: {
            staticAssets: "https://assets.leoplatform.io/leo_botmon",
            cognito: {
                id: "us-west-2:aa1428e4-3b13-4dc2-ac73-e2f8c9e5a3b4"
            },
            region: "us-west-2"
        }
    },
    _local: {
        leoaws: {
            profile: 'default',
            region: 'us-west-2'
        }
    }
};
