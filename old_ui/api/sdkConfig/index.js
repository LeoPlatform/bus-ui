"use strict";

let aws = require("aws-sdk");
let request = require("leo-sdk/auth/request");
let config = require("leo-sdk/leoConfigure");
require("moment-round");

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    await request.authorize(event, {
        lrn: 'lrn:leo:botmon:::accessConfig',
        action: "get",
        botmon: {}
    });
    let cloudformation = aws.CloudFormation({
        region: config._meta.region
    });

    cloudformation.listStackResources({
        StackName: config.stacks && config.stacks.Leo || "Leo"
    }, function (err, data) {
        if (data.NextToken) {
            console.log("We need to deal with next token");
        }
        let resources = {};
        data.StackResourceSummaries.map((resource) => {
            resources[resource.LogicalResourceId] = {
                type: resource.ResourceType,
                id: resource.PhysicalResourceId,
                name: resource.LogicalResourceId
            };
        });

        callback(err, {
            kinesis: resources.KinesisStream.id,
            s3: resources.S3Bus.id,
            firehose: resources.FirehoseStream.id,
            region: config.aws.region
        })
    });

});