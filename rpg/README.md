# Ashes of Emberfall

A small text RPG for the terminal. It's pure Python with no dependencies.

```
python3 rpg/game.py
```

Explore six areas, fight monsters, level up, gear up at the village shop, find the crypt key,
and defeat the Ember Lich. Type `help` in game for commands. Type `save` to save your progress to `rpg/save.json`.

The game's content is plain dictionaries at the top of `game.py` (`ITEMS`, `ENEMIES`, `ROOMS`, `NPCS`).
You can add a room, monster or item by adding an entry there.
