#!/usr/bin/env python3
"""ASHLANDS - a post-apocalyptic text RPG with permadeath. Run: python3 rpg/game.py

Contains violence, drug use, slavery and strong language.
"""

import json
import os
import random
import sys
import textwrap
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SAVE_FILE = os.path.join(HERE, "save.json")
MEMORIAL_FILE = os.path.join(HERE, "memorial.txt")

# ---------------------------------------------------------------- data

ITEMS = {
    # consumables
    "stimpak":      {"name": "Stimpak", "kind": "heal", "power": 30, "price": 25,
                     "desc": "Jab it in your thigh. Restores 30 HP."},
    "super_stim":   {"name": "Super Stim", "kind": "heal", "power": 70, "price": 60,
                     "desc": "Military grade. Restores 70 HP."},
    "beans":        {"name": "Irradiated Beans", "kind": "food", "power": 10, "price": 5,
                     "desc": "Restores 10 HP. +5 rads. Tastes like pennies."},
    "radaway":      {"name": "RadAway", "kind": "radaway", "power": 60, "price": 30,
                     "desc": "Flushes 60 rads. You'll piss orange for a week."},
    "rush":         {"name": "Rush", "kind": "chem", "power": 6, "price": 20,
                     "desc": "+6 attack for your next fight. Highly addictive."},
    "grenade":      {"name": "Pipe Grenade", "kind": "grenade", "power": 35, "price": 30,
                     "desc": "Deals 35 damage. Mind your fingers."},
    # weapons
    "pipe_wrench":  {"name": "Pipe Wrench", "kind": "weapon", "power": 2, "price": 4,
                     "desc": "Standard issue for shelter maintenance. +2 attack."},
    "machete":      {"name": "Machete", "kind": "weapon", "power": 4, "price": 20,
                     "desc": "Notched and stained. +4 attack."},
    "pistol":       {"name": "10mm Pistol", "kind": "weapon", "power": 6, "price": 60,
                     "desc": "Jams sometimes. +6 attack."},
    "shotgun":      {"name": "Sawn-off Shotgun", "kind": "weapon", "power": 9, "price": 110,
                     "desc": "Ends arguments. +9 attack."},
    "plasma":       {"name": "Prototype Plasma Rifle", "kind": "weapon", "power": 14, "price": 0,
                     "desc": "Pre-war military prototype. Melts things. +14 attack."},
    # armor
    "shelter_suit": {"name": "Shelter 41 Jumpsuit", "kind": "armor", "power": 1, "price": 2,
                     "desc": "Blue and yellow. Screams 'rob me'. +1 defense."},
    "leathers":     {"name": "Road Leathers", "kind": "armor", "power": 3, "price": 40,
                     "desc": "Stitched from who-knows-what. +3 defense."},
    "raider_armor": {"name": "Spiked Raider Armor", "kind": "armor", "power": 4, "price": 30,
                     "desc": "Still smells like its last owner. +4 defense."},
    "combat_armor": {"name": "Patched Combat Armor", "kind": "armor", "power": 6, "price": 140,
                     "desc": "Pre-war plates, duct-taped. +6 defense."},
    # misc
    "gate_pass":    {"name": "Red Teeth Gate Pass", "kind": "key", "power": 0, "price": 0,
                     "desc": "A dog tag stamped with a bloody grin. Gets you into the Pit."},
    "watch":        {"name": "Pre-war Watch", "kind": "junk", "power": 0, "price": 30,
                     "desc": "Stopped at 9:47. Traders love these."},
    "scrap":        {"name": "Scrap Metal", "kind": "junk", "power": 0, "price": 8,
                     "desc": "Worth something to someone."},
}

ENEMIES = {
    "rat":      {"name": "Bloat Rat", "hp": 14, "atk": 5, "def": 0, "xp": 6, "caps": (0, 3)},
    "dog":      {"name": "Feral Dog", "hp": 20, "atk": 7, "def": 1, "xp": 10, "caps": (0, 2)},
    "raider":   {"name": "Red Teeth Raider", "hp": 30, "atk": 9, "def": 2, "xp": 18, "caps": (6, 15),
                 "drops": ["rush", "raider_armor", "stimpak"]},
    "husk":     {"name": "Husk", "hp": 26, "atk": 9, "def": 1, "xp": 15, "caps": (0, 5), "rads": 6,
                 "drops": ["watch"]},
    "slaver":   {"name": "Slaver", "hp": 34, "atk": 10, "def": 3, "xp": 20, "caps": (10, 20),
                 "drops": ["stimpak", "pistol"]},
    "stinger":  {"name": "Stingback", "hp": 45, "atk": 13, "def": 5, "xp": 30, "caps": (0, 0), "rads": 4},
    "brute":    {"name": "Ash Brute", "hp": 60, "atk": 15, "def": 4, "xp": 45, "caps": (5, 15), "rads": 8},
    "brennan":  {"name": "Brennan the Slaver", "hp": 60, "atk": 12, "def": 4, "xp": 50, "caps": (80, 80),
                 "boss": True},
    "kessler":  {"name": "Warlord Kessler", "hp": 170, "atk": 20, "def": 6, "xp": 250, "caps": (200, 200),
                 "boss": True, "special": "Kessler rakes you with a chainsaw!"},
}

