#!/usr/bin/env python3
"""Ashes of Emberfall - a tiny text RPG. Run: python3 rpg/game.py"""

import json
import os
import random
import sys

SAVE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "save.json")

# ---------------------------------------------------------------- data

ITEMS = {
    "potion":       {"name": "Healing Potion", "kind": "heal", "power": 25, "price": 10,
                     "desc": "Restores 25 HP."},
    "elixir":       {"name": "Elixir", "kind": "heal", "power": 60, "price": 30,
                     "desc": "Restores 60 HP."},
    "rusty_sword":  {"name": "Rusty Sword", "kind": "weapon", "power": 2, "price": 5,
                     "desc": "Better than your fists. Barely."},
    "iron_sword":   {"name": "Iron Sword", "kind": "weapon", "power": 5, "price": 40,
                     "desc": "A reliable blade. +5 attack."},
    "ember_blade":  {"name": "Ember Blade", "kind": "weapon", "power": 10, "price": 0,
                     "desc": "Warm to the touch. +10 attack."},
    "leather":      {"name": "Leather Armor", "kind": "armor", "power": 2, "price": 25,
                     "desc": "+2 defense."},
    "chainmail":    {"name": "Chainmail", "kind": "armor", "power": 5, "price": 60,
                     "desc": "+5 defense."},
    "bomb":         {"name": "Fire Bomb", "kind": "bomb", "power": 30, "price": 20,
                     "desc": "Deals 30 damage to an enemy."},
    "crypt_key":    {"name": "Crypt Key", "kind": "key", "power": 0, "price": 0,
                     "desc": "An old bone key. It hums near the crypt."},
}

ENEMIES = {
    "rat":      {"name": "Giant Rat", "hp": 12, "atk": 4, "def": 0, "xp": 6, "gold": (1, 4)},
    "wolf":     {"name": "Grey Wolf", "hp": 20, "atk": 7, "def": 1, "xp": 12, "gold": (2, 6)},
    "bandit":   {"name": "Bandit", "hp": 28, "atk": 9, "def": 2, "xp": 18, "gold": (8, 15)},
    "skeleton": {"name": "Skeleton", "hp": 32, "atk": 11, "def": 4, "xp": 24, "gold": (5, 12)},
    "wraith":   {"name": "Wraith", "hp": 40, "atk": 14, "def": 3, "xp": 35, "gold": (10, 20)},
    "lich":     {"name": "The Ember Lich", "hp": 120, "atk": 18, "def": 6, "xp": 200, "gold": (100, 100),
                 "boss": True},
}

ROOMS = {
    "village": {
        "name": "Emberfall Village",
        "desc": "Smoke curls from a few surviving chimneys. The elder watches you from her porch. "
                "A shop sign creaks in the wind.",
        "exits": {"north": "forest", "east": "road"},
        "shop": ["potion", "elixir", "iron_sword", "leather", "chainmail", "bomb"],
        "npc": "elder",
        "safe": True,
    },
    "forest": {
        "name": "Whispering Forest",
        "desc": "Twisted trees lean over the path. Something rustles in the undergrowth.",
        "exits": {"south": "village", "north": "ruins", "east": "cave"},
        "enemies": ["rat", "wolf"],
        "loot": ["rusty_sword"],
    },
    "road": {
        "name": "The Old Road",
        "desc": "A cracked road leads off toward the hills. Broken carts line the ditch.",
        "exits": {"west": "village", "north": "cave"},
        "enemies": ["bandit", "wolf"],
        "loot": ["potion"],
    },
    "cave": {
        "name": "Dripping Cave",
        "desc": "Water drips in the dark. Old bones crunch underfoot. A glint catches your eye "
                "behind a fallen rock.",
        "exits": {"west": "forest", "south": "road"},
        "enemies": ["bandit", "skeleton"],
        "loot": ["crypt_key", "bomb"],
    },
    "ruins": {
        "name": "Ruined Chapel",
        "desc": "Shattered stained glass glitters on the floor. A stairway descends into a "
                "sealed crypt to the north.",
        "exits": {"south": "forest", "north": "crypt"},
        "enemies": ["skeleton", "wraith"],
        "loot": ["elixir"],
        "locked": {"north": "crypt_key"},
    },
    "crypt": {
        "name": "The Ember Crypt",
        "desc": "Heat pours from the walls. On a throne of ash sits the Ember Lich, eyes burning.",
        "exits": {"south": "ruins"},
        "boss": "lich",
        "loot": ["ember_blade"],
    },
}

