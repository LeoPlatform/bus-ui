module.exports = {
    Resources: {
        "HealthCheckSNS": {
            "Type": "AWS::SNS::Topic",
            "Properties": {
                "DisplayName": {
                    "Fn::Sub": "Leo Health Check - ${AWS::StackName}"
                }
            }
        }
    }
}