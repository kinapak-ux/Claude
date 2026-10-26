# Ashlands

A post-apocalyptic text RPG for the terminal, with permadeath. It's pure Python with no dependencies.

```
python3 rpg/game.py
```

**Content warning:** violence, drug use and addiction, slavery and strong language.

It's 2161. Shelter 41 is failing, and the Overseer has thrown you out to save rations.
You start with a pipe wrench, two stimpaks and a can of beans. The Red Teeth raiders
are bleeding the shanty town of Dustwater dry, and someone has to deal with their warlord.

## Features
- **Permadeath:** the game saves after every action and there is no load command. When you die, your
  save is deleted and your epitaph goes on the Memorial Wall. The Memorial Wall is shown on the title screen.
  Killing the game in the middle of a fight doesn't help, because the fight resumes when you restart.
- **Radiation:** rads lower your max HP. Get rid of them with RadAway or Doc Halloran's treatment.
- **Chems:** Rush gives you a big damage boost, but it can get you addicted. Withdrawal lowers your attack until you get clean.
- **Karma:** moral choices (a dying caravan guard, a slaver's offer, what to do with the
  surviving raiders) change the dialogue, your title and the ending.

The game's content is plain data and small functions in `game.py`: `ITEMS`, `ENEMIES`, `ROOMS`, `EVENTS` and `NPCS`.
