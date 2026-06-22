Tidefall.io — 6 Player Shared-Enemy Co-op, Biome Creature Fix

This patch fixes the problem where co-op enemies looked too similar/player-like and rushed too fast.

Fixes:
- Shared co-op mobs now use real creature rendering instead of one generic enemy shape.
- Each biome now has its own co-op creature catalog:
  Reef, Deep Sea, Space, Sky, Ember, Crystal, and Void.
- The server chooses enemies based on the players' current biome.
- Enemy movement speed has been reduced.
- Contact damage cooldown is slower, so mobs do not instantly shred players.
- Spawns happen farther away from players and outside the plaza safe zone.
- Spawn bursts and max on-screen mobs have been reduced for less dogpiling.
- 6-player shared enemies and shared HP remain enabled.

How to update Render:
1. Unzip this build.
2. Replace the GitHub repo files with:
   server.js
   package.json
   README.txt
   public/index.html
3. Commit changes.
4. Render redeploys automatically, or use Manual Deploy → Deploy latest commit.
5. Hard refresh the game page after deploy.

Progress:
- Browser/local account progress should survive.
- Active online lobby/waves reset after redeploy.
