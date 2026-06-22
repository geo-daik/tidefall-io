Tidefall.io — 6 Player Co-op, Old Biomes Restored

This build keeps the stable 6-player shared-enemy multiplayer, but restores the old creature model system and biome pools.

Fixes:
- Removed the bad generic co-op mob rendering.
- Re-added old creature visuals: fish, crab, eel, puffer, jelly, shark, angler, urchin, squid, turtle, manta, barracuda, stingray, clam, nautilus, shrimp, siren, bosses, and final bosses.
- Re-added old biome creature pools:
  Deep Sea, Reef, Space, Sky, Ember, Crystal, Void.
- The server now sends each enemy's old model type/role/realm to the browser.
- Biomes should spawn their own creature families again.
- Spawn amount is back up: bigger waves and more mobs on screen.
- 6-player lobby, shared enemy HP, shared waves, and safe plaza are still enabled.

How to update Render:
1. Unzip this build.
2. Replace your GitHub repo files with:
   server.js
   package.json
   README.txt
   public/index.html
3. Commit changes.
4. Let Render redeploy, or click Manual Deploy → Deploy latest commit.
5. Hard refresh the game page after deploy.

Progress:
- Local/browser accounts should survive.
- Active lobby/wave resets after redeploy.
