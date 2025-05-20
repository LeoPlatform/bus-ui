This service called Botmon is a web application that serves as a monitoring service for systems, queues, and bots created within the Leo platform.

Botmon is a fast and efficient website that helps users track events that contained in queue, view the general health of a system (a series of bots, queues, and systems that serve a singular purpose).

The different components that make up the Botmon website are:
- Bots - which are logical processes that are registered to be triggered and monitored by the Leo platform. Most of the bots in use by the system today are AWS Lambdas, but they are not limited to Lambdas. 
- Queues - these are queues of events that are processed by bots. The most common relationship is between a bot and a queue.
- System - these are data sources that are external to the Leo platform such as AWS DynamoDb, Postgres, ElasticSearch, etc.
- Events - These are units of data that are processed by bots, which reside in queues and systems. 
- Bus - this is all of the previously listed components taken together.

The Leo platform code can be found [here](https://github.com/LeoPlatform)

Leo is a suite AWS serverless tools that are used for ETL and microservices. The big pieces of Leo that we use for the Botmon website are [leo-sdk](https://github.com/LeoPlatform/Nodejs) and [leo-auth](https://github.com/LeoPlatform/auth-sdk).


There is a CustomJS attribute on the Cloudformation stack.

WE get temp creds from AWS Cognito using the poolid.
---

## Authentication Architecture

The Botmon service uses AWS Cognito for identity management and authentication. The authentication flow is implemented using the following components:

### Core Authentication Components

1. **AWS Cognito**: Provides the user identity management and authentication service. The application references a Cognito Identity Pool (configured in the `leo_config.js` file) for user authentication.

2. **leo-auth SDK**: A custom authentication library that provides policy-based access control. This SDK integrates with AWS Cognito and implements AWS IAM-style policy validation.

3. **LEOCognito**: A client-side JavaScript implementation that handles token management, credential refreshing, and AWS API Gateway request signing.

### Authentication Flow

1. The client application initializes authentication by calling `LEOCognito.start()` with the Cognito Identity Pool ID and configuration.

2. When a user authenticates, AWS Cognito provides temporary AWS credentials, which are then used to sign API requests.

3. API requests to the backend are automatically signed using AWS Signature Version 4 (SigV4) to ensure secure communication.

4. The `leo-auth` SDK on the server side validates incoming requests based on:
   - User identity from AWS Cognito
   - Policy-based permissions that determine what resources and actions the user can access

### Policy-Based Authorization

The system uses a policy model similar to AWS IAM with:

- **Actions**: Operations a user can perform (e.g., read, write, update)
- **Resources**: Data or components a user can access, identified by Leo Resource Names (LRN)
- **Conditions**: Additional constraints on permissions (e.g., IP address restrictions, time-based access)

Policies are structured as JSON documents with statements that either Allow or Deny specific actions on resources under certain conditions. The policy evaluation follows these rules:

1. Explicit Deny statements take precedence over Allow statements
2. If no matching Allow statement is found, access is denied by default
3. Policies can include wildcards and pattern matching for flexible permission management

### User Management

User identities and their associated policies are stored in DynamoDB tables:
- `LeoAuthUser`: Stores user identity information
- `LeoAuth`: Stores policies associated with identity groups

This policy-based approach allows for fine-grained access control across the entire Botmon system while leveraging AWS's secure authentication infrastructure.