ROOMS = {
    "shelter": {
        "name": "Shelter 41 - Exit Tunnel",
        "desc": "The great steel door grinds shut behind you. Ahead, a tunnel slopes up toward "
                "light you have never seen. The air tastes like rust.",
        "exits": {"east": "crossroads"},
    },
    "crossroads": {
        "name": "The Crossroads",
        "desc": "A collapsed overpass casts long shadows over a cracked intersection. "
                "Someone has spray-painted 'DUSTWATER ->' on a bus wreck pointing north. "
                "A skeleton in a business suit sits at the bus stop, still waiting.",
        "exits": {"north": "dustwater", "east": "highway", "south": "suburbs"},
        "enemies": ["rat", "dog"],
        "loot": ["scrap", "beans"],
        "rads": 2,
    },
    "dustwater": {
        "name": "Dustwater",
        "desc": "A shanty town built in the bowl of a dried-up reservoir. Sheet-metal shacks, "
                "a water purifier that wheezes like a dying man, and a bar called The Last Drop. "
                "Vee's trading post leans against the dam wall. Sheriff Okafor watches the gate. "
                "Doc Halloran's clinic has a hand-painted sign: NO CHEMS ON CREDIT.",
        "exits": {"south": "crossroads"},
        "shop": ["stimpak", "super_stim", "beans", "radaway", "rush", "grenade",
                 "machete", "pistol", "shotgun", "leathers", "combat_armor"],
        "npcs": ["okafor", "vee", "doc"],
        "safe": True,
    },
    "highway": {
        "name": "Highway 9",
        "desc": "Rusted cars sit bumper to bumper, frozen in the evacuation that never finished. "
                "Most still have passengers. To the north the ground glows faintly green. "
                "East, smoke rises from the old stadium.",
        "exits": {"west": "crossroads", "north": "crater", "east": "pit_gate"},
        "enemies": ["raider", "dog", "raider"],
        "loot": ["stimpak", "watch"],
        "event": "caravan",
        "rads": 3,
    },
    "suburbs": {
        "name": "Scorched Suburbs",
        "desc": "Rows of identical houses, all burned to their frames. A child's swing creaks "
                "in a dead yard. Shapes shuffle behind the windows - husks, people the radiation "
                "chewed up and didn't finish. Eastward you hear chains rattle.",
        "exits": {"north": "crossroads", "east": "slaver_camp"},
        "enemies": ["husk", "husk", "rat"],
        "loot": ["super_stim", "scrap"],
        "rads": 6,
    },
    "slaver_camp": {
        "name": "Slaver Camp",
        "desc": "A fenced lot behind a gutted gas station. Cages made from shopping carts and "
                "rebar. The people inside don't look up anymore.",
        "exits": {"west": "suburbs"},
        "event": "slavers",
    },
    "crater": {
        "name": "The Glow Crater",
        "desc": "Where the bomb hit. Glass-smooth ground glows a sick green. Your teeth ache. "
                "In the centre lies a crashed military transport, its cargo bay split open.",
        "exits": {"south": "highway"},
        "enemies": ["stinger", "husk"],
        "loot": ["plasma", "radaway"],
        "event": "crater_guard",
        "rads": 30,
    },
    "pit_gate": {
        "name": "The Pit - Outer Gate",
        "desc": "The old stadium, walled with car hulks and razor wire. Bodies hang from the "
                "gate, some fresh. A sign made of human teeth reads: THE PIT. "
                "Two raiders lean on the gate, laughing about something you'd rather not know.",
        "exits": {"west": "highway", "east": "pit"},
        "enemies": ["raider"],
        "locked": {"east": "gate_pass"},
        "rads": 2,
    },
    "pit": {
        "name": "The Pit",
        "desc": "The stadium floor is a fighting ring stained black. Spectators scatter as you "
                "enter. On a throne of welded shopping carts sits Warlord Kessler, a giant of a "
                "man in a bloodied hockey mask, revving a chainsaw.",
        "exits": {"west": "pit_gate"},
        "boss": "kessler",
        "loot": ["combat_armor", "super_stim"],
    },
}

# ---------------------------------------------------------------- io


def say(text=""):
    for para in str(text).split("\n"):
        print(textwrap.fill(para, 88) if len(para) > 88 else para)


def ask(prompt="> "):
    try:
        return input(prompt).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\nYou close your eyes for a moment. (Progress is saved.)")
        sys.exit(0)


