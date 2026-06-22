Tidefall.io — 6 Player Shared-Enemy Co-op Server Build, Safe Plaza Fix

This version fixes the bug where co-op enemies spawned inside the Deep Sea Plaza.

What works:
- Up to 6 players can join the same lobby code.
- Shared server-controlled enemies.
- Players attack the same mobs with shared HP.
- The Deep Sea Plaza is now a true online safe zone.
- If all players are inside the plaza, the server clears/despawns enemies and pauses combat spawning.
- Enemies spawn outside the plaza safe radius.
- Safe players are ignored by enemy targeting.
- Enemy and boss health scale up with player count.

How to update Render:
1. Unzip this folder.
2. Upload/replace these files in your GitHub repo:
   server.js
   package.json
   README.txt
   public/index.html
3. Commit changes.
4. Render should redeploy automatically.
5. Refresh the Render game page after deploy.

Important:
- Browser/local account progress should survive this update.
- Active lobby/wave resets after redeploy.
