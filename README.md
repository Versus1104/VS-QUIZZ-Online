# VS_QUIZZ Online v32.0.1

This package contains the VS_QUIZZ v32 HTML game and a simplified Node.js WebSocket server.

## Files
- `VS_QUIZZ_v32.html` — game interface
- `server.js` — HTTP and WebSocket server
- `package.json` — pinned `ws` dependency and start script
- `render.yaml` — Render service configuration

## Local test
1. Install Node.js 20 or newer.
2. In this folder, run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` and verify `http://localhost:3000/health` returns `{"ok":true,"rooms":0}`.

## Existing Render deployment
Update the corresponding files in the existing `VS-QUIZZ-Online` GitHub repository only after reviewing them. Then deploy the latest commit in the existing Render service `vs-quizz-online`. Do not delete or recreate the existing service.

This package has undergone static checks only; it has not been scanned with Microsoft Defender on the target Windows PC or tested in a live Render multiplayer session.
