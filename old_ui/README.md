# Bus-UI

## Link to the Bus: https://github.com/LeoPlatform/bus

# Run local

## Add a file test/process.js

```
   module.exports = {
	   env: {
			leoauthsdk: {
				LeoAuth: "",
				LeoAuthUser: "",
				Region: ""
			}
			leosdk: {
				LeoStream: "",
				LeoCron: "",
				LeoEvent: "",
				LeoSettings: "",
				LeoSystem: "",
				LeoS3: "",
				LeoKinesisStream: "",
				LeoFirehoseStream: "",
				Region: ""
			},
			Resources:{
				LeoStats: "",
				CognitoId: ""
			},
			StackName:""
	   }
   }
```

## Run npm start - test/process.js will be loaded into environment variables



## Example test/process.js that reads which bus from an env var
```
let environments = {
	prod: {
		leoauthsdk: {
			LeoAuth: "",
			LeoAuthUser: "",
			Region: "",
		},
		leosdk: {
			LeoStream: "",
			LeoCron: "",
			LeoEvent: "",
			LeoSettings: "",
			LeoSystem: "",
			LeoS3: "",
			LeoKinesisStream: "",
			LeoFirehoseStream: "",
			Region: "",
		},
		Resources: {
			LeoStats: ""
		}
	},
	test: {
		leosdk: {
			Region: "",
			LeoStream: "",
			LeoCron: "",
			LeoEvent: "",
			LeoS3: "",
			LeoKinesisStream: "",
			LeoFirehoseStream: "",
			LeoSettings: "",
			LeoSystem: "",
		},
		leoauthsdk: {
			LeoAuth: "",
			LeoAuthUser: "",
			Region: "",
		},
		Resources: {
			LeoStats: ""
		}
	}
};

const config = environments[process.env.bus] || Object.values(environments)[0];
config.StackName = config.Resources.LeoStats.replace(/-LeoStats-.*$/, "");
config.Resources.CognitoId = "";
config.BusName = (config.leosdk.kinesis || config.leosdk.LeoKinesisStream).replace(/-LeoKinesisStream-.*$/, "");
module.exports = {
	env: config
}

console.log(`Connecting to Bus: ${config.BusName}, Botmon: ${config.StackName}`);

```


# Deployment

run `npm run publish`

>[!TIP] 
You can optionally add a tag to the command by adding 
`shell --tag {tag_name}` to the end of the publish command where `{tag_name}` resolves to a custom folder 

This will output the name of an S3 file that you will need to copy

Then go into the Cloudformation web ui and find the correct stack you want to update (`ProdBus`, `StagingBus`, etc)

<!-- Drop a note in #t_engineering -->