"use strict";
let request = require("leo-auth");
let leo = require("leo-sdk");
let aws = require("aws-sdk");
let async = require("async");
let configure = leo.configuration;
let dynamodb = leo.aws.dynamodb;
let SETTINGS_TABLE = leo.configuration.resources.LeoSettings;

let handlers = {
    "GET": doGet,
    "POST": doPost,
    default: (e, c, callback)=>(callback("Unsupported"))
};
let sns = new aws.SNS({
    region: configure.aws.region
});

exports.handler = require("leo-sdk/wrappers/resource")(async (event, context, callback) => {
    (handlers[event.requestContext.httpMethod] || handlers.default)(event, context, callback);
});


async function doGet (event, context, callback) {
    await request.authorize(event, {
        lrn: `lrn:leo:botmon:::sns_topics`,
        action: `get`,
        botmon: {}
    });
    let params = {
       NextToken: null
    };
    let finalData = {};
    let subs = {};
    let topicAttributes = {};
    let tasks = [];
    let healthTable = null

    sns.listTopics(params, function (err, data) {
       let topics = (data || {}).Topics;
       if (Object.keys(topics).length !== 0) {
           Object.keys(topics).map((key,index) => {

               tasks.push(done => {
                   let params2 = {
                       NextToken: null,
                       TopicArn: (topics[key].TopicArn || '')
                   };
                   sns.listSubscriptionsByTopic(params2, (err, data) => {
                       subs[topics[key].TopicArn] = data.Subscriptions;
                       done();
                   });
               });

               tasks.push(done => {
                   let params2 = {
                       TopicArn: (topics[key].TopicArn || '')
                   };
                   sns.getTopicAttributes(params2, (err, data) => {
                       topicAttributes[topics[key].TopicArn] = {displayName: (data.Attributes && data.Attributes.DisplayName || ''), owner: (data.Attributes && data.Attributes.Owner || '')};
                       done();
                   });
               });
           });
       }

       tasks.push(done => {
           let id = 'healthSNS_data';
           dynamodb.get(SETTINGS_TABLE, id, function (err, data) {
               healthTable = (data && data.value) || {};
               done();
           });
       });


       async.parallelLimit(tasks, 5, (err) => {
           finalData["subs"] = subs;
           finalData["topicAttributes"] = topicAttributes;
           finalData["tags"] = healthTable;
           callback(err, finalData)
       });
    });
}

async function doPost (event, context, callback) {
    let createId = process.env.StackName + '-' + event.params.path.id;
    let id = event.params.path.id;
    if (event.params.path.type === 'topic') {
        await request.authorize(event, {
            lrn: `lrn:leo:botmon:::sns_topic/{id}`,
            action: `create`,
            botmon: {
                "id": createId
            }
        });
        sns.createTopic({
            'Name': createId
        }, function (err, data) {
            callback(err, (data || {}))
        });
    } else if (event.params.path.type === 'subscription') {
        let subscribe = event.body && event.body.subscribe;
        if (subscribe === true) {
            let protocol = event.body && event.body.protocol;
            let endpoint = event.body && event.body.endpoint;
            await request.authorize(event, {
                lrn: `lrn:leo:botmon:::sns_subscription/{topic}`,
                action: `subscribe`,
                botmon: {
                    "topic": id,
                    "protocol": protocol,
                    "endpoint": endpoint
                }
            });
            sns.subscribe({
                'Endpoint': endpoint,
                'Protocol': protocol,
                'TopicArn': id
            }, function (err, data) {
                callback(err, (data || {}))
            });
        } else {
            let unSub = event.body && event.body.unSub;
            await request.authorize(event, {
                lrn: `lrn:leo:botmon:::sns_subscription/{subscription}`,
                action: `unsubscribe`,
                botmon: {
                    "subscription": unSub,
                }
            });
            sns.unsubscribe({
                'SubscriptionArn': unSub,
            }, function (err, data) {
                callback(err, (data || {}))
            });
        }
    } else if (event.params.path.type === 'tags') {
        let body = event.body;
        await request.authorize(event, {
            lrn: `lrn:leo:botmon:::sns_subscription/{tags}`,
            action: `update`,
            botmon: {
                "tags": body,
            }
        });
        if (body.delete) {
            Object.keys(body.tags).map((tag, i) => {
                if (body.tags[tag].indexOf(id) > -1 && body.tagsToKeep.indexOf(tag) === -1) {
                    let index = body.tags[tag].indexOf(id);
                    if (index > -1) {
                        body.tags[tag].splice(index, 1);
                    }
                }
            });
            delete body.delete;
            delete body.tagsToKeep;
            if ('' in body.tags) {
                delete body.tags['']
            }
            leo.aws.dynamodb.saveSetting("healthSNS_data", {
                lastSNS: body.lastSNS,
                botIds: body.botIds,
                tags: body.tags
            }, function(err) {
                callback(err, body.tags);
            });
        } else if (!body.delete){
            if (body.addedTag in body.tags) {
                body.tags[body.addedTag].push(id);
            } else {
                body.tags[body.addedTag] = [id];
            }
            delete body.delete;
            delete body.tagsToKeep;
            if ('' in body.tags) {
                delete body.tags[''];
            }
            leo.aws.dynamodb.saveSetting("healthSNS_data", {
                lastSNS: body.lastSNS,
                botIds: body.botIds,
                tags: body.tags
            }, function(err) {
                callback(err, body.tags);
            });
        } else {
            callback("Unsupported");
        }
    }  else {
        callback("Unsupported");
    }
}