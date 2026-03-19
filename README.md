# Bus-UI

## Link to the Bus: https://github.com/LeoPlatform/bus

# Prerequisites

- **Node.js 20+** (use `nvm use 20` if you have nvm)
- **leo-cli** installed globally for **the same Node major** you use to run bus-ui (many setups use **Node 20 → leo-cli 4.x**; public npm may still list `3.0.3-beta` as `beta`). Run `which leo-cli` and `leo-cli --version` after `nvm use 20`.
- The `--openssl-legacy-provider` flag is required for webpack/babel on Node 20:
  ```
  NODE_OPTIONS=--openssl-legacy-provider bus=TestCup npm start
  ```

# Run local

## Checklist — get a working UI (Node 20 + leo-cli 4)

Do these in order; skip a step only if you are sure it already passes.

1. **Use Node 20 and *its* global `leo-cli`**  
   `nvm use 20` (or equivalent). Confirm:
   ```bash
   node -v
   which leo-cli
   leo-cli --version
   ```
   If `which leo-cli` points at another Node (e.g. v23), fix `PATH` so Node 20’s global bin is first.

2. **Repo + gitignored `test/`**  
   From the repo root you run (primary clone or worktree):
   ```bash
   npm install
   ```
   If `test/` only has `process.js` and you normally keep local config elsewhere, copy from your primary clone’s `test/` (or run the genie script `scripts/bootstrap-bus-ui-worktree.sh` from the workspace root).

3. **`test/process.js` for `bus=TestCup`**  
   - `TestCup` entry must match the bus you use.  
   - Set **`Resources.CognitoId`** to a real **Cognito Identity Pool** id (`region:uuid`) for that environment.  
   - Ensure **`views/index`** includes the fix that reads **`leo.Resources.CognitoId`** (not only `leo.CognitoId`) for `window.leoAws`.

4. **OpenSSL legacy provider (required on Node 17+)**  
   Without this, webpack can fail with `digital envelope routines::unsupported`:
   ```bash
   export NODE_OPTIONS=--openssl-legacy-provider
   ```

5. **Start the app**  
   ```bash
   export bus=TestCup   # optional; `npm start` defaults to TestCup if unset
   npm start
   ```
   `npm start` runs `scripts/start-local.js`, which loads **`test/process.js` into `process.env` before `leo-cli`** so API bundles (e.g. stats) can `require('leo-sdk')` during Browserify without **Missing kinesis, s3, firehose**. Use **`npm run start:raw`** only if you intentionally bypass that (not recommended for local UI).
   Wait until you see **webpack `Compiled successfully`** and a line like **`Running microservice(Leo_Botmon) on port 80`** (your port may differ).

   **Live reload (JS/CSS)**: After saving a file, the browser should **reload automatically** once webpack finishes rebuilding. If it does not, see the troubleshooting row for HMR and optional polling.

6. **Open the right URL**  
   Default is **`http://localhost/module/`** (port **80** — not 3000). If port 80 bind fails on your Mac, check how your `leo-cli` chooses the port or run with the privileges your team uses for local Botmon.

7. **Verify HTML before debugging the UI**  
   - **View Page Source** (not DevTools Elements).  
   - There must be **no** raw `${leo.CustomJS}` / `${leo.static.uri}` text.  
   - The first app script tag after `<body>` must **not** be `src="undefined"`.  
   - Optional: `curl -I "http://localhost/module/static/<version-from-source>/css/index.css"` should be **200** and `content-type: text/css` (not `text/html`).

8. **AWS credentials**  
   Configure a profile (or env vars) so the SDK can use **Cognito** and call **Test** APIs for the stack IDs in `process.js`.

## Testing the replay / checkpoint copy (ES-2954)

After the UI loads and you can sign in:

1. Open a **queue** (or system) dashboard → **events** / event search view.  
2. Expand or select a row so the action icons appear.  
3. Hover the **CCW** icon — tooltip should describe **checkpoint reset and reprocess from here**, not “replay” only.  
4. Click it → modal title **Reprocess from this event**, helper text, primary button **Reset checkpoint & reprocess**, and confirm dialog text should match the new copy.

## Troubleshooting (symptoms → cause)