def choose(options):
    """Show numbered options and return the 1-based index picked."""
    for n, text in enumerate(options, 1):
        say(f"  {n}. {text}")
    while True:
        pick = ask("Choose > ")
        if pick.isdigit() and 1 <= int(pick) <= len(options):
            return int(pick)


def bar(cur, mx, width=20):
    mx = max(mx, 1)
    filled = int(width * max(cur, 0) / mx)
    return "[" + "#" * filled + "-" * (width - filled) + f"] {max(cur, 0)}/{mx}"


def find_item(query, pool):
    q = query.replace(" ", "_")
    for item_id in pool:
        if q == item_id or query == ITEMS[item_id]["name"].lower():
            return item_id
    for item_id in pool:
        if query and query in ITEMS[item_id]["name"].lower():
            return item_id
    return None


# ---------------------------------------------------------------- player


class Player:
    def __init__(self, name):
        self.name = name
        self.level = 1
        self.xp = 0
        self.max_hp = 40
        self.hp = 40
        self.base_atk = 6
        self.base_def = 1
        self.caps = 20
        self.inventory = ["stimpak", "stimpak", "beans"]
        self.weapon = "pipe_wrench"
        self.armor = "shelter_suit"
        self.room = "shelter"
        self.looted = []
        self.flags = []
        self.karma = 0
        self.rads = 0
        self.addicted = False
        self.high = False
        self.turns = 0
        self.kills = 0
        self.killer = None
        self.pending_fight = None   # {"id": enemy_id, "hp": n} while a fight is in progress

    # stats -------------------------------------------------------
    @property
    def cap_hp(self):
        """Max HP after radiation damage."""
        return self.max_hp - self.rads // 10

    @property
    def atk(self):
        a = self.base_atk + ITEMS[self.weapon]["power"]
        if self.high:
            a += ITEMS["rush"]["power"]
        elif self.addicted:
            a -= 3
        return a

    @property
    def defense(self):
        return self.base_def + ITEMS[self.armor]["power"]

    def karma_title(self):
        if self.karma >= 4:
            return "Saint of the Wastes"
        if self.karma >= 1:
            return "Good Samaritan"
        if self.karma <= -4:
            return "Wasteland Butcher"
        if self.karma <= -1:
            return "Scumbag"
        return "Drifter"

    def xp_needed(self):
        return 25 * self.level

    # changes -----------------------------------------------------
    def gain_xp(self, amount):
        self.xp += amount
        while self.xp >= self.xp_needed():
            self.xp -= self.xp_needed()
            self.level += 1
            self.max_hp += 10
            self.base_atk += 2
            self.base_def += 1
            self.hp = self.cap_hp
            say(f"*** LEVEL UP! Level {self.level}. You feel harder to kill. ***")

    def add_rads(self, n, source="radiation sickness"):
        if n <= 0:
            return
        self.rads += n
        say(f"Your rad counter clicks. +{n} rads ({self.rads} total).")
        if self.rads >= 200 and self.rads - n < 200:
            say("Your gums are bleeding. Your max HP is dropping. Find RadAway or a doctor.")
        self.hp = min(self.hp, self.cap_hp)
        if self.cap_hp <= 0:
            self.hp = 0
            self.killer = source

    def heal(self, n):
        healed = min(n, self.cap_hp - self.hp)
        self.hp += healed
        return healed

    def karma_shift(self, n):
        self.karma += n
        if n > 0:
            say("(Karma +%d)" % n)
        elif n < 0:
            say("(Karma %d)" % n)

    def status(self):
        say(f"{self.name}  Lv {self.level}  XP {self.xp}/{self.xp_needed()}  Caps {self.caps}  "
            f"Karma: {self.karma_title()}")
        say(f"HP {bar(self.hp, self.cap_hp)}   Rads {self.rads}"
            + (f" (max HP -{self.rads // 10})" if self.rads >= 10 else ""))
        say(f"ATK {self.atk}  DEF {self.defense}  Weapon: {ITEMS[self.weapon]['name']}  "
            f"Armor: {ITEMS[self.armor]['name']}")
        if self.addicted:
            say("You are addicted to Rush." + (" You're high right now." if self.high
                                               else " Withdrawal: -3 attack."))
        elif self.high:
            say("You're high on Rush.")

    def to_dict(self):
        return dict(self.__dict__)

    @classmethod
    def from_dict(cls, data):
        p = cls(data["name"])
        p.__dict__.update(data)
        return p


# ---------------------------------------------------------------- save / permadeath


def save_game(player):
    with open(SAVE_FILE, "w") as f:
        json.dump(player.to_dict(), f)


def load_game():
    with open(SAVE_FILE) as f:
        return Player.from_dict(json.load(f))


def memorialize(player, line):
    with open(MEMORIAL_FILE, "a") as f:
        f.write(line + "\n")
    if os.path.exists(SAVE_FILE):
        os.remove(SAVE_FILE)


