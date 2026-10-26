#!/usr/bin/env python3
"""ASHLANDS - a grim post-apocalyptic text RPG with permadeath.

Terminal:  python3 rpg/game.py
Browser:   rpg/index.html runs this same file through Pyodide.

Contains graphic violence, cannibalism, slavery, suicide, drug addiction and strong language.
"""

import asyncio
import json
import os
import random
import sys
import textwrap

BROWSER = sys.platform == "emscripten"
if BROWSER:
    import js  # provided by Pyodide

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else "."
SAVE_NAME = "save.json"
MEMORIAL_NAME = "memorial.txt"
SAVE_VERSION = 2


# ================================================================ io


class Quit(Exception):
    pass


def out(text):
    if BROWSER:
        js.gameIO.write(text)
    else:
        print(text)


def say(text=""):
    for para in str(text).split("\n"):
        if not BROWSER and len(para) > 88:
            para = textwrap.fill(para, 88)
        out(para)


async def ask(prompt="> ", raw=False, keys=None):
    """keys: suggested answers, shown as buttons in the browser."""
    if BROWSER:
        text = str(await js.gameIO.ask(prompt, "|".join(keys or [])))
    else:
        try:
            text = input(prompt)
        except (EOFError, KeyboardInterrupt):
            print("\nYou close your eyes for a moment. (Progress is saved.)")
            raise Quit
    return text.strip() if raw else text.strip().lower()


def store_read(name):
    if BROWSER:
        return str(js.gameIO.load(name)) or None
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return f.read()


def store_write(name, text):
    if BROWSER:
        js.gameIO.store(name, text)
        return
    with open(os.path.join(HERE, name), "w") as f:
        f.write(text)


def store_delete(name):
    if BROWSER:
        js.gameIO.remove(name)
    elif os.path.exists(os.path.join(HERE, name)):
        os.remove(os.path.join(HERE, name))


def bar(cur, mx, width=20):
    mx = max(mx, 1)
    filled = int(width * max(min(cur, mx), 0) / mx)
    return "[" + "#" * filled + "-" * (width - filled) + f"] {max(cur, 0)}/{mx}"


async def choose(player, options):
    """Numbered menu. Each option is text, or (text, (STAT, needed)) for a stat check.
    Returns the 1-based pick."""
    for n, opt in enumerate(options, 1):
        text, req = (opt, None) if isinstance(opt, str) else opt
        if req:
            ok = player.stats[req[0]] >= req[1]
            text = f"[{req[0]} {req[1]}] {text}" + ("" if ok else " (locked)")
        say(f"  {n}. {text}")
    while True:
        pick = await ask("Choose > ", keys=[str(n) for n in range(1, len(options) + 1)])
        if pick.isdigit() and 1 <= int(pick) <= len(options):
            opt = options[int(pick) - 1]
            if not isinstance(opt, str) and opt[1] and player.stats[opt[1][0]] < opt[1][1]:
                say("You don't have it in you.")
                continue
            return int(pick)


# ================================================================ data: items

ITEMS = {
    # healing and chems
    "stimpak":      {"name": "Stimpak", "kind": "heal", "power": 30, "price": 25,
                     "desc": "Restores 30 HP. The serum is faintly pink. Don't ask why."},
    "super_stim":   {"name": "Super Stim", "kind": "heal", "power": 70, "price": 60,
                     "desc": "Restores 70 HP."},
    "radaway":      {"name": "RadAway", "kind": "radaway", "power": 60, "price": 30,
                     "desc": "Flushes 60 rads."},
    "rush":         {"name": "Rush", "kind": "chem", "power": 6, "price": 20,
                     "desc": "+6 attack for your next fight. Highly addictive."},
    # food and water
    "beans":        {"name": "Irradiated Beans", "kind": "food", "power": 25, "rads": 5, "price": 5,
                     "desc": "+25 food, +5 rads."},
    "jerky":        {"name": "Jerky", "kind": "food", "power": 35, "price": 12,
                     "desc": "+35 food. The trader wouldn't say what animal."},
    "dog_meat":     {"name": "Dog Meat", "kind": "food", "power": 35, "price": 6,
                     "desc": "+35 food. Stringy."},
    "mystery_meat": {"name": "Hollis Stew Meat", "kind": "food", "power": 50, "price": 0,
                     "desc": "+50 food. Long pig."},
    "dirty_water":  {"name": "Dirty Water", "kind": "drink", "power": 30, "rads": 10, "price": 3,
                     "desc": "+30 water, +10 rads."},
    "water":        {"name": "Purified Water", "kind": "drink", "power": 45, "price": 15,
                     "desc": "+45 water. Worth killing for. People do."},
    # thrown
    "grenade":      {"name": "Pipe Grenade", "kind": "grenade", "power": 35, "price": 30,
                     "desc": "Deals 35 damage."},
    # ammo (goes straight into your ammo pouch)
    "ammo_10mm":    {"name": "10mm Rounds", "kind": "ammo", "ammo": "10mm", "count": 12, "price": 15,
                     "desc": "12 rounds."},
    "ammo_shells":  {"name": "Shotgun Shells", "kind": "ammo", "ammo": "shells", "count": 6, "price": 18,
                     "desc": "6 shells."},
    "ammo_cells":   {"name": "Energy Cells", "kind": "ammo", "ammo": "cells", "count": 10, "price": 30,
                     "desc": "10 cells."},
    # weapons
    "pipe_wrench":  {"name": "Pipe Wrench", "kind": "weapon", "type": "melee", "power": 2, "price": 4,
                     "desc": "Melee +2."},
    "machete":      {"name": "Machete", "kind": "weapon", "type": "melee", "power": 4, "price": 20,
                     "desc": "Melee +4."},
    "cleaver":      {"name": "Butcher's Cleaver", "kind": "weapon", "type": "melee", "power": 7, "price": 45,
                     "desc": "Melee +7. From the Hollis kitchen. It has seen a lot of use."},
    "bonesaw":      {"name": "Surgeon's Bonesaw", "kind": "weapon", "type": "melee", "power": 10, "price": 80,
                     "desc": "Melee +10. Serrated. Still sticky."},
    "pistol":       {"name": "10mm Pistol", "kind": "weapon", "type": "gun", "ammo": "10mm", "power": 6,
                     "price": 60, "desc": "Gun +6. Uses 10mm."},
    "smg":          {"name": "10mm SMG", "kind": "weapon", "type": "gun", "ammo": "10mm", "power": 9,
                     "ammo_use": 2, "price": 120, "desc": "Gun +9. Eats two 10mm a burst."},
    "shotgun":      {"name": "Sawn-off Shotgun", "kind": "weapon", "type": "gun", "ammo": "shells",
                     "power": 10, "price": 110, "desc": "Gun +10. Uses shells."},
    "lance":        {"name": "Covenant Lance", "kind": "weapon", "type": "gun", "ammo": "cells",
                     "power": 12, "price": 220, "desc": "Gun +12. Uses cells. Engraved: PURITY IS MERCY."},
    "plasma":       {"name": "Prototype Plasma Rifle", "kind": "weapon", "type": "gun", "ammo": "cells",
                     "power": 15, "price": 250, "desc": "Gun +15. Uses cells. Melts people into green jelly."},
    # armor
    "shelter_suit": {"name": "Shelter 41 Jumpsuit", "kind": "armor", "power": 1, "price": 2,
                     "desc": "Defense +1. Blue and yellow. A target."},
    "leathers":     {"name": "Road Leathers", "kind": "armor", "power": 3, "price": 40,
                     "desc": "Defense +3."},
    "raider_armor": {"name": "Spiked Raider Armor", "kind": "armor", "power": 4, "price": 30,
                     "desc": "Defense +4. Smells like its last owner."},
    "combat_armor": {"name": "Patched Combat Armor", "kind": "armor", "power": 6, "price": 140,
                     "desc": "Defense +6."},
    "covenant_plate": {"name": "Covenant Plate", "kind": "armor", "power": 8, "price": 300,
                       "desc": "Defense +8. White enamel over steel. Blood shows up nicely on it."},
    # junk
    "scrap":        {"name": "Scrap Metal", "kind": "junk", "price": 8,
                     "desc": "Use it to patch your gear (repair)."},
    "watch":        {"name": "Pre-war Watch", "kind": "junk", "price": 30, "desc": "Stopped at 9:47."},
    "ring":         {"name": "Wedding Ring", "kind": "junk", "price": 20,
                     "desc": "Still on the finger when you found it."},
    "teeth":        {"name": "Gold Teeth", "kind": "junk", "price": 15, "desc": "A handful."},
    # quest
    "gate_pass":    {"name": "Red Teeth Gate Pass", "kind": "key", "price": 0,
                     "desc": "A dog tag stamped with a bloody grin. Opens the Pit."},
    "ledger":       {"name": "Harvester Ledger", "kind": "key", "price": 0,
                     "desc": "Buyers of organs and blood, in neat handwriting. Some names will surprise you."},
    "purifier":     {"name": "Purification Module", "kind": "key", "price": 0,
                     "desc": "Pre-war water purification core. Enough clean water for a town. Or a shelter."},
}

# ================================================================ data: enemies

ENEMIES = {
    "rat":       {"name": "Bloat Rat", "hp": 14, "atk": 5, "def": 0, "xp": 6, "caps": (0, 3),
                  "drops": ["dog_meat"]},
    "dog":       {"name": "Feral Dog", "hp": 22, "atk": 7, "def": 1, "xp": 10, "caps": (0, 0),
                  "drops": ["dog_meat"]},
    "wolf":      {"name": "Ash Wolf", "hp": 28, "atk": 9, "def": 1, "xp": 14, "caps": (0, 0),
                  "drops": ["dog_meat"]},
    "raider":    {"name": "Red Teeth Raider", "hp": 30, "atk": 9, "def": 2, "xp": 18, "human": True, "caps": (5, 15),
                  "drops": ["rush", "stimpak", "raider_armor", "ammo_10mm", "ammo_shells", "teeth"]},
    "butcher":   {"name": "Red Teeth Butcher", "hp": 48, "atk": 12, "def": 3, "xp": 30, "human": True, "caps": (10, 25),
                  "drops": ["ammo_shells", "rush", "cleaver"]},
    "pit_hound": {"name": "Pit Hound", "hp": 28, "atk": 10, "def": 1, "xp": 14, "caps": (0, 0)},
    "slaver":    {"name": "Slaver", "hp": 34, "atk": 10, "def": 3, "xp": 20, "human": True, "caps": (10, 20),
                  "drops": ["stimpak", "pistol", "ammo_10mm"]},
    "husk":      {"name": "Husk", "hp": 26, "atk": 9, "def": 1, "xp": 15, "caps": (0, 5), "rads": 6,
                  "drops": ["ring", "watch"]},
    "stinger":   {"name": "Stingback", "hp": 45, "atk": 13, "def": 5, "xp": 30, "caps": (0, 0), "rads": 4},
    "brute":     {"name": "Ash Brute", "hp": 60, "atk": 15, "def": 4, "xp": 45, "caps": (5, 15), "rads": 8,
                  "drops": ["ammo_cells", "super_stim"]},
    "hollis":    {"name": "Hollis Boy", "hp": 36, "atk": 11, "def": 2, "xp": 22, "human": True, "caps": (2, 10),
                  "drops": ["mystery_meat"]},
    "harvester": {"name": "Harvester Orderly", "hp": 38, "atk": 12, "def": 3, "xp": 26, "human": True, "caps": (5, 15),
                  "drops": ["stimpak", "super_stim", "ammo_10mm"]},
    "failed":    {"name": "Failed Subject", "hp": 30, "atk": 11, "def": 1, "xp": 18, "caps": (0, 0), "rads": 5},
    "zealot":    {"name": "Covenant Zealot", "hp": 45, "atk": 13, "def": 5, "xp": 32, "human": True,
                  "caps": (10, 20), "drops": ["ammo_cells", "water"]},
    "tollman":   {"name": "The Tollman", "hp": 95, "atk": 16, "def": 4, "xp": 70, "human": True, "caps": (40, 80),
                  "boss": True, "special": "The Tollman swings his sack of heads like a flail!"},
    "brennan":   {"name": "Brennan the Slaver", "hp": 80, "atk": 15, "def": 4, "xp": 50, "human": True, "caps": (80, 80),
                  "boss": True},
    "surgeon":   {"name": "The Surgeon", "hp": 160, "atk": 24, "def": 5, "xp": 150, "human": True, "caps": (60, 60),
                  "boss": True, "special": "The Surgeon's bonesaw bites down to the bone!"},
    "mother":    {"name": "The Mother", "hp": 190, "atk": 25, "def": 5, "xp": 180, "caps": (0, 0),
                  "boss": True, "rads": 8, "special": "The Mother vomits a stream of glowing larvae over you!"},
    "kessler":   {"name": "Warlord Kessler", "hp": 220, "atk": 24, "def": 6, "xp": 250, "human": True, "caps": (200, 200),
                  "boss": True, "special": "Kessler rakes you with the chainsaw!"},
}

# ================================================================ data: companions

COMPANIONS = {
    "mara": {"name": "Mara", "hp": 65, "atk": 11, "def": 3, "unlock": "captives_freed",
             "attacks": ["drives a rebar spike into it", "smashes it with a tyre iron", "goes for the eyes"],
             "death": "Mara goes down with the {enemy} on top of her. She doesn't scream. When it's over "
                      "you close her eyes. Even dead, they look angry."},
    "tomas": {"name": "Tomas", "hp": 55, "atk": 9, "def": 2, "unlock": "tomas_saved",
              "attacks": ["puts a revolver round in it", "fires twice, steady"],
              "death": "Tomas steps into the blow meant for you. \"Tell Lina...\" He doesn't finish. "
                       "You'll have to decide what to tell her."},
    "ash": {"name": "Ash", "hp": 45, "atk": 10, "def": 1, "unlock": "ash_found",
            "attacks": ["tears at its throat", "savages its leg"],
            "death": "Ash yelps once, then nothing. He tried to crawl back to you at the end. "
                     "That's the part you'll remember."},
}

# ================================================================ data: the overworld

WORLD = [
    "ggg.fff~.^^",
    "gXg.fMf~.^R",
    "gg..=V=Q==^",
    "...=.T.~.^.",
    "S==C...~.H.",
    "..D..^^~...",
    ".f..K^^B=P.",
    "ff.W...~..U",
    "f......~...",
]
WIDTH, HEIGHT = len(WORLD[0]), len(WORLD)
START = [0, 4]
DIRS = {"north": (0, -1), "south": (0, 1), "east": (1, 0), "west": (-1, 0)}
ALIASES = {"n": "north", "s": "south", "e": "east", "w": "west", "u": "up", "d": "down"}

TERRAIN = {
    ".": {"name": "Ash Flats", "enc": 0.25, "rads": 1, "enemies": ["dog", "rat", "raider", "wolf"],
          "loot": ["scrap", "beans", "dirty_water", "ammo_10mm", "watch", "ring"],
          "flavor": [
              "Grey ash to the horizon. A child's shoe, just the one, half-buried.",
              "A ring of stone cairns. Under each, something small.",
              "Tyre tracks and drag marks lead east. The drag marks are darker.",
              "A dead man sits against a signpost with a sign around his neck: THIEF. The crows took his "
              "eyes and started on the rest.",
              "Wind moans through a field of bleached cattle ribs.",
              "A burned-out caravan. Whoever did this took the people and left the cargo.",
              "A shallow grave someone didn't finish digging. The shovel is still here. So is the digger.",
          ]},
    "^": {"name": "Ruins", "enc": 0.35, "rads": 3, "enemies": ["husk", "raider", "rat", "husk"],
          "loot": ["scrap", "stimpak", "ammo_10mm", "ammo_shells", "beans", "teeth", "watch"],
          "flavor": [
              "An apartment block, sheared in half. On one wall, burned-in shadows: a mother lifting a child.",
              "A pre-war school. The desks are still in rows. So are the students.",
              "Someone has written HE IS NOT COMING on every wall of this street.",
              "A church with no roof. Where the crucifix was, someone has nailed up a husk. It's still moving.",
              "A looted supermarket. In the freezer aisle, a nest of something, and bones it didn't finish.",
              "A billboard: YOUR FAMILY IS SAFE WITH US. Bullet holes through each smiling face.",
          ]},
    "=": {"name": "Highway", "enc": 0.3, "rads": 1, "enemies": ["raider", "raider", "dog", "slaver"],
          "loot": ["scrap", "ammo_shells", "dirty_water", "jerky", "grenade"],
          "flavor": [
              "Cars jammed bumper to bumper, doors flung open. They ran. It didn't help.",
              "A bus on its side. The windows are painted over from the inside.",
              "A roadblock of bodies wired together across the lanes. A Red Teeth warning.",
              "Skid marks end at a crater. Nothing else is left.",
          ]},
    "f": {"name": "Dead Forest", "enc": 0.3, "rads": 2, "enemies": ["wolf", "dog", "stinger"],
          "loot": ["beans", "scrap", "rush", "dog_meat"],
          "flavor": [
              "Black, leafless trees creak like old doors. Someone hung wind chimes made of finger bones.",
              "A clearing with a single noose, cut. Someone changed their mind, or someone was hungry.",
              "Claw marks score the trunks at head height. Fresh sap bleeds from them.",
          ]},
    "g": {"name": "The Glow", "enc": 0.35, "rads": 15, "enemies": ["husk", "stinger", "brute"],
          "loot": ["radaway", "ammo_cells", "stimpak", "scrap"],
          "flavor": [
              "The ground glitters like broken glass and your counter screams.",
              "Shapes in the green haze. Some of them are walking. None of them should be.",
              "A deer with two heads lies dead, both mouths open.",
          ]},
    "B": {"name": "River Bridge", "enc": 0.25, "rads": 2, "enemies": ["raider", "slaver"],
          "loot": ["dirty_water", "scrap"],
          "flavor": [
              "A bridge over a black, oily river. Bodies bob against the pylons, snagged.",
              "The bridge sags in the middle. Below, the river moves slow and thick as tar.",
          ]},
}

