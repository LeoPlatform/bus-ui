module.exports = {
    Resources: {
        "LeoStats": {
            "Type": "AWS::DynamoDB::Table",
            "Properties": {
                "AttributeDefinitions": [
                    {
                        "AttributeName": "id",
                        "AttributeType": "S"
                    },
                    {
                        "AttributeName": "bucket",
                        "AttributeType": "S"
                    },
                    {
                        "AttributeName": "period",
                        "AttributeType": "S"
                    },
                    {
                        "AttributeName": "time",
                        "AttributeType": "N"
                    }
                ],
                "KeySchema": [
                    {
                        "AttributeName": "id",
                        "KeyType": "HASH"
                    },
                    {
                        "AttributeName": "bucket",
                        "KeyType": "RANGE"
                    }
                ],
                "ProvisionedThroughput": {
                    "ReadCapacityUnits": 20,
                    "WriteCapacityUnits": 20
                },
                "GlobalSecondaryIndexes": [
                    {
                        "IndexName": "period-time-index",
                        "KeySchema": [
                            {
                                "AttributeName": "period",
                                "KeyType": "HASH"
                            },
                            {
                                "AttributeName": "time",
                                "KeyType": "RANGE"
                            }
                        ],
                        "Projection": {
                            "ProjectionType": "INCLUDE",
                            "NonKeyAttributes": [
                                "current"
                            ]
                        },
                        "ProvisionedThroughput": {
                            "ReadCapacityUnits": "20",
                            "WriteCapacityUnits": "20"
                        }
                    }
                ],
                "StreamSpecification": {
                    "StreamViewType": "NEW_AND_OLD_IMAGES"
                }
            }
        },
        "LeoStatsReadCapacityScalableTarget": {
            "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
            "Properties": {
                "MaxCapacity": 600,
                "MinCapacity": 20,
                "ResourceId": {
                    "Fn::Sub": "table/${LeoStats}"
                },
                "RoleARN": {
                    "Fn::Sub": "${AutoScalingRole.Arn}"
                },
                "ScalableDimension": "dynamodb:table:ReadCapacityUnits",
                "ServiceNamespace": "dynamodb"
            }
        },
        "LeoStatsReadAutoScalingPolicy": {
            "Type": "AWS::ApplicationAutoScaling::ScalingPolicy",
            "Properties": {
                "PolicyName": "LeoStatsReadAutoScalingPolicy",
                "PolicyType": "TargetTrackingScaling",
                "ScalingTargetId": {
                    "Ref": "LeoStatsReadCapacityScalableTarget"
                },
                "TargetTrackingScalingPolicyConfiguration": {
                    "TargetValue": 70,
                    "PredefinedMetricSpecification": {
                        "PredefinedMetricType": "DynamoDBReadCapacityUtilization"
                    }
                }
            }
        },
        "LeoStatsWriteCapacityScalableTarget": {
            "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
            "Properties": {
                "MaxCapacity": 60,
                "MinCapacity": 20,
                "ResourceId": {
                    "Fn::Sub": "table/${LeoStats}"
                },
                "RoleARN": {
                    "Fn::Sub": "${AutoScalingRole.Arn}"
                },
                "ScalableDimension": "dynamodb:table:WriteCapacityUnits",
                "ServiceNamespace": "dynamodb"
            }
        },
        "LeoStatsWriteAutoScalingPolicy": {
            "Type": "AWS::ApplicationAutoScaling::ScalingPolicy",
            "Properties": {
                "PolicyName": "LeoStatsWriteAutoScalingPolicy",
                "PolicyType": "TargetTrackingScaling",
                "ScalingTargetId": {
                    "Ref": "LeoStatsWriteCapacityScalableTarget"
                },
                "TargetTrackingScalingPolicyConfiguration": {
                    "TargetValue": 70,
                    "PredefinedMetricSpecification": {
                        "PredefinedMetricType": "DynamoDBWriteCapacityUtilization"
                    }
                }
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
        }
    }
}