def die(player):
    room = ROOMS[player.room]["name"]
    killer = player.killer or "the wasteland"
    say("\n" + "=" * 60)
    say("You hit the dirt. The sky goes grey, then black.")
    say(f"\n  HERE LIES {player.name.upper()}")
    say(f"  Level {player.level} {player.karma_title()}")
    say(f"  Killed by {killer} at {room}")
    say(f"  Survived {player.turns} turns, {player.kills} kills, {player.caps} caps in pocket")
    say("\nThe wasteland doesn't remember. Your save has been deleted.")
    say("=" * 60)
    memorialize(player, f"[DEAD] {player.name} - Lv {player.level} {player.karma_title()} - "
                        f"killed by {killer} at {room} - {player.turns} turns, {player.kills} kills")


# ---------------------------------------------------------------- combat


def fight(player, enemy_id, enemy_hp=None):
    e = ENEMIES[enemy_id]
    hp = e["hp"] if enemy_hp is None else enemy_hp
    if enemy_hp is None:
        say(f"\n!!! {e['name']} attacks! !!!")
    else:
        say(f"\n!!! You're still fighting the {e['name']}! !!!")

    while hp > 0:
        player.pending_fight = {"id": enemy_id, "hp": hp}
        save_game(player)   # no escaping a fight by killing the game
        say(f"\n{e['name']:<20} {bar(hp, e['hp'])}")
        say(f"{player.name:<20} {bar(player.hp, player.cap_hp)}")
        cmd = ask("(a)ttack  (d)efend  (i)tem  (r)un > ")
        defending = False

        if cmd in ("a", "attack"):
            if player.weapon == "pistol" and random.random() < 0.08:
                say("Your pistol jams! You fumble with the slide.")
            else:
                dmg = max(1, player.atk + random.randint(-2, 2) - e["def"])
                if random.random() < 0.1:
                    dmg *= 2
                    say("Critical hit!")
                hp -= dmg
                say(f"You hit the {e['name']} for {dmg}.")
        elif cmd in ("d", "defend"):
            defending = True
            say("You brace yourself.")
        elif cmd in ("i", "item"):
            usable = list(dict.fromkeys(
                i for i in player.inventory if ITEMS[i]["kind"] in ("heal", "food", "grenade", "chem")))
            if not usable:
                say("Your pockets are full of nothing useful.")
                continue
            for n, item_id in enumerate(usable, 1):
                say(f"  {n}. {ITEMS[item_id]['name']} x{player.inventory.count(item_id)}")
            pick = ask("Use which? > ")
            if not pick.isdigit() or not 1 <= int(pick) <= len(usable):
                continue
            item_id = usable[int(pick) - 1]
            if ITEMS[item_id]["kind"] == "grenade":
                player.inventory.remove(item_id)
                hp -= ITEMS[item_id]["power"]
                say(f"BOOM! The grenade tears into the {e['name']} for {ITEMS[item_id]['power']}.")
            else:
                consume(player, item_id)
        elif cmd in ("r", "run"):
            if e.get("boss"):
                say("There's nowhere to run.")
            elif random.random() < 0.5:
                say("You scramble away!")
                player.pending_fight = None
                player.high = False
                return "fled"
            else:
                say("You trip over debris. No escape!")
        else:
            say("You freeze up...")

        if hp <= 0:
            break

        # enemy turn
        if e.get("special") and random.random() < 0.25:
            dmg = max(1, e["atk"] + 7 - player.defense)
            say(e["special"])
        else:
            dmg = max(1, e["atk"] + random.randint(-2, 2) - player.defense)
        if defending:
            dmg //= 2
        player.hp -= dmg
        say(f"The {e['name']} hits you for {dmg}.")
        if e.get("rads") and dmg > 0:
            player.add_rads(e["rads"], source=f"radiation from a {e['name']}")
        if player.hp <= 0:
            player.killer = player.killer or (e["name"] if e.get("boss") else f"a {e['name']}")
            player.pending_fight = None
            return "dead"

    player.pending_fight = None
    player.high = False
    player.kills += 1
    caps = random.randint(*e["caps"])
    player.caps += caps
    say(f"\nThe {e['name']} goes down and stays down. +{e['xp']} XP, +{caps} caps.")
    if e.get("drops") and random.random() < 0.35:
        drop = random.choice(e["drops"])
        player.inventory.append(drop)
        say(f"You loot a {ITEMS[drop]['name']} from the body.")
    player.gain_xp(e["xp"])
    return "won"


