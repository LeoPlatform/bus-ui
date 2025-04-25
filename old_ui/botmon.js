[{
  "Effect": "Allow",
  "Action": "botmon:getStats",
  "Resource": "lrn:leo:botmon:::",
  "Condition": {
    "IpAddress": {
      "aws:source-ip": ["10.0.0.0/8"]
    }
  }
}]