# VS_QUIZZ v30 Online

## Fixes in v30
- Fixed the missing closing `</div>` for `#onlinePlayerScreen`. The host game UI is now outside the hidden player-only overlay.
- Host start explicitly restores the main game area and verifies the board is not nested in the player overlay.
- Server serves `VS_QUIZZ_v30.html`.

## Deploy on Render
1. Upload all files in this folder to the root of your GitHub repository (not nested in another folder).
2. Ensure `render.yaml`, `package.json`, `server.js`, and `VS_QUIZZ_v30.html` are at the repository root.
3. On Render, trigger a new deploy from the updated commit.
4. Open the app URL and hard refresh with Ctrl+F5.
5. Create a new room and connect two players.

The WebSocket server is included. This package has been syntax-checked locally; a real Render deployment still needs to be tested from the user's account.
