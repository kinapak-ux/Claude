# Ashlands

A grim post-apocalyptic text RPG with permadeath. It's one Python file with no dependencies, and it runs in the terminal or in a browser.

```
python3 rpg/game.py
```

To play in a browser, serve the folder and open `index.html`. The page runs the same `game.py` through
Pyodide, which it loads from the jsDelivr CDN:

```
cd rpg && python3 -m http.server 8000   # then open http://localhost:8000
```

**Content warning:** graphic violence, cannibalism, slavery, suicide, drug addiction and strong language.

It's 2161. Shelter 41's water chip is failing, and the Overseer reads out your name at assembly.
Outside, the Red Teeth raiders are bleeding the shanty town of Dustwater dry. In Rivet, the zealots of the
Iron Covenant offer to help. Their help has a price.

## What's in it
- **An open world:** an 11x9 wasteland with fog of war and a `map` command. Move tile by tile across ash flats, ruins,
  dead forest, highways and the radioactive Glow. A black river divides the map, and only two bridges cross it.
- **Room-based interiors:** the Pit (the raider stadium), St. Agnes Hospital (the organ harvesters) and a crashed
  military transport at the bottom of a bomb crater, with a mutant brood mother inside.
- **Permadeath:** the game saves after every action, and there is no load command. If you close the game mid-fight, the fight
  resumes when you restart. When you die, your save is deleted and your epitaph goes on the Memorial Wall.
- **Stats:** STR, AIM, END, CHA, WIT and LCK. Choose one of four backgrounds or spend the points yourself, and gain
  another point each level. Stat checks unlock dialogue options.
- **Companions who can die for good:** Mara (a freed captive), Tomas (a caravan guard you can save) and Ash (a dog). Each one
  reacts to what you do and can walk out on you.
- **Ammo and weapon wear:** guns use 10mm rounds, shells or energy cells, and you club with them when you run out. Weapons and
  armor wear down, and worn guns jam. Repair them with scrap metal or at a trader.
- **Survival:** hunger, thirst and radiation (which lowers your max HP). Rush gives a damage boost but is addictive.
- **Two towns and two factions:** Dustwater and Rivet. Side with the Covenant, expose its leader, or blackmail him.
- **Moral choices with no clean answers:** they affect your karma and an ending made of short epilogue passages.
  The ending covers each town, each faction, the shelter that exiled you, and every companion.

## Map
```
    0123456789A
  0 ggg.fff~.^^      S Shelter 41    D Dustwater     R Rivet
  1 gXg.fMf~.^R      C Crossroads    K Slaver pen    M Hollis farm
  2 gg..=V=B==^      T Radio tower   V Caravan       W School bus
  3 ...=.T.~.^.      X Glow crater   H St. Agnes     P The Pit
  4 S==C...~.H.      U Storm drain   B Bridge        ~ River
  5 ..D..^^~...
  6 .f..K^^B=P.
  7 ff.W...~..U
  8 f......~...
```
(Spoiler: in game, you only see the tiles you've explored.)

All content is data and small functions in `game.py`: `ITEMS`, `ENEMIES`, `COMPANIONS`, `WORLD`, `TERRAIN`,
`LOCATIONS`, `DUNGEONS`, `EVENTS` and `NPCS`.