LOCATIONS = {
    "S": {"name": "Shelter 41 - The Door", "event": "shelter", "repeat_event": True,
          "desc": "A steel door the size of a house, set into the hillside, painted with a cheerful 41. "
                  "Beneath it, scratched into the paint: THEY DON'T OPEN. An intercom box glows beside it."},
    "C": {"name": "The Crossroads", "loot": ["scrap", "beans"],
          "desc": "A collapsed overpass casts long shadows. A skeleton in a business suit waits at the bus "
                  "stop. Hand-painted signs: DUSTWATER (south-west). RIVET - CLEAN WATER - NO TAINTED "
                  "(north-east). Someone has added underneath: NO HOPE EITHER."},
    "D": {"name": "Dustwater", "town": "dustwater"},
    "R": {"name": "Rivet", "town": "rivet"},
    "K": {"name": "Brennan's Pen", "event": "slavers", "repeat_event": True,
          "desc": lambda p: (
              "Empty cages, doors hanging open. Flies." if "captives_freed" in p.flags else
              "The cages are fuller now. Some of the faces are from Dustwater. One of them recognises you."
              if "sold_out" in p.flags else
              "A fenced lot behind a gutted gas station. Cages made from shopping carts and rebar. "
              "The people inside don't look up any more.")},
    "V": {"name": "Caravan Wreck", "event": "caravan",
          "desc": "An overturned cart on the highway, its pack ox opened up by raiders. Flies everywhere."},
    "M": {"name": "Hollis Farm", "event": "hollis", "repeat_event": True,
          "desc": lambda p: (
              "The farmhouse door hangs open. The smell from the cellar has gotten worse."
              if "hollis_dead" in p.flags else
              "A farmhouse with fresh paint, of all things. A vegetable garden. Smoke from the chimney "
              "smells like roast pork. A hand-carved sign: HOLLIS FARM - TRAVELLERS WELCOME.")},
    "T": {"name": "Radio Tower", "event": "tower",
          "desc": "A rusted radio mast with a shack at its base. A loudspeaker on the mast plays a woman's "
                  "voice on a loop: \"...if anyone can hear this, the children are safe now. The children "
                  "are safe now. If anyone can hear this...\""},
    "W": {"name": "School Bus", "event": "dog",
          "desc": "A yellow school bus on its side in a ditch. Small skeletons still sit in rows inside, "
                  "seatbelts on. Something growls."},
    "U": {"name": "Storm Drain", "event": "drain", "repeat_event": True,
          "desc": "A concrete storm drain in a gully, grated over. Water trickles out of it, and so does "
                  "the sound of a crowd, very far away, chanting."},
    "Q": {"name": "Tollman's Bridge", "event": "tollman", "repeat_event": True, "rads": 2,
          "desc": lambda p: (
              "The north bridge. The Tollman's gibbet still hangs from the middle span, empty now."
              if "tollman_dead" in p.flags or "toll_free" in p.flags else
              "The north bridge over the black river. A gibbet hangs from the middle span. Under it sits the "
              "Tollman: a huge man in a stovepipe hat, a sack of heads at his feet. Each one got his riddle "
              "wrong.")},
    "X": {"name": "Glow Crater - Rim", "dungeon": ("crater", "x_rim"), "rads": 10,
          "desc": "The edge of the bomb crater. The ground drops away into a green-lit bowl of glass. "
                  "Something huge has crashed at the bottom: a military transport."},
    "H": {"name": "St. Agnes Hospital", "dungeon": ("hospital", "h_lobby"),
          "desc": "Six storeys of black windows. Fresh tyre tracks lead into the ambulance bay, and the "
                  "red cross on the roof has been repainted recently, in something that dried brown."},
    "P": {"name": "The Pit - Outer Gate", "dungeon": ("pit", "pit_yard"),
          "desc": "The old stadium, walled with car hulks and razor wire. Bodies hang from the gate, some "
                  "fresh. A sign made of human teeth spells THE PIT. Raiders lean on the gate, laughing."},
}

TOWNS = {
    "dustwater": {
        "shop": ["stimpak", "beans", "jerky", "dirty_water", "water", "radaway", "rush", "grenade",
                 "ammo_10mm", "ammo_shells", "machete", "pistol", "shotgun", "leathers", "combat_armor"],
        "trader": "Vee", "rest": 10, "game": "blackjack",
        "npcs": ["okafor", "vee", "doc", "mara", "tomas", "ash"],
    },
    "rivet": {
        "shop": ["stimpak", "super_stim", "water", "radaway", "ammo_10mm", "ammo_shells", "ammo_cells",
                 "smg", "lance", "combat_armor", ("covenant_plate", "covenant_allied")],
        "trader": "Quartermaster Ide", "rest": 15, "game": "liars_dice",
        "terminal": {"id": "armoury", "title": "IRON COVENANT ARMOURY - QUARTERMASTER ACCESS",
                     "reward": ["lance", "ammo_cells", "ammo_cells", "combat_armor"], "alarm": "zealot",
                     "opens": "The cage door clicks open. Lance, cells, armour. Ide is very busy looking the other way."},
        "npcs": ["vance", "ide", "jory"],
    },
}


def town_desc(player, town):
    f = player.flags
    if town == "dustwater":
        if "dustwater_annexed" in f:
            text = ("Covenant banners hang from the dam wall. Zealots stand at the gate, checking skin for "
                    "sores. A body swings from the purifier tower: someone who failed the inspection.")
        else:
            text = ("A shanty town in the bowl of a dried-up reservoir. Sheet-metal shacks, a water "
                    "purifier that wheezes like a dying man, and a bar called The Last Drop. Vee's "
                    "trading post leans against the dam wall. Sheriff Okafor watches the gate. Doc "
                    "Halloran's clinic sign reads: NO CHEMS ON CREDIT.")
        if "dustwater_purifier" in f:
            text += " The purifier runs smooth and quiet now. Children play in the overflow."
        if "robbed_tomas" in f:
            text += (" A girl of about ten waits by the gate, asking every caravan if they've seen her "
                     "father, Tomas.")
        if "sold_out" in f:
            text += " Three shacks on the east side stand empty, doors kicked in."
        return text
    if "covenant_exposed" in f:
        return ("Rivet's banners are torn down. The pump house is guarded by townsfolk with pitchforks "
                "and old rifles. Vance's body hangs from his own pulpit. Quartermaster Ide still runs "
                "the armoury. Business is business.")
    return ("A fortified town around the only working deep-well pump for fifty miles. Clean water, "
            "clean streets, clean white tabards on the Iron Covenant zealots. At the gate, a row of "
            "stakes: the tainted, burned for the sin of mutation. Prior Vance preaches from the pump "
            "house steps. Quartermaster Ide runs the armoury.")


# ================================================================ data: dungeons (room-based interiors)

DUNGEONS = {
    "pit": {
        "pit_yard": {
            "name": "The Pit - The Yard", "out": "P",
            "desc": "Inside the walls. Bonfires in oil drums, raiders gambling with teeth, a cage full of "
                    "people being fattened on slop. North, a refrigerated trailer marked MEAT. East, the "
                    "roar of the arena. A manhole leads down.",
            "exits": {"north": "pit_locker", "east": "pit_arena", "down": "pit_tunnels"},
            "event": "cage",
            "enemies": ["raider", "pit_hound", "butcher"], "loot": ["ammo_shells", "rush", "jerky"]},
        "pit_locker": {
            "name": "The Meat Locker",
            "desc": "Carcasses on hooks, swaying in the cold. Dogs. Cattle. People. Labels on each one "
                    "in grease pencil: TENDER. STRINGY. CHILD.",
            "exits": {"south": "pit_yard"}, "event": "locker", "loot": ["mystery_meat", "stimpak", "watch"]},
        "pit_tunnels": {
            "name": "Stadium Service Tunnels", "out": "U",
            "desc": "Concrete tunnels under the stands, ankle-deep in water and worse. A ladder leads up "
                    "to the yard; a passage east to the arena floor. A storm drain leads outside.",
            "exits": {"up": "pit_yard", "east": "pit_arena"},
            "enemies": ["rat", "husk", "pit_hound"], "loot": ["ammo_10mm", "scrap", "grenade"]},
        "pit_arena": {
            "name": "The Pit - Arena",
            "desc": "The stadium floor is a fighting ring stained black. Spectators bay from the stands. "
                    "On a throne of welded shopping carts sits Warlord Kessler: a giant in a blood-black "
                    "hockey mask, revving a chainsaw.",
            "exits": {"west": "pit_yard", "down": "pit_tunnels"},
            "boss": "kessler", "loot": ["combat_armor", "super_stim", "ammo_shells"],
            "safe": {"id": "kessler_box", "caps": 150, "loot": ["rush", "grenade", "grenade", "super_stim"],
                     "title": "Kessler's strongbox sits under his throne, with a three-digit combination lock.",
                     "trap": 30, "trap_text": "The box was wired. The blast throws you across the arena."}},
    },
    "hospital": {
        "h_lobby": {
            "name": "St. Agnes - Lobby", "out": "H",
            "desc": "A waiting room. Skeletons in the chairs, still waiting. Clean tile floors, mopped "
                    "recently. Muzak plays from somewhere. A sign: ALL ARE REDEEMED IN SERVICE. Stairs "
                    "lead up to the wards and down to the basement.",
            "exits": {"up": "h_ward", "down": "h_cold", "east": "h_pharmacy"},
            "gates": {"east": "open_st_agnes"},
            "terminal": {"id": "st_agnes", "title": "ST. AGNES RECORDS - PHARMACY LOCK", "alarm": "harvester",
                         "opens": "Somewhere east, a lock thunks open."},
            "enemies": ["harvester"], "loot": ["stimpak", "ammo_10mm"]},
        "h_pharmacy": {
            "name": "St. Agnes - Pharmacy",
            "desc": "Shelves of pink serum in neat rows. Each vial is labelled with a name and a date. Donors.",
            "exits": {"west": "h_lobby"},
            "loot": ["super_stim", "super_stim", "radaway", "radaway", "rush", "ammo_cells"]},
        "h_ward": {
            "name": "St. Agnes - Recovery Ward",
            "desc": "Twelve beds. Twelve people kept alive with tubes and leather straps, pieces of them "
                    "missing in tidy surgical portions. A door east is marked THEATRE.",
            "exits": {"down": "h_lobby", "east": "h_theatre"}, "event": "ward",
            "enemies": ["harvester"]},
        "h_theatre": {
            "name": "St. Agnes - Operating Theatre",
            "desc": "Bright surgical lamps run off a humming generator. A tall figure in a stained white "
                    "habit and a welding mask turns from the table, where someone is still breathing. "
                    "\"Another donor,\" says the Surgeon. \"How generous.\"",
            "exits": {"west": "h_ward"}, "boss": "surgeon",
            "loot": ["bonesaw", "ledger", "super_stim", "super_stim"]},
        "h_cold": {
            "name": "St. Agnes - Cold Storage",
            "desc": "Morgue drawers, all full. Coolers labelled by organ and blood type. In the corner, "
                    "the experiments that didn't take, chained to radiators, are waking up.",
            "exits": {"up": "h_lobby"}, "enemies": ["failed", "failed"],
            "loot": ["ammo_cells", "radaway", "super_stim"]},
    },
    "crater": {
        "x_rim": {
            "name": "Glow Crater - Rim", "out": "X", "rads": 12,
            "desc": "Glass ground slopes down into green light. Your teeth ache. Your counter has stopped "
                    "clicking and started to hum.",
            "exits": {"down": "x_floor"}},
        "x_floor": {
            "name": "Glow Crater - Floor", "rads": 18,
            "desc": "The crater floor. Burrows everywhere, big enough to crawl into. Stingback husks, "
                    "shed and empty. The transport wreck lies east.",
            "exits": {"up": "x_rim", "east": "x_wreck"},
            "enemies": ["stinger", "husk", "brute"], "loot": ["radaway", "ammo_cells"]},
        "x_wreck": {
            "name": "Transport Wreck - Cargo Bay", "rads": 10,
            "desc": "The cargo bay is a nest. Something vast and pale is fused into the bulkhead: a woman, "
                    "once, swollen to the size of a truck, with stingback limbs sprouting from her ribs. "
                    "Larvae pulse in sacs along the walls. She turns her human face toward you, and smiles.",
            "exits": {"west": "x_floor", "north": "x_cockpit"}, "boss": "mother",
            "loot": ["plasma", "ammo_cells", "ammo_cells"]},
        "x_cockpit": {
            "name": "Transport Wreck - Cockpit", "rads": 8,
            "desc": "Two pilots, still strapped in, mummified by heat. A sealed crate is marked "
                    "WATER PURIFICATION - PRIORITY CIVILIAN RELIEF. A holotape blinks on the console.",
            "exits": {"south": "x_wreck"}, "event": "pilot_log", "loot": ["purifier", "radaway"],
            "safe": {"id": "cockpit_safe", "caps": 80, "loot": ["ammo_cells", "ammo_cells", "super_stim", "grenade"],
                     "title": "An officer's safe is bolted under the co-pilot's seat. Three-digit dial.",
                     "trap": 25, "trap_text": "A canister in the door hisses. Nerve gas. You claw your way out, "
                                              "vomiting."}},
    },
}
ROOMS = {rid: room for rooms in DUNGEONS.values() for rid, room in rooms.items()}


def loc_pos(char):
    for y, row in enumerate(WORLD):
        x = row.find(char)
        if x >= 0:
            return [x, y]
    raise KeyError(char)


def pos_key(pos):
    return f"{pos[0]},{pos[1]}"


# ================================================================ player

STATS = ["STR", "AIM", "END", "CHA", "WIT", "LCK"]
STAT_HELP = {
    "STR": "Strength - melee damage",
    "AIM": "Aim - gun damage",
    "END": "Endurance - max HP, radiation resistance",
    "CHA": "Charm - prices, persuasion",
    "WIT": "Wits - repairs, XP, noticing things",
    "LCK": "Luck - criticals, escapes, scavenging",
}
ARCHETYPES = [  # (label, stats, extra starting kit, how you got it)
    ("Brawler", {"STR": 7, "AIM": 3, "END": 6, "CHA": 3, "WIT": 3, "LCK": 4}, ["machete"],
     "You took the machete from the hydroponics bay. Nobody tried to stop you."),
    ("Gunslinger", {"STR": 3, "AIM": 7, "END": 5, "CHA": 3, "WIT": 4, "LCK": 4}, ["pistol", "ammo_10mm"],
     "You stole your father's service pistol on the way out. He let you."),
    ("Silver Tongue", {"STR": 3, "AIM": 5, "END": 4, "CHA": 7, "WIT": 4, "LCK": 3}, ["water", "jerky"],
     "You talked the quartermaster out of a clean bottle of water and some jerky. Your last favour."),
    ("Scavenger", {"STR": 4, "AIM": 4, "END": 5, "CHA": 3, "WIT": 6, "LCK": 4}, ["scrap", "scrap", "stimpak"],
     "You filled your pockets from the junk room on the way out."),
]


