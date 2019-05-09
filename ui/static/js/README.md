# LEO Authentication

## LEOCognito helper

NOTE: Currently dependent on jQuery

The Leo Platform has an authentication helper that will
* Setup your AWS.CognitoIdentityCredentials 
* Detect ajax (jQuery) calls and add nessesary authentication headers
* Performs nessesary Cryptographic functions

## Installation

Copy `leoApiGateway.js` into your application

## Usage

```
CONST = AWS_COGNITO_IDENTITY_POOL_ID = <your_identity_pool_id>
LEOCognito.start(AWS_COGNITO_IDENTITY_POOL_ID, getToken, opts, callback)
```
Where `getToken` is a function `(credentialCallback) => {}` that will get your `{ IdentityId, Logins }` and call the `credentialCallback` with that information.

And  `opts` is `{ apiUri, region }` where apiUri is a portion of your api endpoint that will be used to determine which calls to intercept and authenticate. (i.e. '/api') and `region` is your aws-region