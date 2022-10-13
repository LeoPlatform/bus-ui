const path = require("path");
const fs = require("fs");
module.exports = function(buildDir, newCloudformation, done) {
	// Show pages uses the leo-cli lambda template which uses nodejs12.x runtime, so override it
	newCloudformation.Resources.ShowPages.Properties.Runtime = "nodejs16.x";

	Object.entries(newCloudformation.Resources).forEach(([key, value]) => {
		if (value.Type == "AWS::Lambda::Function") {
			value.Properties.Tags = [
				{
					"Key": "app",
					"Value": "rstreams-bus-ui"
				},
				{
					"Key": "environment",
					"Value": {
						"Fn::Sub": "${Environment}"
					}
				},
				{
					"Key": "chub:tech:component",
					"Value": key
				},
				{
					"Key": "chub:tech:app",
					"Value": {
						"Fn::Sub": "${AWS::StackName}"
					}
				},
				{
					"Key": "chub:tech:env",
					"Value": {
						"Fn::Sub": "${Environment}"
					}
				}
			]
		}
	});

	let file = path.resolve(buildDir, newCloudformation.Outputs.LeoTemplate.Value.replace(/^.*?\/(cloudformation-.*)$/, "$1"));
	let localfile = path.resolve(__dirname, "cloudformation.json");
	let output = JSON.stringify(newCloudformation, null, 2);
	fs.writeFileSync(file, output);
	fs.writeFileSync(localfile, output);

	done();
};