class Player:
    def __init__(self, name, stats):
        self.version = SAVE_VERSION
        self.name = name
        self.stats = dict(stats)
        self.level = 1
        self.xp = 0
        self.stat_points = 0
        self.rads = 0
        self.hp = self.max_hp
        self.caps = 15
        self.inventory = ["stimpak", "beans", "dirty_water"]
        self.ammo = {"10mm": 0, "shells": 0, "cells": 0}
        self.weapon = "pipe_wrench"
        self.armor = "shelter_suit"
        self.cond = {}              # item id -> condition 0..100
        self.pos = list(START)
        self.room = None            # dungeon room id when inside one
        self.seen = []
        self.searched = []
        self.flags = []
        self.timers = {}
        self.karma = 0
        self.hunger = 80
        self.thirst = 80
        self.addicted = False
        self.high = False
        self.turns = 0
        self.kills = 0
        self.killer = None
        self.pending_fight = None
        self.companion = None
        self.comp_hp = {}
        self.perks = []
        self.perk_points = 0
        self.puzzles = {}           # generated puzzles, kept so reloading can't re-roll them
        self.bounty = None
        self.prev_pos = list(START)
        self.reveal()

    # ---- derived stats
    @property
    def max_hp(self):
        return 30 + self.stats["END"] * 4 + 10 * (self.level - 1)

    @property
    def cap_hp(self):
        return self.max_hp - self.rads // 10

    def gear_power(self, item_id):
        return round(ITEMS[item_id]["power"] * (0.5 + self.cond.get(item_id, 100) / 200))

    def out_of_ammo(self):
        w = ITEMS[self.weapon]
        return w["type"] == "gun" and self.ammo[w["ammo"]] <= 0

    @property
    def atk(self):
        w = ITEMS[self.weapon]
        if self.out_of_ammo():
            a = 3 + 2 * (self.level - 1) + self.stats["STR"] - 4
        else:
            stat = self.stats["AIM" if w["type"] == "gun" else "STR"]
            a = 4 + 2 * (self.level - 1) + stat - 4 + self.gear_power(self.weapon)
        if self.high:
            a += ITEMS["rush"]["power"]
        elif self.addicted:
            a -= 3
        if "night_owl" in self.perks and is_night(self):
            a += 3
        return max(1, a)

    @property
    def defense(self):
        return 1 + (self.level - 1) // 2 + self.gear_power(self.armor) + (2 if "toughness" in self.perks else 0)

    def price(self, item_id, selling=False):
        base = ITEMS[item_id]["price"]
        if selling:
            return max(1, round(base * (0.25 + 0.04 * self.stats["CHA"])))
        return max(1, round(base * (1.3 - 0.06 * self.stats["CHA"])))

    def karma_title(self):
        k = self.karma
        if k >= 6:
            return "Last Good Thing"
        if k >= 2:
            return "Samaritan"
        if k <= -6:
            return "Wasteland Butcher"
        if k <= -2:
            return "Scumbag"
        return "Drifter"

    def xp_needed(self):
        return 25 * self.level

    # ---- changes
    def gain_xp(self, amount):
        amount = round(amount * (1 + 0.05 * (self.stats["WIT"] - 3)))
        self.xp += amount
        while self.xp >= self.xp_needed():
            self.xp -= self.xp_needed()
            self.level += 1
            self.stat_points += 1
            self.hp = self.cap_hp
            say(f"*** LEVEL {self.level}. You heal, and something in you hardens. (+1 stat point) ***")
            if self.level % 2 == 0:
                self.perk_points += 1
                say("*** You can pick a new perk. ***")

    def add_rads(self, n, source="radiation sickness"):
        n = round(n * max(0.4, 1 - 0.06 * (self.stats["END"] - 3)) * (0.7 if "rad_child" in self.perks else 1))
        if n <= 0:
            return
        before = self.rads
        self.rads += n
        say(f"Your rad counter clicks. +{n} rads ({self.rads}).")
        for mark, msg in ((200, "Your gums are bleeding."), (400, "Your hair comes out in clumps."),
                          (600, "You're vomiting blood. You don't have long without treatment.")):
            if before < mark <= self.rads:
                say(msg)
        self.hp = min(self.hp, self.cap_hp)
        if self.cap_hp <= 0:
            self.hp = 0
            self.killer = source

    def heal(self, n):
        healed = max(0, min(n, self.cap_hp - self.hp))
        self.hp += healed
        return healed

    def karma_shift(self, n):
        self.karma += n
        say(f"(Karma {'+' if n > 0 else ''}{n})")
        if self.companion == "tomas" and self.karma <= -4:
            say("Tomas stops walking. \"I don't know who you are any more. I'm going home to Lina.\" "
                "He doesn't look back.")
            self.flags.append("tomas_left")
            self.companion = None

    def wear(self, item_id, amount):
        before = self.cond.get(item_id, 100)
        self.cond[item_id] = max(0, before - amount)
        if before > 25 >= self.cond[item_id]:
            say(f"Your {ITEMS[item_id]['name']} is falling apart. (repair it)")

    def tile(self):
        return WORLD[self.pos[1]][self.pos[0]]

    def reveal(self):
        x, y = self.pos
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                key = f"{x + dx},{y + dy}"
                if 0 <= x + dx < WIDTH and 0 <= y + dy < HEIGHT and key not in self.seen:
                    self.seen.append(key)

    def give(self, item_id, n=1, quiet=False):
        item = ITEMS[item_id]
        count = round(item.get("count", 1) * (1.5 if "scrounger" in self.perks else 1))
        for _ in range(n):
            if item["kind"] == "ammo":
                self.ammo[item["ammo"]] += count
            else:
                self.inventory.append(item_id)
        if not quiet:
            if item["kind"] == "ammo":
                say(f"+ {count * n} {item['ammo']} ammo")
            else:
                say(f"+ {item['name']}" + (f" x{n}" if n > 1 else ""))

    def status(self):
        say(f"{self.name}  Level {self.level}  XP {self.xp}/{self.xp_needed()}  Caps {self.caps}  "
            f"[{self.karma_title()}]")
        say(f"HP     {bar(self.hp, self.cap_hp)}   Rads {self.rads}"
            + (f" (max HP -{self.rads // 10})" if self.rads >= 10 else ""))
        say(f"Food   {bar(self.hunger, 100)}")
        say(f"Water  {bar(self.thirst, 100)}")
        say("  ".join(f"{s} {self.stats[s]}" for s in STATS))
        w = ITEMS[self.weapon]
        ammo = f", {self.ammo[w['ammo']]} {w['ammo']}" if w["type"] == "gun" else ""
        say(f"ATK {self.atk}  DEF {self.defense}")
        say(f"Weapon: {w['name']} ({self.cond.get(self.weapon, 100)}%{ammo})"
            + ("  NO AMMO - you'll be clubbing with it" if self.out_of_ammo() else ""))
        say(f"Armor:  {ITEMS[self.armor]['name']} ({self.cond.get(self.armor, 100)}%)")
        say("Ammo:   " + "  ".join(f"{k} {v}" for k, v in self.ammo.items()))
        if self.companion:
            c = COMPANIONS[self.companion]
            say(f"With you: {c['name']} {bar(self.comp_hp[self.companion], c['hp'])}")
        if self.addicted:
            say("You are addicted to Rush." + (" You're high." if self.high else " Withdrawal: -3 attack."))
        elif self.high:
            say("You're high on Rush.")
        say(f"Time:   {time_label(self)}")
        if self.perks:
            say("Perks:  " + ", ".join(PERKS[p][0] for p in self.perks))
        if self.bounty:
            b = BOUNTY_BY_ID[self.bounty["id"]]
            say(f"Bounty: {b['short']} ({self.bounty['count']}/{b['n']})")

    def to_dict(self):
        return dict(self.__dict__)

    @classmethod
    def from_dict(cls, data):
        p = cls("x", {s: 3 for s in STATS})  # defaults for anything added since the save was made
        p.__dict__.update(data)
        return p


# ================================================================ save / permadeath


def save_game(player):
    store_write(SAVE_NAME, json.dumps(player.to_dict()))


def load_game():
    raw = store_read(SAVE_NAME)
    if not raw:
        return None
    data = json.loads(raw)
    if data.get("version") != SAVE_VERSION:
        return None
    return Player.from_dict(data)


def memorialize(line):
    store_write(MEMORIAL_NAME, (store_read(MEMORIAL_NAME) or "") + line + "\n")
    store_delete(SAVE_NAME)


def place_name(player):
    if player.room:
        return ROOMS[player.room]["name"]
    ch = player.tile()
    return LOCATIONS[ch]["name"] if ch in LOCATIONS else TERRAIN[ch]["name"]


def die(player):
    killer = player.killer or "the wasteland"
    say("\n" + "=" * 60)
    say("You hit the dirt. The sky goes grey, then black.")
    if player.companion:
        c = COMPANIONS[player.companion]["name"]
        say(f"{c} stays with your body until the scavengers come. Then {c} is alone.")
    say(f"\n  HERE LIES {player.name.upper()}")
    say(f"  Level {player.level} {player.karma_title()}")
    say(f"  Killed by {killer} at {place_name(player)}")
    say(f"  {player.turns} turns. {player.kills} kills. {player.caps} caps, which someone else will spend.")
    say("\nThe wasteland doesn't remember. Your save has been deleted.")
    say("=" * 60)
    memorialize(f"[DEAD] {player.name} - Lv {player.level} {player.karma_title()} - killed by {killer} "
                f"at {place_name(player)} - {player.turns} turns, {player.kills} kills")


# ================================================================ combat


def player_attack(player, e):
    w = ITEMS[player.weapon]
    if player.out_of_ammo():
        dmg = max(1, player.atk + random.randint(-2, 2) - e["def"])
        player.wear(player.weapon, 2)
        say(f"Click. Empty. You club the {e['name']} with the {w['name']} for {dmg}.")
        return dmg
    if w["type"] == "gun":
        player.ammo[w["ammo"]] = max(0, player.ammo[w["ammo"]] - w.get("ammo_use", 1))
        steady = "steady" in player.perks
        jam = 0 if steady else max(0.0, (50 - player.cond.get(player.weapon, 100)) / 150)
        player.wear(player.weapon, random.randint(0, 1) if steady else random.randint(1, 2))
        if random.random() < jam:
            say(f"Your {w['name']} jams! You claw at it while the {e['name']} closes in.")
            return 0
    else:
        player.wear(player.weapon, random.randint(0, 1))
    dmg = max(1, player.atk + random.randint(-2, 2) - e["def"])
    if "bloody_mess" in player.perks:
        dmg = round(dmg * 1.15)
    if random.random() < 0.04 + 0.015 * player.stats["LCK"]:
        dmg *= 2
        say("Critical hit!")
    say(f"You hit the {e['name']} for {dmg}.")
    return dmg


def companion_dies(player, cid, enemy_name):
    say("\n" + COMPANIONS[cid]["death"].format(enemy=enemy_name))
    player.flags.append(f"{cid}_dead")
    player.companion = None


async def fight(player, enemy_id, enemy_hp=None):
    e = ENEMIES[enemy_id]
    hp = e["hp"] if enemy_hp is None else enemy_hp
    say(f"\n!!! {e['name']} {'attacks' if enemy_hp is None else 'is on you'}! !!!")

    while hp > 0:
        player.pending_fight = {"id": enemy_id, "hp": hp}
        save_game(player)  # killing the game mid-fight resumes the fight
        comp = player.companion
        say(f"\n{e['name']:<22} {bar(hp, e['hp'])}")
        say(f"{player.name:<22} {bar(player.hp, player.cap_hp)}")
        if comp:
            say(f"{COMPANIONS[comp]['name']:<22} {bar(player.comp_hp[comp], COMPANIONS[comp]['hp'])}")
        w = ITEMS[player.weapon]
        if w["type"] == "gun":
            say(f"{w['ammo']}: {player.ammo[w['ammo']]}")
        cmd = await ask("(a)ttack  (d)efend  (i)tem  (r)un > ")
        defending = False

        if cmd in ("a", "attack", ""):
            hp -= player_attack(player, e)
        elif cmd in ("d", "defend"):
            defending = True
            say("You brace yourself.")
        elif cmd in ("i", "item"):
            usable = list(dict.fromkeys(
                i for i in player.inventory if ITEMS[i]["kind"] in ("heal", "food", "drink", "grenade", "chem")))
            if not usable:
                say("Nothing useful in your pockets.")
                continue
            for n, item_id in enumerate(usable, 1):
                say(f"  {n}. {ITEMS[item_id]['name']} x{player.inventory.count(item_id)}")
            pick = await ask("Use which? > ")
            if not pick.isdigit() or not 1 <= int(pick) <= len(usable):
                continue
            item_id = usable[int(pick) - 1]
            if ITEMS[item_id]["kind"] == "grenade":
                player.inventory.remove(item_id)
                hp -= ITEMS[item_id]["power"]
                say(f"BOOM. The {e['name']} takes {ITEMS[item_id]['power']}.")
            else:
                consume(player, item_id)
        elif cmd in ("r", "run"):
            if e.get("boss"):
                say("There's nowhere to run.")
            elif random.random() < 0.35 + 0.04 * player.stats["LCK"]:
                say("You run, and keep running.")
                player.pending_fight = None
                player.high = False
                return "fled"
            else:
                say("You stumble. No escape!")
        else:
            say("You freeze.")

        if hp > 0 and comp:
            c = COMPANIONS[comp]
            dmg = max(1, c["atk"] + random.randint(-2, 2) - e["def"])
            hp -= dmg
            say(f"{c['name']} {random.choice(c['attacks'])} for {dmg}.")
        if hp <= 0:
            break

        # enemy turn
        special = e.get("special") and random.random() < 0.25
        base = e["atk"] + (7 if special else random.randint(-2, 2))
        if special:
            say(e["special"])
        if comp and random.random() < 0.35:
            c = COMPANIONS[comp]
            dmg = max(1, base - c["def"])
            player.comp_hp[comp] -= dmg
            say(f"The {e['name']} hits {c['name']} for {dmg}.")
            if player.comp_hp[comp] <= 0:
                companion_dies(player, comp, e["name"])
            continue
        dmg = max(1, base - player.defense)
        if defending:
            dmg //= 2
        player.hp -= dmg
        say(f"The {e['name']} hits you for {dmg}.")
        if dmg >= 5 and random.random() < 0.5:
            player.wear(player.armor, random.randint(1, 3))
        if e.get("rads") and dmg > 0:
            player.add_rads(e["rads"], source=f"radiation from {e['name']}")
        if player.hp <= 0:
            player.killer = player.killer or (e["name"] if e.get("boss") else f"a {e['name']}")
            player.pending_fight = None
            return "dead"

    player.pending_fight = None
    player.high = False
    player.kills += 1
    caps = random.randint(*e["caps"])
    player.caps += caps
    say(f"\nThe {e['name']} goes down and stays down. +{e['xp']} XP" + (f", +{caps} caps." if caps else "."))
    if e.get("drops") and random.random() < 0.35 + 0.02 * player.stats["LCK"]:
        player.give(random.choice(e["drops"]))
    if player.companion == "tomas" and player.hp < player.cap_hp and random.random() < 0.3:
        say(f"Tomas patches you up with a field dressing. +{player.heal(10)} HP.")
    count_bounty(player, enemy_id)
    if "cannibal" in player.perks and e.get("human"):
        if await ask("Eat from the body? (y/n) > ", keys=["y", "no"]) == "y":
            player.hunger = min(100, player.hunger + 40)
            say(f"You eat. +{player.heal(25)} HP. It gets easier every time.")
            player.karma_shift(-1)
    player.gain_xp(e["xp"])
    return "won"


def consume(player, item_id):
    item = ITEMS[item_id]
    kind = item["kind"]
    if kind not in ("heal", "food", "drink", "radaway", "chem"):
        return False
    player.inventory.remove(item_id)
    if kind == "heal":
        power = round(item["power"] * (1.5 if "medic" in player.perks else 1))
        say(f"You jab the {item['name']}. +{player.heal(power)} HP.")
    elif kind == "food":
        player.hunger = min(100, player.hunger + item["power"])
        say(f"You eat the {item['name']}. +{player.heal(5)} HP. (Food {player.hunger})")
        if item_id == "mystery_meat" and "ate_human" not in player.flags:
            player.flags.append("ate_human")
            say("You know exactly what it is. It's the best meal you've had since the shelter.")
            player.karma_shift(-1)
    elif kind == "drink":
        player.thirst = min(100, player.thirst + item["power"])
        say(f"You drink the {item['name']}. (Water {player.thirst})")
    elif kind == "radaway":
        removed = min(player.rads, item["power"])
        player.rads -= removed
        say(f"The RadAway burns going in. -{removed} rads.")
    elif kind == "chem":
        player.high = True
        say("You snort the Rush. Your heart slams against your ribs. Everything slows down except you.")
        if not player.addicted and random.random() < 0.35 - 0.03 * player.stats["END"]:
            player.addicted = True
            say("...and you already want more. You're addicted to Rush.")
    if kind in ("food", "drink") and item.get("rads") and "iron_gut" not in player.perks:
        player.add_rads(item["rads"], source=f"bad {item['name'].lower()}")
    return True


# ================================================================ events


async def event_shelter(player):
    if "purifier" not in player.inventory:
        if "shelter_saved" in player.flags:
            say("Someone has painted THANK YOU on the door. It's already flaking.")
        elif "shelter_knocked" not in player.flags:
            say("\nYou press the intercom. Static. Then the Overseer's voice, flat: \"You're registered "
                "as deceased. Please leave the door area.\" Click.")
            player.flags.append("shelter_knocked")
        return False
    say("\nThe purification module is heavy in your pack. You press the intercom and tell them what you "
        "have. A long silence. Then the door groans open a crack, and the Overseer steps out, thinner "
        "than you remember. Behind him, faces you grew up with. Hungry faces.")
    say("\"The chip failed in spring. We've lost forty people. Please.\"")
    pick = await choose(player, [
        "Give them the module",
        "Give them the module, and go back inside. Go home.",
        "\"You threw me out to die.\" Walk away.",
    ])
    if pick == 3:
        say("You walk away. The door stays open behind you for a long time, then closes.")
        return False
    player.inventory.remove("purifier")
    player.flags.append("shelter_saved")
    player.karma_shift(2)
    if pick == 2:
        say("They give you your old bunk. It's smaller than you remember. Everything is.")
        await epilogue(player, "shelter")
        return True
    say("The Overseer takes it with shaking hands. \"We won't forget this.\" They will. "
        "The door closes, and you are on the outside again.")
    return True