NPCS = {
    "elder": [
        "Elder Maren: \"The Lich in the crypt below the old chapel is burning our land.\"",
        "Elder Maren: \"The crypt is sealed. They say a key was lost in the caves to the east.\"",
        "Elder Maren: \"Buy what you can from the shop. And rest here when you need to - it's free.\"",
    ],
}

# ---------------------------------------------------------------- helpers


def say(text=""):
    print(text)


def ask(prompt="> "):
    try:
        return input(prompt).strip().lower()
    except EOFError:
        say("\nFarewell.")
        sys.exit(0)


def bar(cur, mx, width=20):
    filled = int(width * max(cur, 0) / mx)
    return "[" + "#" * filled + "-" * (width - filled) + f"] {max(cur, 0)}/{mx}"


def find_item(query, pool):
    """Match a typed name like 'iron sword' or 'potion' to an item id in pool."""
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
        self.gold = 15
        self.inventory = ["potion", "potion"]
        self.weapon = None
        self.armor = None
        self.room = "village"
        self.looted = []        # rooms already searched
        self.boss_dead = False
        self.talk_index = 0

    @property
    def atk(self):
        return self.base_atk + (ITEMS[self.weapon]["power"] if self.weapon else 0)

    @property
    def defense(self):
        return self.base_def + (ITEMS[self.armor]["power"] if self.armor else 0)

    def xp_needed(self):
        return 20 * self.level

    def gain_xp(self, amount):
        self.xp += amount
        while self.xp >= self.xp_needed():
            self.xp -= self.xp_needed()
            self.level += 1
            self.max_hp += 10
            self.base_atk += 2
            self.base_def += 1
            self.hp = self.max_hp
            say(f"*** LEVEL UP! You are now level {self.level}. HP fully restored. ***")

    def status(self):
        weapon = ITEMS[self.weapon]["name"] if self.weapon else "fists"
        armor = ITEMS[self.armor]["name"] if self.armor else "rags"
        say(f"{self.name}  Lv {self.level}  XP {self.xp}/{self.xp_needed()}  Gold {self.gold}")
        say(f"HP {bar(self.hp, self.max_hp)}")
        say(f"ATK {self.atk}  DEF {self.defense}  Weapon: {weapon}  Armor: {armor}")

    def to_dict(self):
        return dict(self.__dict__)

    @classmethod
    def from_dict(cls, data):
        p = cls(data["name"])
        p.__dict__.update(data)
        return p


# ---------------------------------------------------------------- combat


