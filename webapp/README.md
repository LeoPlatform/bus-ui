# Introduction

This is a web application built using Typescript, Svelte 5, SvelteKit, shadcn-svelte, and Tailwindcss. It helps users visualize data flows and event searching for configured LEO buses. 

# Getting Started

The modern re-work of the project is located within the `webapp/` directory of this project. The old React-based implentation is stored in the `old_ui/` directory. 

> [!IMPORTANT]
> This project requires a version of NodeJs >= 20.11.0

# Project Setup

Before the project can be run there are few configs that are needed in order for the application to run as expected.

Specifically we need the `providers.config.json` and `leo.config.json`

> [!NOTE]
> the requirement for the `leo.config.json` file may be retired fairly soon in favor of using Rstreams Flow.

## leo.config.json

This file contains all the AWS resources that are related to the LEO bus(es) you want to view. 

The structure for for this file can be found [here](scripts/types.ts). 

> [!NOTE]
> The key of the `LeoConfig` type should be a PascalCase representation of the environment and the name of the bus you want to connect to. 
> (i.e `ProdBus`, `TestBus`, `TestPlaygroundBus`, etc)

This file, when created, must be placed at the root level (`webapp/leo.config.json`)

## providers.config.json

This contains all the details we need for us to dynamically fetch credentials for users. You will be required to auth while running locally, but the aws credentials that will be used will be your own personal credentials. 

The schema for what this file looks like can be found at [webapp/src/lib/auth/config.ts](src/lib/auth/config.ts)

```ts
    interface AuthProviderConfigSchema: {
        enabled: boolean, // defaults to false
        id?: string,
        secret?: string,
        issuer?: string,
        clientId?: string,
        tenantId?: string,
        region?: string,
        userPoolId?: string,
        scope?: string,
        authorization?: {
            params?: Record<string, any>,
        },
    };
```

Everything in this type is optional because the provider themselves determines what they want. For example Cognito requires the following fields to be provided:  `region`, `userPoolId`, `id`, `secret`, and `scope` while Google requires `id`, `secret`, `scope`

> [!WARNING] as we add more supported providers this definition can and will change.

This file must be placed at the root of the project (`webapp/providers.config.json`)

## create-env.ts

This helper script helps you get your local environment set up so the project can run effectively. It is set up as a CLI tool and can be run seperately. I personally have the different variations that I need to run set up as separate npm scripts. 

The definition for what args can be passed in can be found by running `tsx scripts/create-env.ts --help`

What this script eventually does is creates a `.env.local` file that SvelteKit then uses to load up the environment variables that the application uses. 


# Running the project

Make sure you are in the `webapp/` directory. From there you need to:

1. Get your latest set of personal AWS credentials 
    > [!NOTE]
    > I use `aws-azure-login` personally, but there are other tools that will work for you. 
    > Essentially what we need is the `~/.aws/credentials` file
2. ensure that you have valid `leo.config.json` and `providers.config.json` files created and placed in the correct locations
3. Then run `npm run create-env-{env}-{bus}`
4. Then run `npm run dev`

> ![NOTE] Browser
> This project was developed using Chrome as the main supported browser. 
> Other browsers **should** work, but your mileage may vary.
