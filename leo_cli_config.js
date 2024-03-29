'use strict';
module.exports = {
	publish: [{
		leoaws: {
			profile: 'leo',
			region: 'us-west-2'
		},
		public: true,
		staticAssets: "s3://leomicro-leos3bucket-196kh64k036gk/leo_botmon"
	}
		, {
		leoaws: {
			profile: 'leo',
			region: 'us-east-1'
		},
		public: true,
		staticAssets: "s3://leomicro-leos3bucket-196kh64k036gk/leo_botmon"
	}
	],
	deploy: {
		dev: {
			stack: 'DevBotmon',
			region: 'us-west-2',
			parameters: {
				CognitoId: 'us-west-2:aa1428e4-3b13-4dc2-ac73-e2f8c9e5a3b4',
				leoauth: 'DevAuth',
				leosdk: 'DevBus',
			}
		}
	},
	test: {
		"personas": {
			"default": {
				"identity": {
					"SourceIp": "67.207.40.96"
				}
			}
		},
		defaultPersona: 'default'
	}
};