async def event_caravan(player):
    say("\nUnder the cart lies a caravan guard, gut-shot, breathing in wet clicks. \"Hey... you got a "
        "stim? Please. I've got a daughter in Dustwater. Lina. She's ten.\"")
    has_stim = "stimpak" in player.inventory
    pick = await choose(player, [
        "Give him a Stimpak" + ("" if has_stim else " (you don't have one)"),
        ("Dig the bullet out with your knife and stitch him", ("WIT", 6)),
        "End it quickly, then take his gear",
        "Take his pack while he watches",
        "Walk away",
    ])
    if pick == 1 and not has_stim:
        say("You pat your empty pockets. He laughs, which turns into coughing, which turns into nothing.")
    elif pick in (1, 2):
        if pick == 1:
            player.inventory.remove("stimpak")
            say("You jab the stim into him. Colour crawls back into his face.")
        else:
            say("Ten minutes of him screaming into his belt. The bullet comes out. He lives.")
        say("\"Name's Tomas. I owe you my life.\" He gives you 40 caps. \"If you need a gun hand, find me "
            "in Dustwater.\"")
        player.caps += 40
        player.karma_shift(2)
        player.flags.append("tomas_saved")
    elif pick == 3:
        say("You kneel beside him. He understands, and nods, and closes his eyes. Afterwards you take "
            "his pistol and ammo. He wasn't going to make it. You tell yourself that a few times.")
        player.give("pistol")
        player.give("ammo_10mm")
    elif pick == 4:
        say("\"You son of a bitch...\" he wheezes as you pull the pack from under him. A pistol, ammo, "
            "60 caps. His curses follow you down the highway, then get quieter, then stop.")
        player.give("pistol")
        player.give("ammo_10mm")
        player.caps += 60
        player.karma_shift(-3)
        player.flags.append("robbed_tomas")
    else:
        say("You step around him. Out here, everyone dies eventually. He just goes first.")
    return True


async def free_captives(player):
    say("You open the cages. The old man weeps. The kid won't let go of your sleeve. The woman with "
        "the split lip just looks at you. \"I'm Mara. I'll be in Dustwater. If you're going after the "
        "Red Teeth, I want to be there.\" The old man presses two stimpaks on you.")
    player.give("stimpak", 2)
    player.flags.append("captives_freed")


async def event_slavers(player):
    if "captives_freed" in player.flags:
        return False
    if "sold_out" in player.flags:
        say("\nBrennan waves. \"Business is good, partner.\"")
        return False
    say("\nA lean man in a pre-war suit vest steps out of the gas station, shotgun on his shoulder. "
        "\"Name's Brennan. Welcome to my little enterprise.\" In the cages: an old man, a woman with a "
        "split lip, and a kid who can't be older than twelve. \"Buying, or looking for work?\"")
    pick = await choose(player, [
        "\"Let them go.\" (Fight Brennan and his slaver)",
        f"Buy their freedom (200 caps - you have {player.caps})",
        ("\"Kessler's going to feed you to his own butchers. I'd leave tonight.\"", ("CHA", 7)),
        "\"What kind of work?\"",
        "Leave",
    ])
    if pick == 1:
        say("Brennan sighs. \"Always a hero.\" He whistles. A slaver steps out from behind the pumps.")
        if await fight(player, "slaver") != "won":
            return False
        if await fight(player, "brennan") != "won":
            return False
        say("\nBrennan coughs blood onto his nice vest. You take his keys, and a dog tag stamped with "
            "a bloody grin: a Red Teeth gate pass.")
        player.flags.append("brennan_dead")
        player.give("gate_pass")
        await free_captives(player)
        player.karma_shift(2)
    elif pick == 2:
        if player.caps < 200:
            say("Brennan looks at your caps and laughs. \"Come back when you're serious.\"")
            return False
        player.caps -= 200
        say("Brennan counts the caps twice and tosses you the keys. \"Pleasure.\"")
        await free_captives(player)
        say("Mara presses something into your hand. \"Took it off a Red Teeth when they came to buy.\" "
            "A gate pass into the Pit.")
        player.give("gate_pass")
        player.karma_shift(2)
    elif pick == 3:
        say("You talk quietly about Kessler's appetite, and how slavers end up in the meat locker. "
            "Brennan's smile fades. By dusk his trucks are gone. He leaves the cages, and the keys.")
        await free_captives(player)
        say("Mara: \"One of them dropped this when they came to buy.\" A Red Teeth gate pass.")
        player.give("gate_pass")
        player.karma_shift(2)
    elif pick == 4:
        say("\"Dustwater's got a lot of kids and not a lot of guns. You walk in, tell me which shacks "
            "are easy, which ones sleep sound. 150 caps. And a pass to the Pit - Kessler's my best "
            "customer.\"")
        if await choose(player, ["Take the deal", "Refuse"]) == 2:
            say("\"Shame. Offer stands.\"")
            return False
        say("You draw him a map in the dirt. He pays in full. The kid in the cage watches you the "
            "whole time. You'll see that face again, when you close your eyes.")
        player.caps += 150
        player.give("gate_pass")
        player.karma_shift(-5)
        player.flags.append("sold_out")
    else:
        say("You turn away from the cages.")
        return False
    return True


async def event_hollis(player):
    if "hollis_dead" in player.flags:
        return False
    if "hollis_family" in player.flags:
        say("Ma Hollis waves from the porch. \"Family eats free!\" She hands you a parcel.")
        player.give("mystery_meat")
        return False
    say("\nAn old woman in a clean apron opens the door before you knock. \"A traveller! Come in, come "
        "in. Ma Hollis never turns away a hungry mouth.\" Four big sons sit at the table, smiling. "
        "The stew smells incredible.")
    pick = await choose(player, [
        "Sit down and eat",
        ("Look closer at the stew before you eat", ("WIT", 5)),
        "Make an excuse and leave",
    ])
    if pick == 3:
        say("\"Shame,\" says Ma Hollis. \"Come back hungry.\" The sons watch you all the way to the road.")
        return False
    if pick == 1:
        player.hunger = 100
        say(f"You eat two bowls. +{player.heal(25)} HP. The meat is sweet and tender. Ma Hollis watches "
            "you eat with real love in her eyes.")
        say("Then your spoon comes up with a fingernail in it. Painted pink.")
        say("\"Now you're family,\" says Ma Hollis.")
        player.flags.append("ate_human")
        if await choose(player, ["Keep eating", "Kick the table over and fight"]) == 1:
            say("You keep eating. Ma Hollis strokes your hair. \"Good. Good. Come by any time.\"")
            player.flags.append("hollis_family")
            player.give("mystery_meat", 3)
            player.karma_shift(-4)
            return True
    else:
        say("You stir the stew. A molar. A small one. A pink-painted fingernail. Ma Hollis sighs. \"Boys.\"")
    say("Chairs scrape back. The sons stand up, and keep standing up. They're very big.")
    for _ in range(2):
        if await fight(player, "hollis") != "won":
            return False
    say("\nMa Hollis sits in the corner, rocking, humming. The other two sons have run.")
    if await choose(player, ["Kill her", "Leave her with what she's done"]) == 1:
        say("She doesn't fight. She keeps humming until she can't.")
    else:
        say("You leave her humming.")
    say("\nIn the cellar, a man is chained to the wall. Both his legs end at the knee, the stumps "
        "neatly cauterised. \"They've been taking a little at a time,\" he whispers. \"Please. I "
        "can't. Please.\"")
    pick = await choose(player, ["Do what he asks", "Carry him out", "Leave him"])
    if pick == 1:
        say("He thanks you. That's the worst part.")
    elif pick == 2:
        say("You carry him out into the daylight. He looks at the sky for a long time. He dies before "
            "sunset, smiling. It's the most anyone could have done.")
        player.karma_shift(1)
    else:
        say("You climb the stairs. He stops calling after a while.")
        player.karma_shift(-1)
    say("In the kitchen: a cleaver, a jar of gold teeth, and a box of caps.")
    player.give("cleaver")
    player.give("teeth", 2)
    player.caps += 45
    player.flags.append("hollis_dead")
    return True


async def event_tower(player):
    say("\nYou climb to the shack at the base of the mast. A woman sits at the radio desk, dead for "
        "months, a revolver in her lap. Behind her, three small cots with three small shapes under "
        "blankets, tucked in neatly. A diary lies open:")
    say("\"The Red Teeth are coming up the road. I've seen what they do with children. I won't let them. "
        "God forgive me. I'll leave the broadcast on so someone knows. The children are safe now.\"")
    pick = await choose(player, [
        "Bury them, all four (hours of digging)",
        "Turn off the broadcast",
        "Take what's useful and go",
    ])
    if pick == 1:
        player.hunger = max(0, player.hunger - 15)
        player.thirst = max(0, player.thirst - 20)
        say("You dig until your hands bleed. You leave the broadcast on. It feels like it belongs to her.")
        player.karma_shift(1)
    elif pick == 2:
        say("Silence. It's worse.")
    say("Under the desk: a submachine gun she never used, and ammunition.")
    player.give("smg")
    player.give("ammo_10mm", 2)
    return True


async def event_dog(player):
    say("\nA man's corpse lies by the bus, picked half clean. Chained to his wrist is a dog, ribs like "
        "a xylophone, standing guard over him. It growls at you with what's left of its strength.")
    food = [i for i in player.inventory if ITEMS[i]["kind"] == "food"]
    pick = await choose(player, [
        "Offer it food" + ("" if food else " (you have none)"),
        ("Crouch down and talk to it softly", ("CHA", 5)),
        "Kill it and take the meat",
        "Leave it",
    ])
    if pick == 1 and not food:
        say("You have nothing to give it.")
        return False
    if pick in (1, 2):
        if pick == 1:
            player.inventory.remove(food[0])
            say(f"It eats the {ITEMS[food[0]]['name']} from your hand, shaking.")
        else:
            say("It takes a long time. Eventually it lets you touch it.")
        say("You unclip the chain from the dead man's wrist. The dog looks at him, then at you, and "
            "follows. His collar tag says ASH.")
        player.flags.append("ash_found")
        player.comp_hp["ash"] = COMPANIONS["ash"]["hp"]
        if player.companion:
            say("(Ash will wait for you in Dustwater.)")
        else:
            player.companion = "ash"
        player.karma_shift(1)
    elif pick == 3:
        say("It barely fights. It was waiting for someone to do it.")
        player.give("dog_meat", 2)
        player.karma_shift(-1)
    else:
        say("You leave it guarding him. It'll die there. Some loyalty is like that.")
        return False
    return True


async def event_drain(player):
    if "drain_open" in player.flags:
        say("The grate hangs open. (enter)")
        return False
    say("\nThe grate is rusted into the concrete.")
    pick = await choose(player, [
        ("Tear it out with your bare hands", ("STR", 6)),
        "Blast it with a Pipe Grenade" + ("" if "grenade" in player.inventory else " (you have none)"),
        "Leave it",
    ])
    if pick == 1:
        say("Your palms tear open on the rust. The grate comes free.")
    elif pick == 2 and "grenade" in player.inventory:
        player.inventory.remove("grenade")
        say("The blast echoes down the tunnel. Something down there heard it.")
        if await fight(player, "pit_hound") != "won":
            return False
    else:
        return False
    player.flags.append("drain_open")
    say("A way into the Pit's tunnels. (enter)")
    return True


async def event_locker(player):
    say("\nOne of the bodies on the hooks is still breathing. A young man, hung by a hook through the "
        "shoulder. \"They're saving me for the arena,\" he says. \"Kessler likes them fresh.\"")
    pick = await choose(player, ["Lift him down", "End it for him", "Leave him"])
    if pick == 1:
        say("You lift him down. He can't walk. He tells you a storm drain south-east of the stadium "
            "connects to the tunnels, and then he asks you to leave him somewhere he can see the sky. "
            "You do.")
        player.karma_shift(1)
        if pos_key(loc_pos("U")) not in player.seen:
            player.seen.append(pos_key(loc_pos("U")))
    elif pick == 2:
        say("\"Thank you,\" he says, and means it.")
    else:
        say("He doesn't beg. He's past begging.")
        player.karma_shift(-1)
    return True


async def event_ward(player):
    say("\nA woman in the nearest bed grabs your wrist. She has no legs, and one eye. \"Please. Before "
        "they come back. All of us. Please.\" Down the row, eleven heads turn toward you.")
    has_super = "super_stim" in player.inventory
    pick = await choose(player, [
        "Do what they ask. All twelve.",
        ("Unhook her and try to carry her out alive" + ("" if has_super else " (needs a Super Stim)"),
         ("WIT", 6)),
        "Leave them",
    ])
    if pick == 1:
        say("You go bed to bed. Some of them say thank you. One of them says a name that isn't yours. "
            "When you're done, you sit on the floor for a while.")
        player.flags.append("ward_mercy")
    elif pick == 2 and has_super:
        player.inventory.remove("super_stim")
        say("You strip the lines, pump the stim into her and carry her down the stairs. Her name is "
            "June. She'll make it to Dustwater. The other eleven watch you go.")
        player.flags.append("ward_saved")
        player.karma_shift(2)
    elif pick == 2:
        say("Without a Super Stim she'll bleed out on the stairs. You put her back.")
        return False
    else:
        say("Twelve sets of eyes follow you to the door.")
        player.karma_shift(-1)
    return True


async def event_pilot_log(player):
    say("\nYou play the holotape. A young man's voice: \"Relief flight 7, carrying a purification core "
        "for the civilian shelters. We've been ordered to divert. Command says the core is for the "
        "officers' bunker now. The civilians aren't a priority. Jesus. I'm turning around. I'm taking it "
        "to the people.\" Then the sound of the bomb, and the tape ends.")
    return True


EVENTS = {
    "shelter": event_shelter, "caravan": event_caravan, "slavers": event_slavers,
    "hollis": event_hollis, "tower": event_tower, "dog": event_dog, "drain": event_drain,
    "locker": event_locker, "ward": event_ward, "pilot_log": event_pilot_log,
}


async def run_event(player, event_id):
    """One-off events: they repeat until they resolve."""
    if event_id in player.flags:
        return
    if await EVENTS[event_id](player) and player.hp > 0:
        player.flags.append(event_id)


# ================================================================ bosses


async def boss_kessler(player):
    player.flags.append("kessler_dead")
    say("\nKessler crashes onto the stadium floor. The chainsaw coughs and dies. You pull off the "
        "hockey mask. Underneath is a bald, frightened old man with his mother's name tattooed on his "
        "neck.")
    if "covenant_allied" in player.flags:
        say("\nCovenant zealots pour into the arena. Prior Vance walks among the kneeling raiders. "
            "\"Purity is mercy,\" he says, and they begin. They don't stop at the raiders. The people "
            "in the cages are tainted too, apparently. Someone hands you a white tabard.")
        player.flags += ["pit_purged", "dustwater_annexed"]
        say("\nGo back to Dustwater. It belongs to the Covenant now.")
        return
    say("\nThe surviving Red Teeth throw down their weapons. Somebody has to decide what happens to "
        "them. They're looking at you.")
    pick = await choose(player, [
        "Line them up against the wall",
        "Tell them to scatter and never come back",
        ("\"The Pit has a new warlord.\"", ("CHA", 5)),
    ])
    if pick == 1:
        say("It takes a long time. Nobody in Dustwater will ever ask you about it.")
        player.karma_shift(-1)
    elif pick == 2:
        say("They run. Some will come back as raiders somewhere else. Some won't.")
        player.karma_shift(1)
    else:
        say("A raider kneels. Then another. By nightfall they're chanting your name.")
        player.karma_shift(-4)
        await epilogue(player, "warlord")
        return
    say("\nSheriff Okafor will want to hear about this. Head back to Dustwater.")


async def boss_surgeon(player):
    player.flags.append("surgeon_dead")
    say("\nThe Surgeon falls across the operating table. Under the welding mask is a woman's face, "
        "serene. \"Everyone is redeemed in service,\" she whispers. \"Even you. Especially you.\"")
    say("There's a ledger on her desk. (search)")


async def boss_mother(player):
    player.flags.append("mother_dead")
    say("\nThe Mother shudders and sags. The larval sacs go dark one by one. At the end, her human "
        "mouth says something. It sounds like a child's name. Then she's just meat.")


BOSSES = {"kessler": boss_kessler, "surgeon": boss_surgeon, "mother": boss_mother}


# ================================================================ npcs