def consume(player, item_id):
    item = ITEMS[item_id]
    kind = item["kind"]
    if kind not in ("heal", "food", "radaway", "chem"):
        return False
    player.inventory.remove(item_id)
    if kind in ("heal", "food"):
        say(f"You use the {item['name']} and recover {player.heal(item['power'])} HP.")
        if kind == "food":
            player.add_rads(5, source="bad beans")
    elif kind == "radaway":
        removed = min(player.rads, item["power"])
        player.rads -= removed
        say(f"The RadAway burns going in. -{removed} rads.")
    elif kind == "chem":
        player.high = True
        say("You snort the Rush. Your heart slams. Everything moves slower except you.")
        if not player.addicted and random.random() < 0.3:
            player.addicted = True
            say("...and you already want more. You're addicted to Rush.")
    return True


# ---------------------------------------------------------------- events


def event_caravan(player):
    say("\nUnder an overturned cart lies a caravan guard, gut-shot, breathing in wet clicks. "
        "His pack ox lies dead beside him, belly opened by raiders. \"Hey... hey. "
        "You got a stim? Please. I got a daughter in Dustwater.\"")
    has_stim = "stimpak" in player.inventory
    pick = choose([
        "Give him a Stimpak" + ("" if has_stim else " (you don't have one)"),
        "End his suffering quickly",
        "Take his pack while he watches",
        "Walk away",
    ])
    if pick == 1 and has_stim:
        player.inventory.remove("stimpak")
        say("You jab the stim into him. Colour creeps back into his face. \"Name's Tomas. "
            "I owe you.\" He presses 40 caps into your hand. \"The Red Teeth buy slaves off a "
            "creep called Brennan, east of the suburbs. Brennan carries a pass into the Pit.\"")
        player.caps += 40
        player.karma_shift(2)
        player.flags.append("saved_tomas")
    elif pick == 1:
        say("You pat your empty pockets. He laughs, which turns into coughing, which turns "
            "into nothing at all.")
    elif pick == 2:
        say("You kneel beside him. He nods once, and closes his eyes. When it's done, you take "
            "his pistol. He won't need it.")
        player.inventory.append("pistol")
    elif pick == 3:
        say("\"You son of a bitch...\" he wheezes as you pull the pack from under him. "
            "Inside: a 10mm pistol and 60 caps. His curses follow you down the highway, "
            "then stop.")
        player.inventory.append("pistol")
        player.caps += 60
        player.karma_shift(-2)
        player.flags.append("robbed_tomas")
    else:
        say("You step around him. Out here, everyone dies eventually.")
    return True


def event_slavers(player):
    say("\nA lean man in a pre-war suit vest steps out of the gas station, shotgun resting on "
        "his shoulder. \"Name's Brennan. Welcome to my little enterprise.\" Behind him, three "
        "captives in cages: an old man, a woman with a split lip, and a kid who can't be "
        "older than twelve. \"Shopping, or looking for work?\"")
    pick = choose([
        "\"Let them go.\" (Fight Brennan and his crew)",
        f"Buy their freedom (200 caps - you have {player.caps})",
        "\"What kind of work?\"",
        "Leave",
    ])
    if pick == 1:
        say("Brennan sighs. \"Always a hero.\" He whistles, and a slaver steps out from behind "
            "the pumps.")
        result = fight(player, "slaver")
        if result == "dead":
            return True
        if result == "fled":
            say("You flee. Brennan's laughter follows you.")
            return False
        result = fight(player, "brennan")
        if result != "won":
            return True
        say("\nBrennan coughs blood into his nice vest. You take his keys and a dog tag "
            "stamped with a bloody grin - a Red Teeth gate pass.")
        free_captives(player)
        player.inventory.append("gate_pass")
        player.karma_shift(2)
    elif pick == 2:
        if player.caps < 200:
            say("Brennan looks at your caps and laughs. \"Come back when you're serious.\"")
            return False
        player.caps -= 200
        say("Brennan counts the caps twice and tosses you the keys. \"Pleasure.\"")
        free_captives(player)
        say("As you leave, the woman with the split lip presses something into your hand. "
            "\"Took it off one of those Red Teeth bastards when they came to buy.\" "
            "It's a gate pass to the Pit.")
        player.inventory.append("gate_pass")
        player.karma_shift(2)
    elif pick == 3:
        say("\"Dustwater's got a lot of kids and not a lot of guns. You walk in, tell me which "
            "shacks are easy, which ones sleep sound. I pay 150 caps. And I'll throw in a pass "
            "to the Pit - Kessler's my best customer.\"")
        if choose(["Take the deal", "Refuse and leave"]) == 1:
            say("You draw him a map in the dirt. He pays in full. The kid in the cage watches "
                "you the whole time.")
            player.caps += 150
            player.inventory.append("gate_pass")
            player.karma_shift(-4)
            player.flags.append("sold_out_dustwater")
        else:
            say("\"Shame. Offer stands.\"")
            return False
    else:
        say("You turn away from the cages.")
        return False
    return True


def free_captives(player):
    say("You open the cages. The old man weeps. The kid won't let go of your sleeve until "
        "the woman pulls him away. They head for Dustwater. The old man presses two "
        "stimpaks on you. \"It's all we have.\"")
    player.inventory += ["stimpak", "stimpak"]
    player.flags.append("freed_captives")


