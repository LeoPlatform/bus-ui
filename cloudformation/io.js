module.exports = {
	"Conditions": {},
	"Parameters": {
		"CognitoId": {
			"Type": "String",
			"Description": "Cognito Pool Id used for request authentication"
		},
		"Logins": {
			"Type": "String",
			"Description": "Array of Logins"
		},
		"CustomJS": {
			"Description": "Custom Javascript for the web app",
			"Type": "String"
		},
		"BotScanSegments": {
			"Description": "Number of parallel scan segments for the bots (LeoCron) DynamoDB table",
			"Type": "String",
			"Default": "1"
		},
		"QueueScanSegments": {
			"Description": "Number of parallel scan segments for the queues (LeoEvent) DynamoDB table",
			"Type": "String",
			"Default": "1"
		},
	}
}