async def talk_okafor(player):
    f = player.flags
    if "dustwater_annexed" in f:
        say("Okafor wears a Covenant armband now. He doesn't meet your eyes. \"Doc's dead. They said he "
            "was treating the tainted. He was.\"")
        if "okafor_paid" not in f:
            say("He hands you 150 caps without looking at you. \"Bounty. Don't come back.\"")
            player.caps += 150
            f.append("okafor_paid")
        if await choose(player, ["End your story here", "Not yet"]) == 1:
            await epilogue(player, "retire")
        return
    if "kessler_dead" in f:
        if "okafor_paid" not in f:
            say("Okafor looks at Kessler's mask on your belt and lets out a breath he's been holding "
                "for six years. \"Town bounty. 150 caps.\" He pauses. \"Thank you.\"")
            player.caps += 150
            f.append("okafor_paid")
        say("Okafor: \"There's a cot for you as long as you want it. Whenever you're ready to put the "
            "gun down.\"")
        if await choose(player, ["Put the gun down. (End your story.)", "Not yet"]) == 1:
            await epilogue(player, "retire")
        return
    if "sold_out" in f:
        say("Okafor: \"Brennan's boys hit the east shacks last night. Knew exactly where to go. Three "
            "kids gone.\" He looks at you a little too long.")
        return
    say("Sheriff Okafor, a heavyset man with a hunting rifle and tired eyes: \"The Red Teeth take our "
        "water and our people. Kessler runs them from the Pit, the old stadium south-east, over the "
        "river. Walls are tight. You'd need one of their gate passes, or an army. Kill Kessler and "
        "this town pays 150 caps.\"")
    if "rivet_visited" not in f:
        say("\"And stay away from Rivet. The Covenant will offer to help. Their help has a price.\"")


async def talk_vee(player):
    say("Vee, chewing something: \"Buying or crying? Type 'shop'. Or have a rumour, free.\"")
    rumours = [
        ("M", "\"Hollis farm, up in the dead forest. Best stew in the wastes. Nobody who eats there "
              "twice comes back.\""),
        ("X", "\"Bomb crater in the north-west Glow. There's a military wreck in it. Folks say "
              "something's living in the wreck. Something big. Pregnant.\""),
        ("H", "\"St. Agnes Hospital, east, over the river. The Harvesters run it. Go in sick, come out "
              "in pieces. They sell what they take. Somebody's buying.\""),
        ("U", "\"There's a storm drain south-east of the Pit. Rats get in and out that way. So could "
              "you.\""),
        ("R", "\"Rivet, north-east. Clean water, clean streets. They burn anyone with a sore. Doc "
              "would've been burned years ago.\""),
        ("T", "\"Radio tower north-east of the crossroads. A woman's been broadcasting the same "
              "message for a year. Nobody's had the nerve to go look.\""),
        ("W", "\"Old school bus south of here. There's a dog out there that won't leave its master. "
              "Master's been dead a month.\""),
    ]
    unknown = [r for r in rumours if pos_key(loc_pos(r[0])) not in player.seen]
    char, line = random.choice(unknown or rumours)
    say(line)
    key = pos_key(loc_pos(char))
    if key not in player.seen:
        player.seen.append(key)
        say("(Marked on your map.)")


async def talk_doc(player):
    f = player.flags
    if "ledger" in player.inventory and "doc_confronted" not in f:
        say("You put the Harvester ledger on Doc Halloran's table, open to the page with his name. "
            "BLOOD SERUM - 40 UNITS - HALLORAN, DUSTWATER.")
        say("He doesn't deny it. \"Stimpaks don't make themselves. The serum has to come from somewhere. "
            "I never asked where. I didn't want to know. Without it, half this town would be dead.\"")
        f.append("doc_confronted")
        pick = await choose(player, ["\"Keep the clinic open. I didn't see anything.\"",
                                     "Tell Okafor. Let the town decide.",
                                     "Shoot him"])
        if pick == 2:
            say("The town decides by morning. Halloran leaves with a pack and a canteen, the way you "
                "left the shelter. The clinic is boarded up.")
            f.append("doc_gone")
            return
        if pick == 3:
            say("He's still holding a suture needle when he falls. A child in the waiting room screams.")
            player.karma_shift(-3)
            f.append("doc_gone")
            return
        say("\"Thank you,\" he says. He doesn't sound grateful.")
    flush = player.price("radaway") * 2
    cure = player.price("super_stim")
    options = [
        f"Flush my rads ({flush} caps) - you have {player.rads} rads",
        f"Cure my addiction ({cure} caps)" + ("" if player.addicted else " - you're clean"),
        "Patch me up (15 caps)",
    ]
    if "purifier" in player.inventory:
        options.append("Give Dustwater the purification module")
    options.append("Never mind")
    say("Doc Halloran wipes his hands on a stained apron. \"What's broken?\"")
    pick = await choose(player, options)
    chosen = options[pick - 1]
    if chosen.startswith("Give"):
        player.inventory.remove("purifier")
        say("Doc and Okafor spend two days swearing at the old purifier. On the third day, the water "
            "comes out clear. The whole town comes to watch. Someone starts crying, and then everyone is.")
        f.append("dustwater_purifier")
        player.karma_shift(3)
        return
    if chosen == "Never mind":
        return
    if pick == 2 and not player.addicted:
        say("\"You're clean. Stay that way.\"")
        return
    cost = {1: flush, 2: cure, 3: 15}[pick]
    if player.caps < cost:
        say("\"Like the sign says. No credit.\"")
        return
    player.caps -= cost
    if pick == 1:
        player.rads = 0
        say("A night hooked to a drip. You wake up feeling almost human.")
    elif pick == 2:
        player.addicted = False
        say("Three days of sweating and screaming in the back room. You come out clean, and empty.")
    else:
        player.hp = player.cap_hp
        say("He stitches you up without anaesthetic. HP restored.")


async def talk_companion(player, cid):
    c = COMPANIONS[cid]
    lines = {
        "mara": "Mara is sharpening a rebar spike. \"Kessler's men killed my husband in front of me. "
                "Then they sold me to Brennan. I'm going to watch the Pit burn. You coming?\"",
        "tomas": "Tomas sits with Lina on his knee. \"I owe you. If you need a gun, I'm yours.\" Lina "
                 "doesn't want him to go. She doesn't say so.",
        "ash": "Ash thumps his tail on the floor of the bar.",
    }
    say(lines[cid])
    if await choose(player, ["\"Come with me.\"", "\"Not now.\""]) == 2:
        return
    if player.companion:
        say(f"{COMPANIONS[player.companion]['name']} will wait for you here.")
    player.companion = cid
    player.comp_hp.setdefault(cid, c["hp"])
    say(f"{c['name']} joins you.")


async def talk_vance(player):
    f = player.flags
    if "covenant_exposed" in f:
        say("Vance's body turns slowly on its rope.")
        return
    say("Prior Vance is a soft-spoken man with surgical gloves and kind eyes. \"Welcome, pure one. The "
        "wasteland is a wound. The Covenant is the cautery.\"")
    while True:
        options = []
        if "covenant_allied" not in f:
            options.append("\"I hear you want the Red Teeth gone.\"")
        if "ledger" in player.inventory:
            options.append("[Ledger] Read it aloud to the crowd at the pump")
            options.append("[Ledger] Show it to him quietly. Name a price.")
        if "purifier" in player.inventory:
            options.append("[Module] Sell him the purification module (400 caps)")
        options.append("\"What happens to the tainted?\"")
        options.append("Leave")
        pick = options[await choose(player, options) - 1]
        if pick.startswith("\"I hear"):
            say("\"The Pit is an abscess. Help my zealots burn it out. In return, Dustwater receives "
                "the Covenant's protection.\" He smiles. \"A tithe of water. A tithe of able bodies. "
                "And an inspection, of course. We can't have tainted blood near clean water.\"")
            if player.companion == "mara":
                say("Mara, very quietly: \"If you shake his hand, we're done.\"")
            if await choose(player, ["Shake his hand", "\"I'll think about it.\""]) == 1:
                f.append("covenant_allied")
                say("His glove is cool and dry. \"Ide will outfit you. When you reach the Pit, my "
                    "zealots will already be there.\"")
                player.give("covenant_plate")
                player.give("ammo_cells", 2)
                player.karma_shift(-2)
                if "captives_freed" in f and "mara_dead" not in f and "mara_left" not in f:
                    say("Word reaches Mara. She leaves Dustwater that night, alone. You won't see her again.")
                    f.append("mara_left")
                    if player.companion == "mara":
                        player.companion = None
        elif pick.startswith("[Ledger] Read"):
            say("You climb the pump house steps and read. Organs, blood, marrow, sold by the Harvesters "
                "of St. Agnes. Buyer: the Iron Covenant, Prior Vance. For the faithful's surgeries. "
                "For his own new kidney.")
            say("The crowd goes quiet. Then a zealot takes off his white tabard. Then another. Vance "
                "is still talking about purity when they put the rope around his neck.")
            f.append("covenant_exposed")
            if "covenant_allied" in f:
                f.remove("covenant_allied")
            player.inventory.remove("ledger")
            player.karma_shift(3)
            return
        elif pick.startswith("[Ledger] Show"):
            say("Vance reads, and closes the ledger gently. \"300 caps. And you never come back to "
                "Rivet with that book.\"")
            player.caps += 300
            player.inventory.remove("ledger")
            f.append("vance_blackmailed")
            player.karma_shift(-2)
            return
        elif pick.startswith("[Module]"):
            say("Vance's kind eyes light up. \"Three new garrisons. Think of the souls.\" He counts out "
                "400 caps himself.")
            player.inventory.remove("purifier")
            player.caps += 400
            f.append("covenant_purifier")
            player.karma_shift(-2)
        elif pick.startswith("\"What happens"):
            say("\"They are released from their suffering. Fire is clean. Fire is the only medicine "
                "that never fails.\" He gestures at the stakes by the gate. \"Mercy, in the end.\"")
        else:
            return


async def talk_ide(player):
    lines = ["Quartermaster Ide doesn't look up. \"Shop's open. Repairs too. Don't touch anything.\"",
             "Ide, quietly: \"The Prior's been getting surgeries. New kidney last winter. Don't ask me "
             "where the parts come from. I don't ask.\""]
    if "covenant_exposed" in player.flags:
        lines = ["Ide: \"Funny how fast the faithful took their tabards off. Shop's still open.\""]
    say(random.choice(lines))


async def talk_jory(player):
    f = player.flags
    if "jory_met" not in f:
        f.append("jory_met")
        player.timers["jory"] = player.turns + 80
    say("A man in the stocks by the gate, his face lumpy with tumours. A sign on his neck: TAINTED - "
        "PURIFICATION AT DAWN. \"I'm not contagious,\" he says. \"It's just cancer. My brother turned "
        "me in for my water ration. Please.\"")
    bribe = player.price("water") * 4
    pick = await choose(player, [
        ("Pick the lock after dark", ("WIT", 6)),
        f"Bribe the guard ({bribe} caps)",
        ("Convince the crowd he's clean", ("CHA", 7)),
        "Throw a rock with the crowd",
        "Leave him",
    ])
    if pick == 1:
        say("You slip the lock at midnight. Jory runs for the dark without a word.")
    elif pick == 2:
        if player.caps < bribe:
            say("The guard laughs at your caps.")
            return
        player.caps -= bribe
        say("The guard pockets the caps and looks away. Jory is gone by morning.")
    elif pick == 3:
        say("You talk until your voice is gone about cancer and the old world. Most of them don't "
            "believe you, but enough do. They let him go, spitting on him as he leaves.")
    elif pick == 4:
        say("The rock hits him just above the eye. The crowd cheers you. It feels good, which is the "
            "worst thing you've learned about yourself so far.")
        player.karma_shift(-2)
        return
    else:
        return
    f.append("jory_freed")
    player.karma_shift(2)


NPCS = {
    "okafor": ("Sheriff Okafor", talk_okafor),
    "vee": ("Vee the trader", talk_vee),
    "doc": ("Doc Halloran", talk_doc),
    "mara": ("Mara", lambda p: talk_companion(p, "mara")),
    "tomas": ("Tomas", lambda p: talk_companion(p, "tomas")),
    "ash": ("Ash", lambda p: talk_companion(p, "ash")),
    "vance": ("Prior Vance", talk_vance),
    "ide": ("Quartermaster Ide", talk_ide),
    "jory": ("Jory, in the stocks", talk_jory),
}


def npc_here(player, npc):
    f = player.flags
    if npc in COMPANIONS:
        return (COMPANIONS[npc]["unlock"] in f and f"{npc}_dead" not in f and f"{npc}_left" not in f
                and player.companion != npc)
    if npc == "doc":
        return "doc_gone" not in f and "dustwater_annexed" not in f
    if npc == "jory":
        return "jory_freed" not in f and "jory_burned" not in f
    return True


def check_timers(player):
    f = player.flags
    if player.timers.get("jory") and player.turns >= player.timers["jory"] \
            and "jory_freed" not in f and "jory_burned" not in f:
        f.append("jory_burned")
        if player.tile() == "R" and not player.room:
            say("\nAt dawn they burn Jory. The crowd sings a hymn to cover the screaming. It doesn't.")


# ================================================================ describing and moving


def town_here(player):
    if player.room:
        return None
    return LOCATIONS.get(player.tile(), {}).get("town")


def describe(player):
    if player.room:
        room = ROOMS[player.room]
        say(f"\n== {room['name']} ==")
        say(room["desc"])
        exits = list(room["exits"]) + (["out"] if room.get("out") else [])
        say("Exits: " + ", ".join(exits))
        if room.get("terminal") and player.puzzles.get(room["terminal"]["id"], {}).get("done") is None:
            say("A terminal glows in the corner. (hack)")
        if room.get("safe") and not player.puzzles.get(room["safe"]["id"], {}).get("done"):
            say("There's a safe here. (crack)")
        return
    x, y = player.pos
    ch = player.tile()
    if ch in LOCATIONS:
        loc = LOCATIONS[ch]
        say(f"\n== {loc['name']} ==")
        if loc.get("town"):
            say(town_desc(player, loc["town"]))
        else:
            say(loc["desc"](player) if callable(loc["desc"]) else loc["desc"])
    else:
        t = TERRAIN[ch]
        say(f"\n== {t['name']} ==")
        say(t["flavor"][(x * 7 + y * 13) % len(t["flavor"])])
    say(f"[{time_label(player)}]")
    if is_night(player) and not town_here(player):
        say(random.choice(NIGHT_LINES))
    paths = [d for d, (dx, dy) in DIRS.items()
             if 0 <= x + dx < WIDTH and 0 <= y + dy < HEIGHT and WORLD[y + dy][x + dx] != "~"]
    say("You can go: " + ", ".join(paths))
    town = town_here(player)
    if town:
        people = [NPCS[n][0] for n in TOWNS[town]["npcs"] if npc_here(player, n)]
        extra = ", board" if town == "dustwater" else ", hack"
        say("People: " + ", ".join(people) + f".  (talk, shop, rest, gamble{extra})")
    elif LOCATIONS.get(ch, {}).get("dungeon"):
        say("(enter)")


def show_map(player):
    say("")
    say("    " + "".join(str(i % 10) for i in range(WIDTH)))
    say("   +" + "-" * WIDTH + "+")
    for y, row in enumerate(WORLD):
        line = ""
        for x, ch in enumerate(row):
            if [x, y] == player.pos:
                line += "@"
            elif f"{x},{y}" in player.seen:
                line += ch
            else:
                line += " "
        say(f"  {y}|{line}|")
    say("   +" + "-" * WIDTH + "+")
    say("@ you  . ash  ^ ruins  = road  f forest  g glow  ~ river  B bridge")
    known = [f"{ch} {LOCATIONS[ch]['name'].split(' - ')[0]}" for ch in LOCATIONS
             if pos_key(loc_pos(ch)) in player.seen]
    if known:
        say("Places: " + ", ".join(known))


def tick(player, hunger, thirst):
    player.turns += 1
    player.hunger = max(0, player.hunger - hunger)
    player.thirst = max(0, player.thirst - thirst)
    for value, label, verb in ((player.hunger, "hunger", "starving"),
                               (player.thirst, "thirst", "dying of thirst")):
        if value == 0:
            player.hp -= 4
            say(f"You're {verb}. -4 HP.")
            if player.hp <= 0:
                player.killer = label
        elif value <= 20 and random.random() < 0.3:
            say("Your stomach cramps with hunger." if label == "hunger" else "Your tongue is swollen with thirst.")
    check_timers(player)


async def encounter(player, chance, enemies):
    if enemies and random.random() < chance:
        await fight(player, random.choice(enemies))


