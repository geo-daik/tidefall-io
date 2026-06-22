Tidefall.io — 2 Player Lobby Build

This is the first real multiplayer version. It supports a 2-player lobby with WebSocket syncing.

What works:
- Two players can join the same lobby code.
- Players see each other in the same world.
- Player movement, name, HP, weapon name, realm, score, and shooting visuals sync.
- Rooms are limited to 2 players.

Important:
- This is a real-time lobby starter, not a fully authoritative MMO server yet.
- Enemy AI and drops are still mostly client-side. For fully shared enemies, shared loot, anti-cheat, and permanent online accounts, the next step is an authoritative server/database.

How to run:
1. Install Node.js.
2. Open this folder in a terminal.
3. Run:
   npm install
4. Run:
   npm start
5. Open:
   http://localhost:3000

How to play together on the same Wi-Fi:
1. One computer runs the server.
2. Find that computer's local IP address.
3. The other player opens:
   http://YOUR_LOCAL_IP:3000
4. Both players use the same lobby code, for example:
   reef

How to put it online:
- Host this Node.js app on Render, Railway, Fly.io, a VPS, or another Node-compatible host.
- Static-only hosts like GitHub Pages or Netlify Drop are not enough for real-time lobbies unless you also run this server somewhere.