def event_crater_guard(player):
    say("\nSomething huge rises from behind the transport - a man once, maybe, now two metres "
        "of scar tissue and tumours, dragging a lamppost like a club.")
    return fight(player, "brute") == "won"


EVENTS = {
    "caravan": event_caravan,
    "slavers": event_slavers,
    "crater_guard": event_crater_guard,
}


def run_event(player, event_id):
    """Events run on entering a room, until they resolve."""
    if event_id in player.flags:
        return
    if EVENTS[event_id](player) and player.hp > 0:
        player.flags.append(event_id)


# ---------------------------------------------------------------- npcs


def talk_okafor(player):
    if "kessler_dead" in player.flags:
        if "okafor_paid" not in player.flags:
            say("Okafor looks at Kessler's mask hanging from your belt and lets out a long breath. "
                "\"I didn't think anyone could. Town's bounty.\" He hands you 150 caps.")
            player.caps += 150
            player.flags.append("okafor_paid")
        else:
            say("Okafor: \"Drinks are on me. Well. On Vee.\"")
    elif "sold_out_dustwater" in player.flags:
        say("Okafor: \"Something's wrong. Brennan's boys hit the east shacks last night. Knew "
            "exactly where to go. Three kids gone.\" He stares at you a little too long.")
    else:
        say("Sheriff Okafor, a heavyset man with a hunting rifle and tired eyes: \"The Red Teeth "
            "raid us every month. Take water, take people. Their boss, Kessler, runs the Pit "
            "out east past Highway 9. Walls are tight - you'd need one of their gate passes. "
            "Kill Kessler and this town will owe you 150 caps.\"")


def talk_vee(player):
    lines = [
        "Vee, chewing something: \"Buying or crying? Type 'shop', sweetheart.\"",
        "Vee: \"Rush'll make you a god for five minutes and a wreck for five years. "
        "I sell it anyway. Caps are caps.\"",
        "Vee: \"Glow Crater up north? Folks say there's a military wreck in it with real "
        "pre-war hardware. Folks also say their hair fell out.\"",
        "Vee: \"Husks in the suburbs used to be people. Don't let 'em scratch you.\"",
    ]
    if "freed_captives" in player.flags:
        lines.append("Vee: \"Heard you freed Brennan's stock. That kid's been telling everyone. "
                     "Don't let it go to your head.\"")
    say(random.choice(lines))


def talk_doc(player):
    say("Doc Halloran wipes his hands on a stained apron. \"What's broken?\"")
    pick = choose([
        f"Flush my rads (60 caps) - you have {player.rads} rads",
        "Cure my addiction (40 caps)" + ("" if player.addicted else " - you're clean"),
        "Patch me up (15 caps)",
        "Never mind",
    ])
    costs = {1: 60, 2: 40, 3: 15}
    if pick == 4:
        return
    if pick == 2 and not player.addicted:
        say("\"You're clean. Stay that way.\"")
        return
    if player.caps < costs[pick]:
        say("\"Like the sign says. No credit.\"")
        return
    player.caps -= costs[pick]
    if pick == 1:
        player.rads = 0
        say("A night hooked to a drip. You wake up feeling almost human.")
    elif pick == 2:
        player.addicted = False
        say("Three days of sweating and screaming in the back room. You come out clean.")
    else:
        player.hp = player.cap_hp
        say("He stitches you up without anaesthetic. HP restored.")


NPCS = {
    "okafor": ("Sheriff Okafor", talk_okafor),
    "vee": ("Vee the trader", talk_vee),
    "doc": ("Doc Halloran", talk_doc),
}


# ---------------------------------------------------------------- actions


def describe(player):
    room = ROOMS[player.room]
    say(f"\n== {room['name']} ==")
    say(room["desc"])
    say("Exits: " + ", ".join(room["exits"]))
    if room.get("shop"):
        say("You can trade here. (shop)")
    if room.get("npcs"):
        say("People here: " + ", ".join(NPCS[n][0] for n in room["npcs"]) + ". (talk)")
    if room.get("safe"):
        say("You can rent a cot at the bar. (rest, 10 caps)")


def move(player, direction):
    room = ROOMS[player.room]
    aliases = {"n": "north", "s": "south", "e": "east", "w": "west"}
    direction = aliases.get(direction, direction)
    if direction not in room["exits"]:
        say("You can't go that way.")
        return
    needed = room.get("locked", {}).get(direction)
    if needed and needed not in player.inventory:
        say("The raiders on the gate level their rifles. \"No pass, no entry. Keep walking, "
            "meat.\"")
        return
    if needed:
        say("You flash the gate pass. A raider grins and hauls the gate open. \"Enjoy the show.\"")

    player.room = room["exits"][direction]
    new_room = ROOMS[player.room]
    describe(player)
    player.add_rads(new_room.get("rads", 0) + random.randint(0, 2) * bool(new_room.get("rads")),
                    source=f"radiation at {new_room['name']}")
    if player.hp <= 0:
        return

    if new_room.get("boss") and "kessler_dead" not in player.flags:
        if fight(player, new_room["boss"]) == "won":
            finale(player)
        return
    if new_room.get("event"):
        run_event(player, new_room["event"])
        if player.hp <= 0:
            return
    if new_room.get("enemies") and random.random() < 0.4:
        fight(player, random.choice(new_room["enemies"]))