def fight(player, enemy_id):
    e = dict(ENEMIES[enemy_id])
    hp = e["hp"]
    say(f"\n!!! A {e['name']} attacks! !!!")
    while hp > 0:
        say(f"\n{e['name']:<16} {bar(hp, e['hp'])}")
        say(f"{player.name:<16} {bar(player.hp, player.max_hp)}")
        cmd = ask("(a)ttack  (d)efend  (i)tem  (r)un > ")
        defending = False

        if cmd in ("a", "attack"):
            crit = random.random() < 0.1
            dmg = max(1, player.atk + random.randint(-2, 2) - e["def"])
            if crit:
                dmg *= 2
                say("Critical hit!")
            hp -= dmg
            say(f"You hit the {e['name']} for {dmg}.")
        elif cmd in ("d", "defend"):
            defending = True
            say("You raise your guard.")
        elif cmd in ("i", "item"):
            usable = [i for i in player.inventory if ITEMS[i]["kind"] in ("heal", "bomb")]
            if not usable:
                say("You have nothing useful to use.")
                continue
            for n, item_id in enumerate(dict.fromkeys(usable), 1):
                say(f"  {n}. {ITEMS[item_id]['name']} x{player.inventory.count(item_id)}")
            choice = ask("Use which? > ")
            options = list(dict.fromkeys(usable))
            if not choice.isdigit() or not 1 <= int(choice) <= len(options):
                continue
            item_id = options[int(choice) - 1]
            player.inventory.remove(item_id)
            item = ITEMS[item_id]
            if item["kind"] == "heal":
                healed = min(item["power"], player.max_hp - player.hp)
                player.hp += healed
                say(f"You drink the {item['name']} and recover {healed} HP.")
            else:
                hp -= item["power"]
                say(f"BOOM! The bomb deals {item['power']} damage.")
        elif cmd in ("r", "run"):
            if e.get("boss"):
                say("The Lich's flames block your escape!")
            elif random.random() < 0.5:
                say("You escape!")
                return "fled"
            else:
                say("You fail to escape!")
        else:
            say("You hesitate...")

        if hp <= 0:
            break

        # enemy turn
        if e.get("boss") and random.random() < 0.25:
            dmg = max(1, e["atk"] + 6 - player.defense)
            say(f"The Lich hurls a wave of fire!")
        else:
            dmg = max(1, e["atk"] + random.randint(-2, 2) - player.defense)
        if defending:
            dmg = max(0, dmg // 2)
        player.hp -= dmg
        say(f"The {e['name']} hits you for {dmg}.")
        if player.hp <= 0:
            return "dead"

    gold = random.randint(*e["gold"])
    player.gold += gold
    say(f"\nYou defeated the {e['name']}! +{e['xp']} XP, +{gold} gold.")
    if random.random() < 0.25 and not e.get("boss"):
        player.inventory.append("potion")
        say("It dropped a Healing Potion!")
    player.gain_xp(e["xp"])
    return "won"


# ---------------------------------------------------------------- actions


def describe(player):
    room = ROOMS[player.room]
    say(f"\n== {room['name']} ==")
    say(room["desc"])
    say("Exits: " + ", ".join(room["exits"]))
    if "shop" in room:
        say("There is a shop here. (type 'shop')")
    if "npc" in room:
        say("Someone here wants to talk. (type 'talk')")


def move(player, direction):
    room = ROOMS[player.room]
    aliases = {"n": "north", "s": "south", "e": "east", "w": "west"}
    direction = aliases.get(direction, direction)
    if direction not in room["exits"]:
        say("You can't go that way.")
        return None
    needed = room.get("locked", {}).get(direction)
    if needed and needed not in player.inventory:
        say("The way is sealed. You need something to open it.")
        return None
    if needed:
        say(f"The {ITEMS[needed]['name']} glows and the seal crumbles.")
    player.room = room["exits"][direction]
    describe(player)
    new_room = ROOMS[player.room]

    if new_room.get("boss") and not player.boss_dead:
        return fight(player, new_room["boss"])
    if new_room.get("enemies") and random.random() < 0.5:
        return fight(player, random.choice(new_room["enemies"]))
    return None


def search(player):
    room = ROOMS[player.room]
    if player.room in player.looted or not room.get("loot"):
        say("You find nothing of interest.")
        return
    if room.get("boss") and not player.boss_dead:
        say("Not while the Lich still burns.")
        return
    for item_id in room["loot"]:
        player.inventory.append(item_id)
        say(f"You found: {ITEMS[item_id]['name']}!")
    player.looted.append(player.room)


def show_inventory(player):
    if not player.inventory:
        say("Your pack is empty.")
        return
    say("You carry:")
    for item_id in dict.fromkeys(player.inventory):
        item = ITEMS[item_id]
        say(f"  {item['name']} x{player.inventory.count(item_id)} - {item['desc']}")


def use_item(player, query):
    item_id = find_item(query, player.inventory)
    if not item_id:
        say("You don't have that.")
        return
    item = ITEMS[item_id]
    if item["kind"] == "heal":
        player.inventory.remove(item_id)
        healed = min(item["power"], player.max_hp - player.hp)
        player.hp += healed
        say(f"You recover {healed} HP.")
    elif item["kind"] in ("weapon", "armor"):
        slot = "weapon" if item["kind"] == "weapon" else "armor"
        old = getattr(player, slot)
        player.inventory.remove(item_id)
        if old:
            player.inventory.append(old)
        setattr(player, slot, item_id)
        say(f"You equip the {item['name']}.")
    else:
        say("You can't use that here.")


def shop(player):
    room = ROOMS[player.room]
    if "shop" not in room:
        say("There's no shop here.")
        return
    while True:
        say(f"\n-- Shop -- (gold: {player.gold})")
        for n, item_id in enumerate(room["shop"], 1):
            item = ITEMS[item_id]
            say(f"  {n}. {item['name']:<16} {item['price']:>3}g  {item['desc']}")
        say("  s. Sell an item   q. Leave")
        choice = ask("> ")
        if choice in ("q", "leave", ""):
            return
        if choice == "s":
            sellable = [i for i in dict.fromkeys(player.inventory) if ITEMS[i]["price"] > 0]
            if not sellable:
                say("You have nothing the shopkeeper wants.")
                continue
            for n, item_id in enumerate(sellable, 1):
                say(f"  {n}. {ITEMS[item_id]['name']} - {ITEMS[item_id]['price'] // 2}g")
            pick = ask("Sell which? > ")
            if pick.isdigit() and 1 <= int(pick) <= len(sellable):
                item_id = sellable[int(pick) - 1]
                player.inventory.remove(item_id)
                player.gold += ITEMS[item_id]["price"] // 2
                say(f"Sold {ITEMS[item_id]['name']}.")
            continue
        if choice.isdigit() and 1 <= int(choice) <= len(room["shop"]):
            item_id = room["shop"][int(choice) - 1]
            price = ITEMS[item_id]["price"]
            if player.gold < price:
                say("You can't afford that.")
            else:
                player.gold -= price
                player.inventory.append(item_id)
                say(f"Bought {ITEMS[item_id]['name']}.")


def talk(player):
    room = ROOMS[player.room]
    if "npc" not in room:
        say("You talk to yourself. It doesn't help.")
        return
    lines = NPCS[room["npc"]]
    if player.boss_dead:
        say("Elder Maren: \"You did it! Emberfall will rebuild, thanks to you.\"")
        return
    say(lines[player.talk_index % len(lines)])
    player.talk_index += 1


def rest(player):
    if ROOMS[player.room].get("safe"):
        player.hp = player.max_hp
        say("You rest by the hearth. HP fully restored.")
    else:
        say("It's not safe to rest here.")


def save_game(player):
    with open(SAVE_FILE, "w") as f:
        json.dump(player.to_dict(), f)
    say("Game saved.")


def load_game():
    with open(SAVE_FILE) as f:
        return Player.from_dict(json.load(f))


HELP = """Commands:
  go <dir> / n s e w   move            look          describe the room
  search               search for loot  inv           show inventory
  use <item>           use or equip     stats         show your stats
  shop                 visit the shop   talk          talk to someone
  rest                 heal (safe areas) save / load  save or load game
  quit                 leave the game"""


# ---------------------------------------------------------------- main loop


def title():
    say("""
  ==============================================
       A S H E S   O F   E M B E R F A L L
  ==============================================""")


def main():
    title()
    player = None
    if os.path.exists(SAVE_FILE) and ask("Load saved game? (y/n) > ") == "y":
        player = load_game()
        say(f"Welcome back, {player.name}.")
    if player is None:
        name = input("What is your name, traveler? > ").strip() or "Hero"
        player = Player(name)
        say(f"\n{name}, the village of Emberfall needs you. Type 'help' for commands.")
    describe(player)

    while True:
        raw = ask("\n> ")
        verb, _, arg = raw.partition(" ")
        result = None

        if verb in ("n", "s", "e", "w", "north", "south", "east", "west"):
            result = move(player, verb)
        elif verb == "go":
            result = move(player, arg)
        elif verb in ("look", "l"):
            describe(player)
        elif verb == "search":
            search(player)
        elif verb in ("inv", "i", "inventory"):
            show_inventory(player)
        elif verb in ("use", "equip", "drink"):
            use_item(player, arg)
        elif verb in ("stats", "status"):
            player.status()
        elif verb == "shop":
            shop(player)
        elif verb == "talk":
            talk(player)
        elif verb == "rest":
            rest(player)
        elif verb == "save":
            save_game(player)
        elif verb == "load":
            if os.path.exists(SAVE_FILE):
                player = load_game()
                say("Game loaded.")
                describe(player)
            else:
                say("No save found.")
        elif verb in ("help", "h", "?"):
            say(HELP)
        elif verb in ("quit", "exit", "q"):
            say("Farewell, traveler.")
            break
        elif verb:
            say("Unknown command. Type 'help'.")

        if result == "dead":
            say("\nYou fall to the ground. The embers take you...")
            say("GAME OVER")
            break
        if result == "won" and ROOMS[player.room].get("boss") and not player.boss_dead:
            player.boss_dead = True
            say("\nThe Ember Lich crumbles to ash. The heat fades from the land.")
            say("Search the crypt for your reward, then return to the village.")
            say("*** YOU WIN! (You can keep exploring.) ***")


if __name__ == "__main__":
    main()
