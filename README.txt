Tidefall.io — 6 Player Co-op, Old Biomes + Weapon Drops Restored

This patch fixes the missing weapon drops in multiplayer.

Why it happened:
- In single-player, the browser killed enemies locally and called maybeDropWeaponLoot().
- In the shared-enemy co-op build, the server kills enemies instead.
- That meant the old browser-only weapon drop function was bypassed.

Fix:
- The server now rolls weapon drops when shared enemies die.
- The reward message sends weaponDrop data to the player.
- The browser spawns that weapon as ground loot near the killed enemy.
- Duplicate weapon drops still convert into weapon scrap.
- Old biome creature models and 6-player shared HP remain enabled.

Drop tuning:
- Normal mobs: low chance.
- Elites: much better chance.
- Bosses: high chance.
- Final bosses: guaranteed weapon drop.

How to update Render:
1. Unzip this build.
2. Replace your GitHub repo files with:
   server.js
   package.json
   README.txt
   public/index.html
3. Commit changes.
4. Let Render redeploy, or use Manual Deploy → Deploy latest commit.
5. Hard refresh the game page after deployment.