def search(player):
    room = ROOMS[player.room]
    if room.get("boss") and "kessler_dead" not in player.flags:
        say("Not while Kessler's breathing.")
        return
    if player.room in player.looted or not room.get("loot"):
        say("Picked clean.")
        return
    if room.get("event") and room["event"] not in player.flags:
        say("You can't search with that going on.")
        return
    for item_id in room["loot"]:
        player.inventory.append(item_id)
        say(f"You found: {ITEMS[item_id]['name']}!")
    player.looted.append(player.room)
    if room.get("rads"):
        player.add_rads(room["rads"] // 2, source=f"radiation at {room['name']}")


def show_inventory(player):
    say(f"Caps: {player.caps}")
    if not player.inventory:
        say("Your pack is empty.")
        return
    for item_id in dict.fromkeys(player.inventory):
        item = ITEMS[item_id]
        say(f"  {item['name']} x{player.inventory.count(item_id)} - {item['desc']}")


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
        say(f"You equip the {item['name']}.")
    elif not consume(player, item_id):
        say("You can't use that here.")


def shop(player):
    room = ROOMS[player.room]
    if not room.get("shop"):
        say("Nobody here to trade with.")
        return
    while True:
        say(f"\n-- Vee's Trading Post -- (caps: {player.caps})")
        for n, item_id in enumerate(room["shop"], 1):
            item = ITEMS[item_id]
            say(f"  {n:>2}. {item['name']:<22} {item['price']:>4}c  {item['desc']}")
        say("   s. Sell   q. Leave")
        pick = ask("> ")
        if pick in ("q", "leave", ""):
            return
        if pick == "s":
            sellable = [i for i in dict.fromkeys(player.inventory) if ITEMS[i]["price"] > 0]
            if not sellable:
                say("Vee: \"Nothing I want.\"")
                continue
            for n, item_id in enumerate(sellable, 1):
                say(f"  {n}. {ITEMS[item_id]['name']} - {ITEMS[item_id]['price'] // 2}c")
            sell = ask("Sell which? > ")
            if sell.isdigit() and 1 <= int(sell) <= len(sellable):
                item_id = sellable[int(sell) - 1]
                player.inventory.remove(item_id)
                player.caps += ITEMS[item_id]["price"] // 2
                say(f"Sold {ITEMS[item_id]['name']}.")
            continue
        if pick.isdigit() and 1 <= int(pick) <= len(room["shop"]):
            item_id = room["shop"][int(pick) - 1]
            price = ITEMS[item_id]["price"]
            if player.caps < price:
                say("Vee: \"Caps first, sweetheart.\"")
            else:
                player.caps -= price
                player.inventory.append(item_id)
                say(f"Bought {ITEMS[item_id]['name']}.")


def talk(player):
    npcs = ROOMS[player.room].get("npcs", [])
    if not npcs:
        say("You mutter to yourself. The wasteland doesn't answer.")
        return
    pick = choose([NPCS[n][0] for n in npcs]) if len(npcs) > 1 else 1
    NPCS[npcs[pick - 1]][1](player)


def rest(player):
    if not ROOMS[player.room].get("safe"):
        say("Sleep out here and you won't wake up.")
        return
    if player.caps < 10:
        say("The bartender points at the door. \"Cots cost 10.\"")
        return
    player.caps -= 10
    player.hp = player.cap_hp
    say("You sleep on a cot behind The Last Drop, knife under your pillow. HP restored.")
    if player.addicted and not player.high:
        say("You dream of Rush all night.")


def finale(player):
    player.flags.append("kessler_dead")
    say("\nKessler crashes onto the stadium floor. The chainsaw sputters and dies. "
        "You pull off the hockey mask: just a bald, scared old man underneath.")
    say("\nThe surviving Red Teeth drop their weapons and stare at you. Somebody has to "
        "decide what happens to them.")
    pick = choose([
        "Line them up against the wall",
        "Tell them to scatter and never come back",
        "\"The Pit has a new warlord.\"",
    ])
    if pick == 1:
        say("It takes a long time. Nobody in Dustwater will ever ask you about it.")
        player.karma_shift(-1)
        player.flags.append("ending_executed")
    elif pick == 2:
        say("They run. Some will come back as raiders somewhere else. Some won't.")
        player.karma_shift(1)
        player.flags.append("ending_mercy")
    else:
        say("A raider kneels. Then another. By nightfall they're chanting your name.")
        player.karma_shift(-3)
        player.flags.append("ending_warlord")
    say("\nSheriff Okafor will want to hear about this. Head back to Dustwater.")


def epilogue(player):
    say("\n" + "=" * 60)
    say("EPILOGUE")
    if "ending_warlord" in player.flags:
        say(f"The Red Teeth grew under Warlord {player.name}. Dustwater paid tribute in water "
            "and, in bad years, in people. The wasteland had traded one monster for another.")
    elif player.karma >= 3:
        say(f"Dustwater painted {player.name}'s face on the dam wall. The water purifier still "
            "wheezes, but it runs clean now"
            + (", and children who were once in cages grow up telling the story."
               if "freed_captives" in player.flags else ", and nobody locks their door at night."))
    elif player.karma <= -2:
        say(f"Dustwater was safer without the Red Teeth, but nobody in town would drink with "
            f"{player.name}. Some say the missing kids were sold by someone who knew the town "
            "too well.")
    else:
        say(f"{player.name} collected the bounty and drifted east, another scarred face on "
            "another broken road. The wasteland didn't get better. It got a little less worse.")
    say(f"\n{player.name} - Level {player.level} {player.karma_title()} - "
        f"{player.turns} turns, {player.kills} kills.")
    say("=" * 60)
    memorialize(player, f"[SURVIVED] {player.name} - Lv {player.level} {player.karma_title()} - "
                        f"{player.turns} turns, {player.kills} kills")


HELP = """Commands:
  n s e w / go <dir>   move              look        describe the area
  search               scavenge          inv         inventory and caps
  use <item>           use, eat, equip   stats       your condition
  shop                 trade             talk        talk to people
  rest                 sleep (towns)     quit        save and stop playing
There is no load. Every action is saved. When you die, you stay dead."""


# ---------------------------------------------------------------- main


def title():
    say("""
  ====================================================
              A  S  H  L  A  N  D  S
  ====================================================
  Contains violence, drug use, slavery and strong language.
  Permadeath: one life, no reloads.""")
    if os.path.exists(MEMORIAL_FILE):
        with open(MEMORIAL_FILE) as f:
            lines = f.read().splitlines()[-5:]
        if lines:
            say("\n  -- The Memorial Wall --")
            for line in lines:
                say("  " + line)


def new_game():
    name = ask("\nWhat's your name, shelter dweller? > ").title() or "Dweller"
    player = Player(name)
    say(f"\nShelter 41, Year 2161. The water chip is failing and the rations are shorter every "
        f"month. This morning the Overseer called your name at assembly. "
        f"\"{name}. The shelter thanks you for your sacrifice.\" Nobody would look at you.")
    say("\nYou were given a jumpsuit, a pipe wrench, two stimpaks, a can of beans and twenty "
        "caps. Then the door opened onto the world your grandparents burned.")
    say("\nType 'help' for commands.")
    return player


def main():
    title()
    if os.path.exists(SAVE_FILE):
        player = load_game()
        say(f"\n{player.name} is still out there. (Level {player.level}, {player.hp} HP)")
        if ask("Continue? (y = continue / abandon = let them die) > ") == "abandon":
            player.killer = "despair"
            die(player)
            player = new_game()
    else:
        player = new_game()

    describe(player)
    if player.pending_fight:
        fight(player, player.pending_fight["id"], player.pending_fight["hp"])

    while player.hp > 0 and "ended" not in player.flags:
        save_game(player)
        raw = ask("\n> ")
        verb, _, arg = raw.partition(" ")
        player.turns += 1

        if verb in ("n", "s", "e", "w", "north", "south", "east", "west"):
            move(player, verb)
        elif verb == "go":
            move(player, arg)
        elif verb in ("look", "l"):
            describe(player)
        elif verb == "search":
            search(player)
        elif verb in ("inv", "i", "inventory"):
            show_inventory(player)
        elif verb in ("use", "equip", "eat", "drink", "take"):
            use_item(player, arg)
        elif verb in ("stats", "status", "c"):
            player.status()
        elif verb == "shop":
            shop(player)
        elif verb == "talk":
            talk(player)
        elif verb == "rest":
            rest(player)
        elif verb in ("help", "h", "?"):
            say(HELP)
        elif verb in ("quit", "exit", "q"):
            save_game(player)
            say("You find a corner to hole up in. (Progress saved.)")
            return
        elif verb == "load":
            say("There's no going back out here.")
        elif verb:
            say("Unknown command. Type 'help'.")

        if "kessler_dead" in player.flags and player.room == "dustwater" \
                and "okafor_paid" in player.flags and "ended" not in player.flags:
            player.flags.append("ended")
            epilogue(player)
            return

    if player.hp <= 0:
        time.sleep(0.5)
        die(player)


if __name__ == "__main__":
    main()
