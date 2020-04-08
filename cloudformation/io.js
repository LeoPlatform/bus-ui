module.exports = {
	"Conditions": {},
	"Parameters": {
		"CognitoId": {
			"Type": "String",
			"Description": "Cognito Pool Id used for request authentication"
		},
		"Logins": {
			"Type": "String",
            "Default": "[]",
			"Description": "Array of Logins"
		},
		"CustomJS": {
			"Description": "Custom Javascript for the web app",
            "Default": "",
			"Type": "String"
		},
	}
}
