module.exports = {
    Resources: {
        "LeoBotmonRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "AssumeRolePolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {
                                "Service": [
                                    "lambda.amazonaws.com"
                                ],
                                "AWS": {
                                    "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
                                }
                            },
                            "Action": [
                                "sts:AssumeRole"
                            ]
                        }
                    ]
                },
                "ManagedPolicyArns": [
                    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                    {
                        "Fn::ImportValue": {
                            "Fn::Sub": "${leosdk}-Policy"
                        }
                    }
                ],
                "Policies": [
                    {
                        "PolicyName": "Leo_micro_logging_to_analytics",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "dynamodb:BatchGetItem",
                                        "dynamodb:BatchWriteItem",
                                        "dynamodb:UpdateItem"
                                    ],
                                    "Resource": [
                                        {
                                            "Fn::Sub": "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${LeoStats}"
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "LeoBotmonSnsRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "AssumeRolePolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {
                                "Service": [
                                    "lambda.amazonaws.com"
                                ],
                                "AWS": {
                                    "Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"
                                }
                            },
                            "Action": [
                                "sts:AssumeRole"
                            ]
                        }
                    ]
                },
                "ManagedPolicyArns": [
                    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                    {
                        "Fn::ImportValue": {
                            "Fn::Sub": "${leosdk}-Policy"
                        }
                    },
                    {
                        "Fn::ImportValue": {
                            "Fn::Sub": "${leoauth}-Policy"
                        }
                    }
                ],
                "Policies": [
                    {
                        "PolicyName": "Leo_Sns",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "sns:ListTopics",
                                        "sns:ListSubscriptionsByTopic",
                                        "sns:GetTopicAttributes",
                                        "sns:CreateTopic",
                                        "sns:Subscribe",
                                        "sns:Unsubscribe"
                                    ],
                                    "Resource": {
                                        "Fn::Sub": "arn:aws:sns:${AWS::Region}:${AWS::AccountId}:*"
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "AutoScalingRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "AssumeRolePolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {
                                "Service": [
                                    "application-autoscaling.amazonaws.com"
                                ]
                            },
                            "Action": [
                                "sts:AssumeRole"
                            ]
                        }
                    ]
                },
                "Path": "/",
                "Policies": [
                    {
                        "PolicyName": "root",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "dynamodb:DescribeTable",
                                        "dynamodb:UpdateTable",
                                        "cloudwatch:PutMetricAlarm",
                                        "cloudwatch:DescribeAlarms",
                                        "cloudwatch:GetMetricStatistics",
                                        "cloudwatch:SetAlarmState",
                                        "cloudwatch:DeleteAlarms"
                                    ],
                                    "Resource": "*"
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "ApiRole": {
            "Properties": {
                "Policies": [
                    undefined,
                    {
                        "PolicyName": "Leo_botmon_stats_policy",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "dynamodb:BatchGetItem",
                                        "dynamodb:BatchWriteItem",
                                        "dynamodb:UpdateItem",
                                        "dynamodb:PutItem",
                                        "dynamodb:Query",
                                        "dynamodb:Scan",
                                        "dynamodb:GetItem"
                                    ],
                                    "Resource": [
                                        {
                                            "Fn::Sub": "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${LeoStats}*"
                                        }
                                    ]
                                }
                            ]
                        }
                    },
                    {
                        "PolicyName": "Leo_botmon_logs",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": [
                                        "logs:FilterLogEvents"
                                    ],
                                    "Resource": [
                                        {
                                            "Fn::Join": [
                                                "",
                                                [
                                                    "arn:aws:logs:",
                                                    {
                                                        "Ref": "AWS::Region"
                                                    },
                                                    ":",
                                                    {
                                                        "Ref": "AWS::AccountId"
                                                    },
                                                    ":log-group:/aws/lambda/*"
                                                ]
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }
        }
    }
}