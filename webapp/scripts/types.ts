export interface LeoConfig {
    [key: string]: Config
}

export interface Config {
    leoauthsdk: AuthConfig,
    leosdk: SdkConfig,
    Resources: ResourcesConfig,
}

export interface AuthConfig {
    LeoAuth: string,
    LeoAuthUser: string,
    Region: string,
}

export interface SdkConfig {
    LeoStream: string,
    LeoCron: string
    LeoEvent: string
    LeoSettings: string
    LeoSystem: string
    LeoS3: string
    LeoKinesisStream: string
    LeoFirehoseStream: string
}

export interface ResourcesConfig {
    LeoStats: string
}