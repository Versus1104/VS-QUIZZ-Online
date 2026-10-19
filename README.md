# VS_QUIZZ v29 Online Multiplayer

## Included
- VS_QUIZZ v28 gameplay preserved in `VS_QUIZZ_v29.html`.
- Host creates a room and shares the room code.
- Players join from separate PCs through the same hosted URL.
- The question is displayed full-screen to players, with a large “RIDICĂ MÂNA!” button.
- The server locks the first buzz; the host verbally checks the answer and uses Correct/Wrong.
- Player answer result and score updates are broadcast to connected clients.
- `render.yaml` is included as a deployment blueprint for Render.

## Deploy online (Render)
1. Extract this ZIP on your PC.
2. Create a GitHub repository and upload the **contents** of the `VS_QUIZZ_v29_online` folder (server.js, package.json, render.yaml, and VS_QUIZZ_v29.html).
3. Sign in to Render and choose **New + → Blueprint**.
4. Connect the GitHub repository and deploy the blueprint. Render reads `render.yaml`, installs dependencies and starts `npm start`.
5. Open the public HTTPS URL Render gives you. The `/health` endpoint should return JSON such as `{"ok":true,"rooms":0}`.
6. Open the same public URL on the host PC and player PCs. The host creates a room and shares the room code.

## Test locally first (optional)
Requires Node.js 18+. In this folder run:
```bash
npm install
npm start
```
Then open `http://localhost:3000`. Localhost is only for the same PC; remote players need the public hosted URL.

## Notes
- A hosting account and a GitHub account are required to publish the server. I cannot create or authorize accounts on your behalf.
- This prototype has no accounts or persistent server-side game records. Keep the host page open during play.
- The host should start the match after players have joined. Test special question types before a public match.
- Hosting free-tier availability/limits can change; the service may sleep when idle.
