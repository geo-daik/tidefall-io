Tidefall.io — 6 Player Shared-Enemy Co-op Server Build

This is the 6-player co-op lobby version.

What works:
- Up to 6 players can join the same lobby code.
- Players see each other in the same world.
- Shared server-controlled enemies.
- Players attack the same mobs.
- Shared enemy HP.
- Shared waves and shared bosses.
- Enemy and boss health scales upward as more players join.
- Player movement, name, HP, weapon name, realm, score, and shooting visuals sync.

Important:
- This is still a lightweight browser co-op build, not a full MMO.
- Browser/local account progress should survive Render redeploys.
- The current active lobby/wave resets when Render redeploys or the server sleeps.
- For true online accounts across devices, add a database later.

How to run locally:
1. Install Node.js.
2. Open this folder in a terminal.
3. Run:
   npm install
4. Run:
   npm start
5. Open:
   http://localhost:3000

How to play together:
1. Host it on Render as a Web Service.
2. All players open the same Render URL.
3. Everyone enters the same lobby code, for example:
   reef
4. Up to 6 players can join that lobby.

Render settings:
- Service type: Web Service
- Runtime: Node
- Build command: npm install
- Start command: npm start
- Instance type: Free

Notes:
- Free Render can sleep after inactivity. The first load may take time.
- For 6 players, Free Render may lag if there are too many enemies. If that happens, reduce enemy count or use a paid instance.