async def overworld_move(player, direction):
    dx, dy = DIRS[direction]
    x, y = player.pos[0] + dx, player.pos[1] + dy
    if not (0 <= x < WIDTH and 0 <= y < HEIGHT):
        say("Beyond is only ash and static, forever. You turn back.")
        return
    if WORLD[y][x] == "~":
        say("The river is black and thick as oil. Things move under the surface. Find a bridge.")
        return
    player.prev_pos = list(player.pos)
    player.pos = [x, y]
    player.reveal()
    tick(player, 2, 3)
    if player.hp <= 0:
        return
    describe(player)
    if not town_here(player):
        weather(player)
        if player.hp <= 0:
            return
    ch = player.tile()
    loc = LOCATIONS.get(ch)
    rads = loc.get("rads", 0) if loc else TERRAIN[ch]["rads"]
    if rads > 2 or (rads and random.random() < 0.4):
        player.add_rads(rads + random.randint(0, rads // 3), source=f"radiation at {place_name(player)}")
        if player.hp <= 0:
            return
    if loc:
        if loc.get("event"):
            if loc.get("repeat_event"):
                await EVENTS[loc["event"]](player)
            else:
                await run_event(player, loc["event"])
        return
    t = TERRAIN[ch]
    await encounter(player, t["enc"] * (1.6 if is_night(player) else 1), t["enemies"])


async def enter(player):
    if player.room:
        say("You're already inside.")
        return
    ch = player.tile()
    if ch == "U":
        if "drain_open" not in player.flags:
            say("The grate is in the way.")
            return
        player.room = "pit_tunnels"
        await enter_room(player)
        return
    dungeon = LOCATIONS.get(ch, {}).get("dungeon")
    if not dungeon:
        say("There's nothing to enter here.")
        return
    if ch == "P" and not await pit_gate(player):
        return
    player.room = dungeon[1]
    await enter_room(player)


async def pit_gate(player):
    f = player.flags
    if "kessler_dead" in f or "gate_open" in f:
        return True
    if "covenant_allied" in f:
        say("\nCovenant mortars are already falling on the Pit. White-tabarded zealots storm the gate "
            "with you, singing. The raiders on the walls burn.")
        f += ["gate_open", "siege"]
        return True
    if "gate_pass" in player.inventory:
        say("\nYou flash the gate pass. A raider grins and hauls the gate open. \"Enjoy the show, meat.\"")
        return True
    say("\nThe raiders on the gate level their rifles. \"No pass, no entry. Unless you're on the menu.\"")
    pick = await choose(player, [
        ("\"Brennan sent me. Merchandise is in the truck.\" (bluff)", ("CHA", 6)),
        "Fight your way in",
        "Back off",
    ])
    if pick == 1:
        say("They swallow it. The gate opens. You'd better be done before they check the truck.")
        f.append("gate_open")
        return True
    if pick == 2:
        for enemy in ("raider", "raider", "butcher"):
            if await fight(player, enemy) != "won":
                return False
        f.append("gate_open")
        say("The gate is yours. The whole stadium heard.")
        return True
    return False


async def enter_room(player):
    describe(player)
    room = ROOMS[player.room]
    if room.get("rads"):
        player.add_rads(room["rads"], source=f"radiation at {room['name']}")
        if player.hp <= 0:
            return
    boss = room.get("boss")
    if boss and f"{boss}_dead" not in player.flags:
        hp = None
        if boss == "kessler" and "siege" in player.flags:
            say("Kessler is already bleeding from shrapnel. Covenant fire has done half your work.")
            hp = ENEMIES["kessler"]["hp"] * 6 // 10
        if await fight(player, boss, hp) == "won":
            await BOSSES[boss](player)
        return
    if room.get("event"):
        await run_event(player, room["event"])
        if player.hp <= 0:
            return
    if "siege" in player.flags and player.room == "pit_yard":
        return
    await encounter(player, 0.45, room.get("enemies"))


async def dungeon_move(player, direction):
    room = ROOMS[player.room]
    if direction in ("out", "leave", "exit"):
        if not room.get("out"):
            say("No way out from here.")
            return
        if room["out"] == "U" and "drain_open" not in player.flags:
            say("You shove the grate open from the inside.")
            player.flags.append("drain_open")
        player.room = None
        player.pos = loc_pos(room["out"])
        player.reveal()
        say("You step back out under the grey sky.")
        describe(player)
        return
    if direction not in room["exits"]:
        say("You can't go that way.")
        return
    gate = room.get("gates", {}).get(direction)
    if gate and gate not in player.flags:
        say("A steel door, locked. The terminal here controls it. (hack)")
        return
    tick(player, 1, 2)
    if player.hp <= 0:
        return
    player.room = room["exits"][direction]
    await enter_room(player)


async def search(player):
    if player.room:
        room = ROOMS[player.room]
        key = player.room
        boss = room.get("boss")
        if boss and f"{boss}_dead" not in player.flags:
            say("Not while that thing's alive.")
            return
        loot = room.get("loot", [])
    else:
        key = pos_key(player.pos)
        ch = player.tile()
        if ch in LOCATIONS:
            loot = LOCATIONS[ch].get("loot", [])
        else:
            table = TERRAIN[ch]["loot"]
            n = 1 + (random.random() < 0.1 * player.stats["LCK"])
            loot = random.sample(table, min(n, len(table)))
    if key in player.searched or not loot:
        say("Picked clean.")
        return
    player.searched.append(key)
    tick(player, 1, 1)
    for item_id in loot:
        player.give(item_id)
    if player.companion == "ash" and not player.room and random.random() < 0.5:
        say("Ash digs something up.")
        player.give(random.choice(["jerky", "ammo_10mm", "stimpak", "ring"]))
    if not player.room and player.tile() not in LOCATIONS:
        await encounter(player, 0.15, TERRAIN[player.tile()]["enemies"])


def drink(player):
    if player.room or town_here(player):
        say("No river here. Buy water from a trader.")
        return
    x, y = player.pos
    near = player.tile() in ("B", "Q") or any(
        0 <= x + dx < WIDTH and 0 <= y + dy < HEIGHT and WORLD[y + dy][x + dx] == "~"
        for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    if not near:
        say("Nothing to drink here but your own sweat.")
        return
    player.thirst = min(100, player.thirst + 30)
    say(f"You kneel and drink the black river water. It tastes like batteries. (Water {player.thirst})")
    if "iron_gut" not in player.perks:
        player.add_rads(14, source="river water")


def show_inventory(player):
    say(f"Caps: {player.caps}   Ammo: " + "  ".join(f"{k} {v}" for k, v in player.ammo.items()))
    say(f"Equipped: {ITEMS[player.weapon]['name']} ({player.cond.get(player.weapon, 100)}%), "
        f"{ITEMS[player.armor]['name']} ({player.cond.get(player.armor, 100)}%)")
    if not player.inventory:
        say("Your pack is empty.")
        return
    for item_id in dict.fromkeys(player.inventory):
        item = ITEMS[item_id]
        say(f"  {item['name']} x{player.inventory.count(item_id)} - {item['desc']}")


def find_item(query, pool):
    q = query.replace(" ", "_")
    for item_id in pool:
        if q == item_id or query == ITEMS[item_id]["name"].lower():
            return item_id
    for item_id in pool:
        if query and query in ITEMS[item_id]["name"].lower():
            return item_id
    return None


def use_item(player, query):
    item_id = find_item(query, player.inventory)
    if not item_id:
        say("You don't have that.")
        return
    item = ITEMS[item_id]
    if item["kind"] in ("weapon", "armor"):
        slot = item["kind"]
        player.inventory.remove(item_id)
        player.inventory.append(getattr(player, slot))
        setattr(player, slot, item_id)
        say(f"You equip the {item['name']} ({player.cond.get(item_id, 100)}%).")
    elif not consume(player, item_id):
        say("You can't use that here.")


def field_repair(player):
    target = min((player.weapon, player.armor), key=lambda i: player.cond.get(i, 100))
    if player.cond.get(target, 100) >= 100:
        say("Your gear is in as good a shape as it gets.")
        return
    if target in player.inventory:
        player.inventory.remove(target)
        gain = 30 + player.stats["WIT"] * 5
        how = f"a spare {ITEMS[target]['name']}"
    elif "scrap" in player.inventory:
        player.inventory.remove("scrap")
        gain = 10 + player.stats["WIT"] * 4
        how = "scrap metal"
    else:
        say("You need Scrap Metal or a spare of the same item to patch it.")
        return
    player.cond[target] = min(100, player.cond.get(target, 100) + gain)
    say(f"You patch your {ITEMS[target]['name']} with {how}. Now {player.cond[target]}%.")


def repair_cost(player):
    total = 0
    for item_id in (player.weapon, player.armor):
        missing = 100 - player.cond.get(item_id, 100)
        total += ITEMS[item_id]["price"] * missing / 100 * 0.6
    return round(total * (1.2 - 0.04 * player.stats["WIT"]))


async def shop(player):
    town = town_here(player)
    if not town:
        say("Nobody here to trade with.")
        return
    t = TOWNS[town]
    stock = [s if isinstance(s, str) else s[0] for s in t["shop"]
             if isinstance(s, str) or s[1] in player.flags]
    while True:
        say(f"\n-- {t['trader']} -- (caps: {player.caps})")
        for n, item_id in enumerate(stock, 1):
            item = ITEMS[item_id]
            say(f"  {n:>2}. {item['name']:<24} {player.price(item_id):>4}c  {item['desc']}")
        cost = repair_cost(player)
        say(f"   r. Repair gear ({cost}c)   s. Sell   q. Leave")
        pick = await ask("> ")
        if pick in ("q", "leave", ""):
            return
        if pick == "r":
            if cost == 0:
                say("Nothing needs fixing.")
            elif player.caps < cost:
                say("Not enough caps.")
            else:
                player.caps -= cost
                player.cond[player.weapon] = player.cond[player.armor] = 100
                say("Good as it gets.")
            continue
        if pick == "s":
            sellable = [i for i in dict.fromkeys(player.inventory) if ITEMS[i]["price"] > 0]
            if not sellable:
                say("Nothing they want.")
                continue
            for n, item_id in enumerate(sellable, 1):
                say(f"  {n}. {ITEMS[item_id]['name']} x{player.inventory.count(item_id)} - "
                    f"{player.price(item_id, selling=True)}c")
            sell = await ask("Sell which? > ")
            if sell.isdigit() and 1 <= int(sell) <= len(sellable):
                item_id = sellable[int(sell) - 1]
                player.inventory.remove(item_id)
                player.caps += player.price(item_id, selling=True)
                say(f"Sold {ITEMS[item_id]['name']}.")
            continue
        if pick.isdigit() and 1 <= int(pick) <= len(stock):
            item_id = stock[int(pick) - 1]
            if player.caps < player.price(item_id):
                say("\"Caps first.\"")
            else:
                player.caps -= player.price(item_id)
                player.give(item_id)


async def talk(player):
    town = town_here(player)
    if not town:
        say("You mutter to yourself. The wasteland doesn't answer.")
        return
    npcs = [n for n in TOWNS[town]["npcs"] if npc_here(player, n)]
    pick = await choose(player, [NPCS[n][0] for n in npcs] + ["Nobody"])
    if pick <= len(npcs):
        await NPCS[npcs[pick - 1]][1](player)


def rest(player):
    town = town_here(player)
    if not town:
        say("Sleep out here and you won't wake up.")
        return
    cost = TOWNS[town]["rest"]
    if player.caps < cost:
        say(f"A bed costs {cost} caps.")
        return
    player.caps -= cost
    hour = clock(player)[1]
    player.turns += ((7 - hour) % 24 or 24) - 1  # sleep until 07:00
    tick(player, 8, 8)
    player.hp = player.cap_hp
    for cid in player.comp_hp:
        player.comp_hp[cid] = COMPANIONS[cid]["hp"]
    say(f"You sleep with a knife under your pillow. ({cost} caps) HP restored.")
    dreams = ["You dream of the shelter. The door won't open. You knock until your knuckles bleed.",
              "You dream of the faces of everyone you've killed. There are more than you thought.",
              "You don't dream. That's the best night's sleep you've had in weeks."]
    if player.addicted:
        dreams = ["You dream of Rush all night. You wake up chewing the inside of your cheek."]
    say(random.choice(dreams))


async def spend_points(player):
    while player.stat_points > 0:
        say(f"\nYou have {player.stat_points} stat point(s) to spend.")
        for s in STATS:
            say(f"  {s} {player.stats[s]:>2}  {STAT_HELP[s]}")
        pick = (await ask("Raise which? (str/aim/end/cha/wit/lck) > "))[:3].upper()
        if pick in STATS and player.stats[pick] < 10:
            player.stats[pick] += 1
            player.stat_points -= 1
            if pick == "END":
                player.hp += 4
            say(f"{pick} is now {player.stats[pick]}.")


# ================================================================ time and weather


def clock(player):
    """Every turn is an hour. You leave the shelter at 06:00 on day 1."""
    t = 6 + player.turns
    return 1 + t // 24, t % 24


def is_night(player):
    hour = clock(player)[1]
    return hour >= 20 or hour < 5


def time_label(player):
    day, hour = clock(player)
    return f"Day {day}, {hour:02d}:00" + (" - night" if is_night(player) else "")


NIGHT_LINES = [
    "It's dark. Things move out here at night that don't move in daylight.",
    "No moon. Somewhere close, something is eating something else.",
    "Night. Every shadow could be a raider. Some of them are.",
    "A campfire flickers on the horizon, then goes out. Someone put it out.",
]


def weather(player):
    """Radstorms roll in at random and cost rads on every step outdoors until they pass."""
    end = player.timers.get("storm", 0)
    if end > player.turns:
        player.add_rads(6, source="a radstorm")
        if end == player.turns + 1:
            say("The radstorm moves on, grumbling green to the east.")
        else:
            say("The radstorm howls around you. Green lightning. Get under a roof.")
    elif random.random() < 0.03:
        player.timers["storm"] = player.turns + 5
        say("\nThe sky turns the colour of a bruise. A radstorm is rolling in. Every step outside will cost "
            "rads until it passes. Towns and buildings are shelter.")


# ================================================================ perks

PERKS = {
    "toughness":   ("Toughness", "+2 defense."),
    "bloody_mess": ("Bloody Mess", "+15% damage. People come apart more."),
    "medic":       ("Field Medic", "Stimpaks and Super Stims heal 50% more."),
    "iron_gut":    ("Iron Gut", "Food and water never give you rads."),
    "steady":      ("Steady Hands", "Your guns never jam and wear half as fast."),
    "night_owl":   ("Night Owl", "+3 attack at night."),
    "scrounger":   ("Scrounger", "Ammo comes in bigger bundles (+50%)."),
    "cannibal":    ("Cannibal", "Eat from the people you kill. It heals and feeds you. It costs karma."),
    "card_sharp":  ("Card Sharp", "See the dealer's hole card at blackjack. Read tells at liar's dice."),
    "hacker":      ("Hacker", "Two extra attempts on terminals."),
    "rad_child":   ("Rad Child", "Take 30% fewer rads."),
}


async def choose_perk(player):
    while player.perk_points > 0:
        options = [p for p in PERKS if p not in player.perks]
        if not options:
            player.perk_points = 0
            return
        offer = random.sample(options, min(3, len(options)))
        say("\nPick a perk:")
        pick = offer[await choose(player, [f"{PERKS[p][0]} - {PERKS[p][1]}" for p in offer]) - 1]
        player.perks.append(pick)
        player.perk_points -= 1
        say(f"You gain {PERKS[pick][0]}.")


# ================================================================ bounty board (Dustwater)

BOUNTIES = [
    {"id": "rats", "targets": ["rat"], "n": 4, "reward": 35, "short": "4 bloat rats",
     "text": "BLOAT RATS IN THE GRAIN STORE. FOUR TAILS. 35 CAPS."},
    {"id": "dogs", "targets": ["dog", "wolf"], "n": 4, "reward": 50, "short": "4 dogs or wolves",
     "text": "A PACK TOOK THE MORROW BABY. KILL FOUR. 50 CAPS. DON'T BRING BACK WHAT'S LEFT OF HER."},
    {"id": "husks", "targets": ["husk", "failed"], "n": 4, "reward": 80, "short": "4 husks",
     "text": "THE HUSKS WERE OUR NEIGHBOURS. PUT FOUR OF THEM DOWN. 80 CAPS."},
    {"id": "raiders", "targets": ["raider", "butcher"], "n": 5, "reward": 120, "short": "5 Red Teeth",
     "text": "RED TEETH. FIVE PAIRS OF EARS. 120 CAPS. - OKAFOR"},
    {"id": "slavers", "targets": ["slaver"], "n": 3, "reward": 110, "short": "3 slavers",
     "text": "SLAVERS TOOK MY SON. THREE OF THEM. 110 CAPS. MAKE IT HURT."},
    {"id": "glow", "targets": ["stinger", "brute"], "n": 3, "reward": 150, "short": "3 Glow beasts",
     "text": "THINGS ARE CRAWLING OUT OF THE GLOW. THREE OF THEM. 150 CAPS. PROOF REQUIRED."},
]
BOUNTY_BY_ID = {b["id"]: b for b in BOUNTIES}


def count_bounty(player, enemy_id):
    if not player.bounty:
        return
    b = BOUNTY_BY_ID[player.bounty["id"]]
    if enemy_id in b["targets"] and player.bounty["count"] < b["n"]:
        player.bounty["count"] += 1
        done = player.bounty["count"] == b["n"]
        say(f"(Bounty: {player.bounty['count']}/{b['n']}" + (" - collect it at the Dustwater board)" if done else ")"))


async def bounty_board(player):
    if town_here(player) != "dustwater":
        say("The bounty board is in Dustwater.")
        return
    if player.bounty:
        b = BOUNTY_BY_ID[player.bounty["id"]]
        if player.bounty["count"] >= b["n"]:
            player.caps += b["reward"]
            player.bounty = None
            say(f"You nail your proof to the board. Okafor pays {b['reward']} caps and doesn't look at it too "
                "closely.")
            player.gain_xp(20)
        else:
            say(f"Your contract: {b['text']} ({player.bounty['count']}/{b['n']})")
            if await choose(player, ["Keep it", "Tear it up"]) == 2:
                player.bounty = None
                say("You tear it up. Someone else can do it. Or no one.")
            return
    say("\nThe bounty board is a door nailed to a post, covered in notes:")
    offers = random.sample(BOUNTIES, 3)
    pick = await choose(player, [f"{o['text']} ({o['reward']}c)" for o in offers] + ["Leave it"])
    if pick <= len(offers):
        player.bounty = {"id": offers[pick - 1]["id"], "count": 0}
        say("You tear the note off the board and pocket it.")


# ================================================================ side games


SUITS = "♠♥♦♣"


def card_name(card):
    rank, suit = card
    return {1: "A", 11: "J", 12: "Q", 13: "K"}.get(rank, str(rank)) + suit


def hand_value(hand):
    total = sum(11 if r == 1 else min(r, 10) for r, _ in hand)
    aces = sum(1 for r, _ in hand if r == 1)
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total


def show_hand(hand):
    return " ".join(card_name(c) for c in hand) + f"  ({hand_value(hand)})"


async def blackjack(player):
    say("\nLucky Pete deals blackjack at the back of The Last Drop. He has seven fingers. \"Lost the other "
        "three on a bad hand,\" he says. \"Not my hand.\" Dealer stands on 17. Blackjack pays 3 to 2.")
    while True:
        say(f"\nYou have {player.caps} caps and {player.hp} HP.")
        bet_s = await ask("Bet (5-100 caps, 'blood', or 'leave') > ", keys=["10", "25", "50", "blood", "leave"])
        if bet_s in ("leave", "q", "0", ""):
            say("Pete shuffles. \"Come back when you're desperate.\"")
            return
        blood = bet_s == "blood"
        if blood:
            if player.hp <= 20:
                say("Pete looks you over. \"You ain't got a pint to spare. You'd die on my table. Bad for business.\"")
                continue
            bet = 30
            say("Pete ties off your arm and sets an empty jar on the table. \"A pint's worth 30. Doc buys it. "
                "Don't ask what for.\"")
        elif bet_s.isdigit() and 5 <= int(bet_s) <= 100:
            bet = int(bet_s)
            if bet > player.caps:
                say("You don't have that many caps. (You could bet blood.)")
                continue
        else:
            say("Bets are 5 to 100 caps, or 'blood'.")
            continue

        deck = [(r, s) for r in range(1, 14) for s in SUITS]
        random.shuffle(deck)
        you, dealer = [deck.pop(), deck.pop()], [deck.pop(), deck.pop()]
        peek = f" You can see his hole card: {card_name(dealer[1])}." if "card_sharp" in player.perks else ""
        say(f"Pete shows {card_name(dealer[0])}.{peek}")
        say(f"You: {show_hand(you)}")
        outcome = None
        if hand_value(you) == 21:
            outcome = "push" if hand_value(dealer) == 21 else "blackjack"
        else:
            first = True
            while True:
                can_double = first and not blood and player.caps >= bet * 2
                keys = ["h", "s"] + (["d"] if can_double else [])
                act = await ask("(h)it  (s)tand" + ("  (d)ouble" if can_double else "") + " > ", keys=keys)
                if act in ("s", "stand"):
                    break
                if act in ("h", "hit") or (act in ("d", "double") and can_double):
                    if act.startswith("d"):
                        bet *= 2
                        say(f"You double down. {bet} caps on the table.")
                    you.append(deck.pop())
                    say(f"You: {show_hand(you)}")
                    if hand_value(you) > 21:
                        outcome = "bust"
                        break
                    if act.startswith("d"):
                        break
                    first = False
            if not outcome:
                say(f"Pete flips {card_name(dealer[1])}. Dealer: {show_hand(dealer)}")
                while hand_value(dealer) < 17:
                    dealer.append(deck.pop())
                    say(f"Pete draws. Dealer: {show_hand(dealer)}")
                d, y = hand_value(dealer), hand_value(you)
                outcome = "win" if d > 21 or y > d else "push" if y == d else "lose"

        if outcome in ("win", "blackjack"):
            won = round(bet * 1.5) if outcome == "blackjack" else bet
            player.caps += won
            say(("Blackjack! " if outcome == "blackjack" else "You win. ")
                + (f"You keep your blood, and Pete pays {won} caps." if blood else f"+{won} caps."))
        elif outcome == "push":
            say("Push. Nobody wins. Pete looks disappointed.")
        else:
            say("Bust. " if outcome == "bust" else "Pete wins. ")
            if blood:
                player.hp -= 15
                say("Pete fills the jar from your arm. The room tilts. -15 HP.")
            else:
                player.caps -= bet
                say(f"-{bet} caps.")


def at_least(k, n=5, p=1 / 6):
    """Chance that at least k of n hidden dice show a given face."""
    if k <= 0:
        return 1.0
    from math import comb
    return sum(comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k, n + 1))


async def liars_dice(player):
    say("\nIn the barracks, Brother Cole plays liar's dice for caps, and sometimes for confessions. Five dice "
        "each under a cup. Bid how many dice of a face are on the whole table, counting his and yours. Each bid "
        "must beat the last. Call 'liar' if you think the last bid is false.")
    while True:
        say(f"\nYou have {player.caps} caps.")
        stake_s = await ask("Stake (10-80 caps, or 'leave') > ", keys=["10", "25", "50", "leave"])
        if stake_s in ("leave", "q", "0", ""):
            say("Cole nods. \"Go with purity.\"")
            return
        if not stake_s.isdigit() or not 10 <= int(stake_s) <= 80:
            say("Stakes are 10 to 80 caps.")
            continue
        stake = int(stake_s)
        if stake > player.caps:
            say("You don't have that many caps.")
            continue

        mine = sorted(random.randint(1, 6) for _ in range(5))
        his = [random.randint(1, 6) for _ in range(5)]
        say(f"You lift your cup: {' '.join(map(str, mine))}")
        bid, caller, turn = None, None, "you"
        while caller is None:
            if turn == "you":
                text = await ask("Bid like '3 4' (three 4s)" + (" or 'liar'" if bid else "") + " > ",
                                 keys=["liar"] if bid else [])
                if text == "liar" and bid:
                    caller = "you"
                    break
                parts = text.split()
                if len(parts) != 2 or not all(p.isdigit() for p in parts):
                    say("Bid two numbers: how many dice, then which face.")
                    continue
                q, f = int(parts[0]), int(parts[1])
                if not (1 <= f <= 6 and 1 <= q <= 10):
                    say("Faces run 1 to 6, and there are 10 dice on the table.")
                    continue
                if bid and not (q > bid[0] or (q == bid[0] and f > bid[1])):
                    say(f"You have to beat {bid[0]} x {bid[1]}: more dice, or the same count of a higher face.")
                    continue
                bid, turn = (q, f), "cole"
                say(f"You bid {q} x {f}.")
            else:
                q, f = bid
                if q >= 10 or at_least(q - his.count(f)) < 0.4 + random.uniform(-0.1, 0.1):
                    say("Cole smiles thinly. \"Liar.\"")
                    caller = "cole"
                    break
                options = []
                for f2 in range(1, 7):
                    q2 = q if f2 > f else q + 1
                    if q2 <= 10:
                        options.append((at_least(q2 - his.count(f2)), q2, f2))
                chance, q2, f2 = max(options)
                if random.random() < 0.2:
                    chance, q2, f2 = random.choice(options)  # a bluff
                elif chance < 0.3:
                    say("Cole smiles thinly. \"Liar.\"")
                    caller = "cole"
                    break
                bid, turn = (q2, f2), "you"
                say(f"Cole bids {q2} x {f2}.")
                if "card_sharp" in player.perks:
                    say("His thumb taps the cup. He's bluffing." if chance < 0.5 else "He's calm. He believes it.")

        q, f = bid
        total = mine.count(f) + his.count(f)
        say(f"Cups up. Cole had {' '.join(map(str, sorted(his)))}. There are {total} x {f} on the table.")
        bidder_honest = total >= q
        you_win = bidder_honest if caller == "cole" else not bidder_honest
        if you_win:
            player.caps += stake
            say(f"You win {stake} caps. Cole pays, and writes your name in a little black book.")
        else:
            player.caps -= stake
            say(f"You lose {stake} caps. \"The Covenant thanks you for your tithe.\"")


async def gamble(player):
    town = town_here(player)
    if not town:
        say("Nobody out here plays for anything but your life.")
        return
    await (blackjack(player) if TOWNS[town]["game"] == "blackjack" else liars_dice(player))


# ================================================================ logic puzzles


HACK_WORDS = ["BURNING", "CORPSES", "SHELTER", "MARTYRS", "FURNACE", "SCALPEL", "HARVEST", "BLESSED",
              "CRUSADE", "PENANCE", "SURGEON", "CARCASS", "PURGING", "RADIANT", "SINNERS", "TRAITOR",
              "WARDENS", "PRAYERS", "RITUALS", "MORTALS", "BANDAGE", "SUTURES", "DONATED", "REDEEMS",
              "CLEANSE", "MARROWS", "SERVICE", "TITHING", "BURIALS", "WEEPING", "HANGING", "CHAPELS"]
assert all(len(w) == 7 for w in HACK_WORDS)


def likeness(a, b):
    return sum(x == y for x, y in zip(a, b))


async def hack(player, term):
    """Guess the password from the list. Each miss shows how many letters sit in the right place.
    Returns 'open', 'locked', or None if you log off."""
    st = player.puzzles.get(term["id"])
    if not st:
        answer = random.choice(HACK_WORDS)
        others = sorted((w for w in HACK_WORDS if w != answer), key=lambda w: -likeness(w, answer))
        words = [answer] + others[:4] + random.sample(others[4:], 3)
        random.shuffle(words)
        tries = 4 + (2 if "hacker" in player.perks else 0) + (1 if player.stats["WIT"] >= 7 else 0)
        st = player.puzzles[term["id"]] = {"words": words, "answer": answer, "left": tries, "tried": [], "done": None}
    if st["done"]:
        say("ACCESS ALREADY GRANTED." if st["done"] == "open" else "TERMINAL LOCKED. PERMANENTLY.")
        return st["done"]
    say(f"\n> {term['title']}")
    say(f"> PASSWORD REQUIRED. {st['left']} ATTEMPT(S) BEFORE LOCKOUT.")
    say("Each wrong guess shows its likeness: how many letters match the password in the same position.")
    while st["left"] > 0:
        say("  " + "  ".join(st["words"]))
        for word, like in st["tried"]:
            say(f"  > {word}: likeness {like}/7")
        guess = (await ask("Password > ", keys=[w.lower() for w in st["words"]] + ["exit"])).upper()
        if guess == "EXIT":
            say("You log off. The attempts you used stay used.")
            return None
        if guess not in st["words"]:
            say("Type one of the listed words.")
            continue
        if guess == st["answer"]:
            st["done"] = "open"
            say("> ACCESS GRANTED.")
            return "open"
        st["left"] -= 1
        st["words"].remove(guess)
        st["tried"].append((guess, likeness(guess, st["answer"])))
        say(f"> {guess}: ENTRY DENIED. LIKENESS {st['tried'][-1][1]}/7. {st['left']} ATTEMPT(S) LEFT.")
        save_game(player)
    st["done"] = "locked"
    say("> TERMINAL LOCKED. SECURITY NOTIFIED.")
    return "locked"


async def hack_here(player):
    if player.room:
        term = ROOMS[player.room].get("terminal")
    else:
        term = TOWNS.get(town_here(player) or "", {}).get("terminal")
    if not term:
        say("No terminal here.")
        return
    result = await hack(player, term)
    flag = f"open_{term['id']}"
    if result == "open" and flag not in player.flags:
        player.flags.append(flag)
        say(term["opens"])
        for item_id in term.get("reward", []):
            player.give(item_id)
    elif result == "locked" and f"alarm_{term['id']}" not in player.flags:
        player.flags.append(f"alarm_{term['id']}")
        say("An alarm bell clangs. Boots on the stairs.")
        await fight(player, term["alarm"])


def code_feedback(guess, code):
    well = sum(g == c for g, c in zip(guess, code))
    return well, len(set(guess) & set(code)) - well


def make_code_puzzle(rng=random):
    """A 3-digit code (distinct digits) and clues that pin it down to exactly one answer."""
    codes = [a + b + c for a in "0123456789" for b in "0123456789" for c in "0123456789" if len({a, b, c}) == 3]
    while True:
        code = rng.choice(codes)
        clues, left = [], codes
        while len(left) > 1 and len(clues) < 6:
            best = None
            for g in rng.sample(codes, 12):
                fb = code_feedback(g, code)
                if fb == (3, 0):
                    continue
                remaining = [c for c in left if code_feedback(g, c) == fb]
                if best is None or len(remaining) < len(best[2]):
                    best = (g, fb, remaining)
            if best and len(best[2]) < len(left):
                clues.append((best[0], best[1]))
                left = best[2]
        if len(left) == 1:
            return code, clues


def feedback_text(well, wrong):
    if well == 0 and wrong == 0:
        return "nothing is correct"
    total = well + wrong
    words = {1: "one", 2: "two", 3: "three"}
    text = f"{words[total]} number{'s are' if total > 1 else ' is'} correct"
    if well == total:
        return text + (" and well placed" if total == 1 else ", both well placed")
    if well == 0:
        return text + " but wrongly placed"
    return text + f"; {words[well]} {'is' if well == 1 else 'are'} well placed"


async def crack_safe(player):
    safe = ROOMS[player.room].get("safe") if player.room else None
    if not safe:
        say("There's no safe here.")
        return
    boss = ROOMS[player.room].get("boss")
    if boss and f"{boss}_dead" not in player.flags:
        say("Not while that thing is alive.")
        return
    st = player.puzzles.get(safe["id"])
    if not st:
        code, clues = make_code_puzzle()
        st = player.puzzles[safe["id"]] = {"code": code, "clues": clues, "left": 3, "done": None}
    if st["done"]:
        say("The safe hangs open, empty." if st["done"] == "open" else "The safe is a melted lump now.")
        return
    say(f"\n{safe['title']}")
    say("Scratched into the paint beside the dial, someone's notes:")
    for guess, (well, wrong) in st["clues"]:
        say(f"  {' '.join(guess)}  - {feedback_text(well, wrong)}")
    say("The code is three different digits.")
    while st["left"] > 0:
        guess = (await ask(f"Code ({st['left']} tries) > ", keys=["exit"])).replace(" ", "")
        if guess in ("exit", "leave", "q"):
            say("You leave the dial alone, for now.")
            return
        if len(guess) != 3 or not guess.isdigit() or len(set(guess)) != 3:
            say("Three different digits, like 507.")
            continue
        if guess == st["code"]:
            st["done"] = "open"
            say("The tumblers fall. The door swings open.")
            player.caps += safe["caps"]
            say(f"+ {safe['caps']} caps")
            for item_id in safe["loot"]:
                player.give(item_id)
            return
        st["left"] -= 1
        say("The dial grinds. Wrong." + (" Something inside the door clicks, like a warning." if st["left"] == 1 else ""))
        save_game(player)
    st["done"] = "trapped"
    player.hp -= safe["trap"]
    say(f"{safe['trap_text']} -{safe['trap']} HP. Whatever was inside is ruined.")
    if player.hp <= 0:
        player.killer = "a booby-trapped safe"


PRISONERS = ["the boy with burned hands", "the old woman", "the man with one ear"]


def statement_true(kind, target, rat):
    return (target == rat) if kind in ("is", "lies") else (target != rat)


def make_knaves(rng=random):
    """Three prisoners, one of them a liar. Each makes one claim about another, and exactly one choice
    of liar fits every claim."""
    while True:
        claims = [(rng.choice(["is", "isnt", "truth", "lies"]), rng.choice([t for t in range(3) if t != s]))
                  for s in range(3)]
        fits = [rat for rat in range(3)
                if all(statement_true(k, t, rat) == (s != rat) for s, (k, t) in enumerate(claims))]
        if len(fits) == 1:
            return claims, fits[0]


def claim_text(kind, target):
    who = PRISONERS[target]
    return {"is": f"{who.capitalize()} is the rat.",
            "isnt": f"{who.capitalize()} isn't the rat.",
            "truth": f"{who.capitalize()} is telling you the truth.",
            "lies": f"{who.capitalize()} is lying to you."}[kind]


async def event_cage(player):
    st = player.puzzles.get("cage")
    if not st:
        claims, rat = make_knaves()
        st = player.puzzles["cage"] = {"claims": claims, "rat": rat}
    say("\nIn the fattening cage, three prisoners press against the bars. A raider laughs as he walks past: one "
        "of them is a Red Teeth rat, planted to listen for escape plans. The rat always lies. The other two "
        "tell the truth. They're desperate for you to believe them.")
    for s, (kind, target) in enumerate(st["claims"]):
        say(f"  {PRISONERS[s].capitalize()}: \"{claim_text(kind, target)}\"")
    pick = await choose(player, [f"Point at {p}" for p in PRISONERS] + ["Walk away"])
    if pick == 4:
        return False
    accused = pick - 1
    if accused == st["rat"]:
        say(f"You point at {PRISONERS[accused]}. The other two exhale. You jam the lock with your knife and the "
            "cage swings open. The two you freed vanish into the smoke. The last thing they tell you is that a "
            "storm drain south-east of here leads under the stadium.")
        if pos_key(loc_pos("U")) not in player.seen:
            player.seen.append(pos_key(loc_pos("U")))
        say(f"{PRISONERS[accused].capitalize()} watches you through the bars. \"They'll let me out. They always do.\"")
        if await choose(player, ["Leave the rat in the cage", "Make sure they don't"]) == 2:
            say("It's quick. Nobody in the yard even looks up.")
        player.give("stimpak")
        player.karma_shift(1)
    else:
        say(f"You point at {PRISONERS[accused]}. Behind you, the real rat starts screaming for the guards. "
            f"Two raiders drag {PRISONERS[accused]} out of the cage toward the arena. You can hear the crowd "
            "start to cheer. The third raider comes for you.")
        player.karma_shift(-1)
        await fight(player, "butcher")
    return True


JUG_PUZZLES = [(3, 5, 4), (5, 7, 6), (4, 9, 6), (5, 8, 2)]


async def jug_puzzle(player):
    a_cap, b_cap, goal = random.choice(JUG_PUZZLES)
    say(f"\nThe Tollman sets two rusted cans on the bridge. \"Can A holds {a_cap} litres. Can B holds {b_cap}. "
        f"River's right there. Bring me exactly {goal} litres in one can. Twelve moves.\"")
    a = b = 0
    for moves_left in range(12, 0, -1):
        say(f"Can A: {a}/{a_cap}   Can B: {b}/{b_cap}   ({moves_left} move{'s' if moves_left > 1 else ''} left)")
        move = await ask("Jugs (fill a, empty b, pour a b...) > ",
                         keys=["fill a", "fill b", "empty a", "empty b", "pour a b", "pour b a", "give up"])
        words = move.split()
        if move in ("give up", "quit", "q"):
            return False
        if words[:1] == ["fill"] and words[1:] in (["a"], ["b"]):
            a, b = (a_cap, b) if words[1] == "a" else (a, b_cap)
        elif words[:1] == ["empty"] and words[1:] in (["a"], ["b"]):
            a, b = (0, b) if words[1] == "a" else (a, 0)
        elif move == "pour a b":
            n = min(a, b_cap - b)
            a, b = a - n, b + n
        elif move == "pour b a":
            n = min(b, a_cap - a)
            a, b = a + n, b - n
        else:
            say("\"Fill, empty or pour. Try again. That one's free.\"")
            continue
        if goal in (a, b):
            say(f"Can A: {a}/{a_cap}   Can B: {b}/{b_cap}")
            return True
    return False


async def event_tollman(player):
    f = player.flags
    if "toll_free" in f or "tollman_dead" in f:
        return False
    say("\nThe Tollman stands up, and keeps standing up. \"Toll's thirty caps. Or answer my riddle and walk "
        "free forever. Or try your luck.\" He pats the sack. Something in it is still blinking.")
    while True:
        pick = await choose(player, [f"Pay 30 caps (you have {player.caps})", "Take the riddle",
                                     "Fight him", "Turn back"])
        if pick == 1:
            if player.caps < 30:
                say("\"That's not thirty.\"")
                continue
            player.caps -= 30
            say("He bites each cap before he lets you pass.")
            return False
        if pick == 2:
            if await jug_puzzle(player):
                say("The Tollman stares at the can for a long time. Then he laughs, a sound like a landslide. "
                    "\"Clever meat. Cross whenever you like.\" He even pays you for the entertainment.")
                player.caps += 40
                f.append("toll_free")
                player.gain_xp(40)
                return True
            say("\"Wrong.\" He opens the sack a little wider, just to show you the room in it. \"Pay, fight, "
                "or walk.\"")
            continue
        if pick == 3:
            if await fight(player, "tollman") == "won":
                f.append("tollman_dead")
                say("You open the sack. You count nineteen heads before you stop counting. One of them still "
                    "has a Shelter 41 haircut.")
                player.give("grenade")
            return True
        say("You back off the bridge.")
        player.pos = list(player.prev_pos)
        player.reveal()
        describe(player)
        return False


EVENTS.update(cage=event_cage, tollman=event_tollman)


# ================================================================ quick keys for the browser


def context_keys(player):
    keys = []
    if player.room:
        room = ROOMS[player.room]
        keys += [d for d in ("north", "south", "east", "west", "up", "down") if d in room["exits"]]
        if room.get("out"):
            keys.append("out")
        keys.append("search")
        if room.get("terminal"):
            keys.append("hack")
        if room.get("safe"):
            keys.append("crack")
    else:
        x, y = player.pos
        keys += [d[0] for d, (dx, dy) in DIRS.items()
                 if 0 <= x + dx < WIDTH and 0 <= y + dy < HEIGHT and WORLD[y + dy][x + dx] != "~"]
        keys += ["map", "search"]
        town = town_here(player)
        if town:
            keys += ["talk", "shop", "rest", "gamble"] + (["board"] if town == "dustwater" else ["hack"])
        elif LOCATIONS.get(player.tile(), {}).get("dungeon") or player.tile() == "U":
            keys.append("enter")
    return keys + ["look", "inv", "stats", "help"]


# ================================================================ ending


def companion_slide(cid, f):
    if f"{cid}_dead" in f:
        return {"mara": "Mara is buried outside the Pit, facing it. Somebody keeps leaving rebar spikes "
                        "on her grave.",
                "tomas": "Lina was told her father died a hero. It was true. It didn't help.",
                "ash": "Ash is buried by the school bus where you found him, next to the man he was "
                       "guarding."}[cid]
    if f"{cid}_left" in f:
        return {"mara": "Mara went east alone. Years later, a slaver band was wiped out by a single woman "
                        "with a tyre iron. Maybe it was her.",
                "tomas": "Tomas went home to Lina and never spoke your name again."}[cid]
    return {"mara": "Mara became sheriff of Dustwater when Okafor died. She hanged every slaver who came "
                    "within a mile of the town.",
            "tomas": "Tomas lived long enough to walk Lina down the aisle. He kept a chair empty at the "
                     "wedding, for you.",
            "ash": "Ash grew old and grey and slept at your feet every night. He was the only one who "
                   "never asked what you'd done."}[cid]


async def epilogue(player, how):
    f = player.flags
    f.append("ended")
    slides = []
    if how == "warlord":
        slides.append(f"Warlord {player.name} ruled the Pit for eleven years. The Red Teeth grew fat. "
                      "Dustwater paid its tithe in water and, in bad years, in children. When "
                      f"{player.name} finally died, it was in bed, of old age, which in the wasteland "
                      "is the rarest and least deserved death of all.")
    elif how == "shelter":
        slides.append(f"{player.name} went back into Shelter 41 and the door closed. Inside, it was "
                      "warm, and safe, and the water was clean. Every spring the Overseer still read out "
                      f"a name at assembly. {player.name} never said a word against it.")
    elif player.karma >= 4:
        slides.append(f"{player.name} put the gun down in Dustwater. It didn't stay down - the "
                      "wasteland never lets it - but when people told the story, they told it as a "
                      "story about a person, not a monster. Out here, that's sainthood.")
    elif player.karma <= -3:
        slides.append(f"{player.name} drifted, after. Towns closed their gates when they saw "
                      f"{player.name} coming. Nobody ever found the body, and nobody looked.")
    else:
        slides.append(f"{player.name} collected the bounty and drifted east, one more scarred face on "
                      "one more broken road. The wasteland didn't get better. It got a little less worse.")

    if "dustwater_annexed" in f:
        slides.append("Dustwater became a Covenant town. A third of its water and every able body over "
                      "fourteen went north to Rivet. The sick were inspected, then burned. Doc Halloran "
                      "was the first.")
    elif how == "warlord":
        pass
    elif "dustwater_purifier" in f:
        slides.append("Dustwater's purifier ran clean for thirty years. The town grew. It built a "
                      "school in the old bar. It never built a wall high enough, but it built one.")
    elif "sold_out" in f:
        slides.append("Brennan came back to Dustwater four more times, always knowing where to go. "
                      "The town never learned who drew him the map.")
    elif "kessler_dead" in f:
        slides.append("Without the Red Teeth, Dustwater survived. The purifier kept wheezing. People "
                      "kept dying of the water, slowly, the way they always had.")
    else:
        slides.append("The Red Teeth came for Dustwater again that winter, and the winter after that.")

    if "covenant_exposed" in f:
        slides.append("Rivet tore down the Covenant's stakes and used the wood to build a clinic. It "
                      "didn't last - the next prophet came within five years - but for five years, "
                      "nobody burned.")
    elif "vance_blackmailed" in f:
        slides.append("Prior Vance paid you, and kept paying the Harvesters. He lived to ninety on "
                      "borrowed organs. Your 300 caps lasted about a month.")
    else:
        slides.append("The Iron Covenant spread south, river town by river town, burning the tainted. "
                      "They called it medicine.")

    if "covenant_purifier" in f:
        slides.append("The Covenant used the purification module to water three new garrisons. "
                      "Shelter 41 never got it.")
    if "shelter_saved" in f:
        slides.append("Shelter 41 survived on the module from the crater. The next year, the Overseer "
                      "exiled two people at assembly. The year after that, three.")
    else:
        slides.append("Shelter 41's water chip failed for good that autumn. When scavengers finally cut "
                      "the door open, years later, the Overseer was sitting at his desk, the assembly "
                      "list still in his hand.")

    if "surgeon_dead" in f:
        slides.append("St. Agnes stood empty after the Surgeon died. "
                      + ("June, the woman you carried out, lived to see her grandchildren. She never "
                         "told them how she lost her legs." if "ward_saved" in f else
                         "The beds are still there. So is what's left in them."))
    else:
        slides.append("The Harvesters of St. Agnes kept working. Business was good. Everyone is "
                      "redeemed in service.")

    for cid, comp in COMPANIONS.items():
        if comp["unlock"] in f:
            slides.append(companion_slide(cid, f))

    if "jory_freed" in f:
        slides.append("Jory, the man from the stocks, made it to the coast. The tumours killed him two "
                      "years later, in a bed, with the sea outside the window.")
    elif "jory_burned" in f:
        slides.append("They burned Jory at dawn. His brother got his water ration.")
    if "hollis_family" in f:
        slides.append("The Hollis farm kept its sign up: TRAVELLERS WELCOME. You were family. You came "
                      "back for dinner more than once.")

    say("\n" + "=" * 60)
    say("EPILOGUE")
    for s in slides:
        say("")
        say(s)
    say(f"\n{player.name} - Level {player.level} {player.karma_title()} - {player.turns} turns, "
        f"{player.kills} kills.")
    say("=" * 60)
    memorialize(f"[ENDED] {player.name} - Lv {player.level} {player.karma_title()} - {how} - "
                f"{player.turns} turns, {player.kills} kills")


# ================================================================ main


HELP = """Commands:
  n s e w           move (up / down / out inside buildings)
  map (m)           your map            look (l)     look around
  enter             go inside           search       scavenge this spot
  inv (i)           inventory           use <item>   eat, drink, equip, heal
  stats (c)         your condition      repair       patch gear with scrap
  drink             drink from a river (rads!)
  talk / shop / rest / gamble           in towns
  board             Dustwater's bounty board
  hack / crack      break into terminals and safes
  party             your companion      dismiss      send them back to Dustwater
  quit              save and stop
Food and water drop as you travel. There is no load. When you die, you stay dead."""


def title():
    say("""
  ====================================================
              A  S  H  L  A  N  D  S
  ====================================================
  Contains graphic violence, cannibalism, slavery,
  suicide, drug addiction and strong language.
  Permadeath: one life, no reloads.""")
    memorial = (store_read(MEMORIAL_NAME) or "").splitlines()[-6:]
    if memorial:
        say("\n  -- The Memorial Wall --")
        for line in memorial:
            say("  " + line)


async def new_game():
    name = (await ask("\nWhat's your name, shelter dweller? > ", raw=True)).title()[:20] or "Dweller"
    say("\nWho were you, before?")
    for n, (label, s, _, _) in enumerate(ARCHETYPES, 1):
        say(f"  {n}. {label:<14} " + "  ".join(f"{k} {v}" for k, v in s.items()))
    say(f"  {len(ARCHETYPES) + 1}. Custom - spend the points yourself")
    while True:
        pick = await ask("Choose > ")
        if pick.isdigit() and 1 <= int(pick) <= len(ARCHETYPES) + 1:
            pick = int(pick)
            break
    kit_note = None
    if pick <= len(ARCHETYPES):
        _, stats, kit, kit_note = ARCHETYPES[pick - 1]
        player = Player(name, stats)
        for item_id in kit:
            player.give(item_id, quiet=True)
        weapons = [i for i in kit if ITEMS[i]["kind"] == "weapon"]
        if weapons:
            player.inventory.remove(weapons[0])
            player.inventory.append(player.weapon)
            player.weapon = weapons[0]
    else:
        player = Player(name, {s: 3 for s in STATS})
        player.stat_points = 8
        await spend_points(player)
        player.hp = player.cap_hp
    say(f"\nShelter 41, year 2161. The water chip is dying and the rations get shorter every month. "
        f"This morning, at assembly, the Overseer read out your name. \"{name}. The shelter thanks you "
        f"for your sacrifice.\" Your mother didn't look up. Neither did anyone else.")
    say("\nThey gave you a jumpsuit, a pipe wrench, a stimpak, a can of beans, a bottle of water that "
        "isn't clean, and fifteen caps. Then the door opened onto the world your grandparents burned, "
        "and closed behind you.")
    if kit_note:
        say(kit_note)
    say("\nType 'help' for commands and 'map' to see where you are.")
    return player


async def play(player):
    describe(player)
    if player.pending_fight:
        await fight(player, player.pending_fight["id"], player.pending_fight["hp"])

    while player.hp > 0 and "ended" not in player.flags:
        if player.stat_points:
            await spend_points(player)
        if player.perk_points:
            await choose_perk(player)
        save_game(player)
        raw = await ask("\n> ", keys=context_keys(player))
        verb, _, arg = raw.partition(" ")
        verb = ALIASES.get(verb, verb)
        if verb == "go":
            verb = ALIASES.get(arg, arg)

        if verb in DIRS or verb in ("up", "down", "out", "leave", "exit"):
            if player.room:
                await dungeon_move(player, verb)
            elif verb in DIRS:
                await overworld_move(player, verb)
            else:
                say("You're already outside. There is no inside any more.")
        elif verb in ("look", "l"):
            describe(player)
        elif verb in ("map", "m"):
            if player.room:
                say("No map down here. Just the dark.")
            else:
                show_map(player)
        elif verb == "enter":
            await enter(player)
        elif verb == "search":
            await search(player)
        elif verb in ("inv", "i", "inventory"):
            show_inventory(player)
        elif verb in ("use", "equip", "eat", "drink", "wear") and arg:
            use_item(player, arg)
        elif verb == "drink":
            drink(player)
        elif verb in ("stats", "status", "c"):
            player.status()
        elif verb == "repair":
            field_repair(player)
        elif verb == "shop":
            await shop(player)
        elif verb == "talk":
            await talk(player)
        elif verb == "rest":
            rest(player)
        elif verb == "gamble":
            await gamble(player)
        elif verb in ("board", "bounty"):
            await bounty_board(player)
        elif verb == "hack":
            await hack_here(player)
        elif verb in ("crack", "safe"):
            await crack_safe(player)
        elif verb == "perks":
            say(", ".join(f"{PERKS[p][0]} ({PERKS[p][1]})" for p in player.perks) or "No perks yet.")
        elif verb == "party":
            if player.companion:
                c = COMPANIONS[player.companion]
                say(f"{c['name']} {bar(player.comp_hp[player.companion], c['hp'])}")
            else:
                say("You're alone.")
        elif verb == "dismiss":
            if player.companion:
                say(f"{COMPANIONS[player.companion]['name']} heads back to Dustwater to wait for you.")
                player.companion = None
            else:
                say("There's nobody to dismiss.")
        elif verb in ("help", "h", "?"):
            say(HELP)
        elif verb in ("quit", "q"):
            save_game(player)
            say("You find a corner to hole up in. (Progress saved.)")
            return
        elif verb == "load":
            say("There's no going back.")
        elif verb:
            say("Unknown command. Type 'help'.")

        if town_here(player) == "rivet" and "rivet_visited" not in player.flags:
            player.flags.append("rivet_visited")

    if player.hp <= 0:
        die(player)


async def main():
    title()
    player = load_game()
    if player:
        say(f"\n{player.name} is still out there. (Level {player.level}, {player.hp} HP, "
            f"{place_name(player)})")
        if await ask("Continue? (y = continue / abandon = let them die) > ") == "abandon":
            player.killer = "despair"
            die(player)
            player = None
    if player is None:
        player = await new_game()
    await play(player)


async def browser_main():
    """In the browser there's no process to exit: after a death or an ending, start a new life."""
    while True:
        await main()
        await ask("\n[Press Enter to begin again]")


if __name__ == "__main__" and not BROWSER:
    try:
        asyncio.run(main())
    except Quit:
        pass