| Symptom | Likely cause |
|--------|----------------|
| `Cannot read properties of undefined (reading 'Region')` in `leoApiGateway.js` | `window.leoAws.cognitoId` is undefined. Set `Resources.CognitoId` in `test/process.js` to your environment’s **Cognito Identity Pool** id (`region:uuid`). Do not leave it unset for local UI. |
| `Refused to apply style … MIME type ('text/html')` for `…/static/…/css/index.css` | The static URL returned a 404 HTML page (wrong path or webpack didn’t emit assets). Confirm `leo-cli test` finished compiling; open the CSS URL in a new tab and check for 404. |
| `module/undefined` script | View page source: if you still see `${leo.CustomJS}` literally, template substitution failed—fix webpack/leo-cli errors in the terminal. If `CustomJS` is the word `undefined`, the dev server didn’t inject the bundle URL. |
| Blank page after fixing the above | AWS credentials must allow Cognito + API calls for the chosen `bus=` environment. |
| Terminal shows “Compiled” but the browser never updates | **HMR**: `leo-cli` uses `webpack-hot-middleware` with `reload=false`; the app must call `module.hot.accept()` — bus-ui does this in `ui/js/index.js` (full page reload on change). If **file saves don’t trigger** rebuilds (Docker/NFS), add **`"webpackPoll": 1000`** (milliseconds) next to other keys under **`package.json` → `config.leo`** so leo-cli passes polling to webpack’s watch options. |
| `npm run publish` / `npm run build` fails with `ERR_OSSL_EVP_UNSUPPORTED` or `digital envelope routines::unsupported` | Node’s OpenSSL 3 vs old webpack/babel. Use **`npm run publish`** / **`npm run build`** (they set `--openssl-legacy-provider` via `scripts/publish-local.js` / `build-local.js`), or export `NODE_OPTIONS=--openssl-legacy-provider`. **`publish:raw` / `build:raw`** skip that flag. |

## Add a file test/process.js

```
   module.exports = {
	   env: {
			leoauthsdk: {
				LeoAuth: "",
				LeoAuthUser: "",
				Region: ""
			}
			leosdk: {
				LeoStream: "",
				LeoCron: "",
				LeoEvent: "",
				LeoSettings: "",
				LeoSystem: "",
				LeoS3: "",
				LeoKinesisStream: "",
				LeoFirehoseStream: "",
				Region: ""
			},
			Resources:{
				LeoStats: "",
				CognitoId: ""
			},
			StackName:""
	   }
   }
```

## Run npm start - test/process.js will be loaded into environment variables



## Example test/process.js that reads which bus from an env var
```
let environments = {
	prod: {
		leoauthsdk: {
			LeoAuth: "",
			LeoAuthUser: "",
			Region: "",
		},
		leosdk: {
			LeoStream: "",
			LeoCron: "",
			LeoEvent: "",
			LeoSettings: "",
			LeoSystem: "",
			LeoS3: "",
			LeoKinesisStream: "",
			LeoFirehoseStream: "",
			Region: "",
		},
		Resources: {
			LeoStats: ""
		}
	},
	test: {
		leosdk: {
			Region: "",
			LeoStream: "",
			LeoCron: "",
			LeoEvent: "",
			LeoS3: "",
			LeoKinesisStream: "",
			LeoFirehoseStream: "",
			LeoSettings: "",
			LeoSystem: "",
		},
		leoauthsdk: {
			LeoAuth: "",
			LeoAuthUser: "",
			Region: "",
		},
		Resources: {
			LeoStats: ""
		}
	}
};

const config = environments[process.env.bus] || Object.values(environments)[0];
config.StackName = config.Resources.LeoStats.replace(/-LeoStats-.*$/, "");
// Do not assign CognitoId = "" here — it breaks local `LEOCognito.start` unless you use another auth path.
config.BusName = (config.leosdk.kinesis || config.leosdk.LeoKinesisStream).replace(/-LeoKinesisStream-.*$/, "");
module.exports = {
	env: config
}

console.log(`Connecting to Bus: ${config.BusName}, Botmon: ${config.StackName}`);

```


# Deployment

Run **`npm run publish`** (wraps `leo-cli` with **`--openssl-legacy-provider`**, same as `npm start`, so webpack/babel work on Node 17+).

Optional tag for a custom S3 folder:

```bash
npm run publish -- --tag lynn_dep
```

Use **`npm run publish:raw`** only if you intentionally skip the OpenSSL flag (not recommended on Node 20).

>[!TIP]
> Pass any extra `leo-cli publish` flags after `--` as shown above.

This will output the name of an S3 file that you will need to copy

Then go into the Cloudformation web ui and find the correct stack you want to update (`ProdBus`, `StagingBus`, etc)

<!-- Drop a note in #t_engineering -->