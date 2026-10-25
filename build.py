"""Builds the FPL team news tracker page.

Fetches your squad and player data from the public Fantasy Premier League
API, works out injury/form flags, captain picks, transfer ideas, price
changes and mini-league standings, and writes a single self-contained web
page to site/index.html. On the morning of a deadline it also emails a
summary (see email_digest.py).

Usage:
    python build.py                 # uses TEAM_ID env var, or the default below
    python build.py --sample DIR    # build from saved JSON files instead of the API
    python build.py --email force   # send the email now, whatever the day
"""

import argparse
import html
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import chips
import live
from rivals import head_to_head
import email_digest

DEFAULT_TEAM_ID = 2612117
API = "https://fantasy.premierleague.com/api"

FIXTURES_AHEAD = 3      # upcoming gameweeks shown per player
FORM_WINDOW = 5         # past gameweeks used for "recent form"
LOW_MINUTES = 180       # fewer minutes than this over FORM_WINDOW = rotation risk
LOW_POINTS = 10         # fewer points than this over FORM_WINDOW = poor form
TOUGH_FDR = 3.67        # average fixture difficulty at or above this = tough run
MAX_SELLS = 3
REPLACEMENTS_PER_SELL = 3
CAPTAIN_OPTIONS = 3
MAX_RIVALS = 50         # managers compared per mini-league (one page of standings)
RIVAL_TARGETS = 6       # "players your rivals own" shown per league
DIFFERENTIAL_SHARE = 0.25  # your starters owned by at most this share of rivals
# Only show leagues whose name contains one of these (comma-separated, any case).
# Leave LEAGUES empty to show every private league.
LEAGUES = os.environ.get("LEAGUES", "")
# Short display names, as "part of league name=nickname" pairs separated by commas.
LEAGUE_NICKNAMES = os.environ.get("LEAGUE_NICKNAMES", "")

# Price change estimate: net transfers this gameweek as a share of current owners.
RISE_RATIO, RISE_MIN_NET = 0.04, 25000
FALL_RATIO, FALL_MIN_NET = -0.03, -15000

POSITIONS = {1: "Goalkeepers", 2: "Defenders", 3: "Midfielders", 4: "Forwards"}
POS_SHORT = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}


# --------------------------------------------------------------------------- data

class Source:
    """Reads FPL endpoints from the live API or from a folder of saved JSON."""

    def __init__(self, sample_dir=None):
        self.sample_dir = Path(sample_dir) if sample_dir else None
        self.cache = {}

    def get(self, path):
        if path not in self.cache:
            self.cache[path] = self._fetch(path)
        return self.cache[path]

    def _fetch(self, path):
        if self.sample_dir:
            name = path.strip("/").replace("/", "_").replace("?", "_").replace("=", "_")
            file = self.sample_dir / f"{name}.json"
            if not file.exists():
                raise LookupError(path)
            return json.loads(file.read_text())
        url = f"{API}/{path}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 fpl-news-tracker"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    return json.load(resp)
            except urllib.error.HTTPError as exc:
                if exc.code == 404:
                    raise LookupError(path) from exc
                err = exc
            except Exception as exc:  # network hiccup or FPL "game is updating"
                err = exc
            if attempt == 3:
                raise RuntimeError(f"Could not fetch {url}: {err}") from err
            time.sleep(2 ** (attempt + 1))


def chance_of_playing(p):
    """Percent chance of playing next round; FPL leaves it null for fit players."""
    if p["chance_of_playing_next_round"] is not None:
        return p["chance_of_playing_next_round"]
    return 100 if p["status"] == "a" else 0


def upcoming(team_id, fixtures, gameweeks, teams):
    """Opponents per upcoming gameweek: [(gw, [(opp_short, home, fdr), ...]), ...]."""
    out = []
    for gw in gameweeks:
        games = []
        for f in fixtures:
            if f["event"] != gw:
                continue
            if f["team_h"] == team_id:
                games.append((teams[f["team_a"]]["short_name"], True, f["team_h_difficulty"]))
            elif f["team_a"] == team_id:
                games.append((teams[f["team_h"]]["short_name"], False, f["team_a_difficulty"]))
        out.append((gw, games))
    return out


def avg_fdr(runs):
    """Average difficulty over the run; a blank gameweek counts as a 5."""
    scores = []
    for _, games in runs:
        if games:
            scores.extend(g[2] for g in games)
        else:
            scores.append(5)
    return sum(scores) / len(scores) if scores else 3


def recent_form(history, past_gws):
    """Points and minutes per past gameweek (double gameweeks combined, blanks = 0)."""
    by_gw = {gw: {"pts": 0, "mins": 0, "played": False} for gw in past_gws}
    for h in history:
        if h["round"] in by_gw:
            by_gw[h["round"]]["pts"] += h["total_points"]
            by_gw[h["round"]]["mins"] += h["minutes"]
            by_gw[h["round"]]["played"] = True
    return [(gw, by_gw[gw]) for gw in past_gws]


def assess(player, form, runs):
    """Returns (flag, reasons, sell_score) for one squad player."""
    chance = chance_of_playing(player)
    reasons, score = [], 0
    flag = "green"

    if chance <= 0 or (player["status"] in ("i", "s", "u", "n") and chance < 25):
        flag = "red"
        reasons.append({"s": "Suspended", "u": "Unavailable", "n": "Not in squad"}.get(player["status"], "Injured"))
        score += 4
    elif chance < 100:
        flag = "amber"
        reasons.append(f"{chance}% chance of playing")
        score += 2

    pts = sum(f["pts"] for _, f in form)
    mins = sum(f["mins"] for _, f in form)
    if mins < LOW_MINUTES:
        reasons.append(f"Only {mins} mins in last {FORM_WINDOW} GWs")
        score += 2
        flag = "amber" if flag == "green" else flag
    elif pts < LOW_POINTS:
        reasons.append(f"Only {pts} pts in last {FORM_WINDOW} GWs")
        score += 1
        flag = "amber" if flag == "green" else flag

    fdr = avg_fdr(runs)
    if any(not games for _, games in runs):
        reasons.append("Blank gameweek coming")
        score += 1
    if fdr >= TOUGH_FDR:
        reasons.append("Tough fixtures")
        score += 1
    elif fdr <= 2.34:
        score -= 1  # easy run: more reason to keep

    return flag, reasons, score


def replacement_score(p, runs):
    """Ranks possible signings: FPL form, nudged up for easy fixtures."""
    return float(p["form"] or 0) * (1 + (3 - avg_fdr(runs)) * 0.15) + float(p["ep_next"] or 0) * 0.5


def price_trend(p, total_players):
    """Price change so far this gameweek and an estimated next move ('rise', 'fall' or None)."""
    owners = max(1.0, float(p["selected_by_percent"] or 0) / 100 * total_players)
    net = p["transfers_in_event"] - p["transfers_out_event"]
    ratio = net / owners
    if ratio >= RISE_RATIO and net >= RISE_MIN_NET:
        likely = "rise"
    elif ratio <= FALL_RATIO and net <= FALL_MIN_NET:
        likely = "fall"
    else:
        likely = None
    return {"change": p["cost_change_event"], "net": net, "likely": likely}


def captain_picks(squad):
    """Best captain options among likely starters, for the next gameweek."""
    options = []
    for s in squad:
        if not s["starter"] or s["flag"] == "red" or chance_of_playing(s["p"]) < 75:
            continue
        gw, games = s["runs"][0] if s["runs"] else (None, [])
        if not games:
            continue
        p = s["p"]
        fixture_ease = sum(3 - g[2] for g in games) * 0.5
        score = float(p["ep_next"] or 0) + float(p["form"] or 0) * 0.3 + fixture_ease + (len(games) - 1) * 1.5
        why = [f"expected {p['ep_next']} pts", f"form {p['form']}"]
        if len(games) > 1:
            why.append("double gameweek")
        options.append({"s": s, "score": score, "why": why, "games": [(gw, games)]})
    options.sort(key=lambda o: o["score"], reverse=True)
    return options[:CAPTAIN_OPTIONS]


def simplify(name):
    return "".join(ch for ch in name.lower() if ch.isalnum())


def wanted_league(name):
    wanted = [simplify(w) for w in LEAGUES.split(",") if w.strip()]
    return not wanted or any(w in simplify(name) for w in wanted)


def nickname(name):
    for pair in LEAGUE_NICKNAMES.split(","):
        if "=" in pair:
            match, nick = (x.strip() for x in pair.split("=", 1))
            if match and simplify(match) in simplify(name):
                return nick
    return name


def mini_leagues(source, entry, team_id, gw, squad):
    """Standings plus rival ownership for each private classic league."""
    mine_xi = {s["p"]["id"] for s in squad if s["pick"]["multiplier"] > 0}
    mine_all = {s["p"]["id"] for s in squad}
    leagues = []
    for lg in (entry.get("leagues") or {}).get("classic", []):
        if lg.get("league_type") != "x" or not wanted_league(lg["name"]):  # private leagues only
            print(f"Skipping league: {lg['name']}")
            continue
        try:
            data = source.get(f"leagues-classic/{lg['id']}/standings/")
        except LookupError:
            continue
        rows = data["standings"]["results"][:MAX_RIVALS]
        owned, captained, rivals, squads, meta = {}, {}, 0, {}, {}
        for r in rows:
            if r["entry"] == team_id:
                continue
            try:
                resp = source.get(f"entry/{r['entry']}/event/{gw}/picks/")
            except LookupError:
                continue  # joined after this gameweek
            picks = resp["picks"]
            rivals += 1
            squads[r["entry"]] = picks
            try:
                hist = source.get(f"entry/{r['entry']}/history/")
            except LookupError:
                hist = {}
            meta[r["entry"]] = {"chip": resp.get("active_chip"), "history": hist,
                                "hit": (resp.get("entry_history") or {}).get("event_transfers_cost", 0)}
            for pk in picks:
                if pk["multiplier"] > 0:
                    owned[pk["element"]] = owned.get(pk["element"], 0) + 1
                if pk["is_captain"]:
                    captained[pk["element"]] = captained.get(pk["element"], 0) + 1
        targets = sorted(((n, el) for el, n in owned.items() if el not in mine_all), reverse=True)[:RIVAL_TARGETS]
        differentials = [el for el in mine_xi if rivals and owned.get(el, 0) / rivals <= DIFFERENTIAL_SHARE]
        me = next((r for r in rows if r["entry"] == team_id), None)
        leagues.append({
            "name": nickname(data["league"]["name"]), "full_name": data["league"]["name"], "rows": rows, "me": me, "rivals": rivals,
            "more": data["standings"].get("has_next", False),
            "targets": targets, "captained": sorted(((n, el) for el, n in captained.items()), reverse=True)[:3],
            "differentials": differentials, "owned": owned, "squads": squads, "meta": meta,
        })
    return leagues


def build(source, team_id):
    boot = source.get("bootstrap-static/")
    fixtures = source.get("fixtures/?future=1")
    entry = source.get(f"entry/{team_id}/")

    teams = {t["id"]: t for t in boot["teams"]}
    players = {p["id"]: p for p in boot["elements"]}
    total_players = boot.get("total_players") or 10_000_000
    events = boot["events"]
    next_event = next((e for e in events if e["is_next"]), None)
    finished = [e["id"] for e in events if e["finished"]]
    past_gws = finished[-FORM_WINDOW:]
    first_ahead = next_event["id"] if next_event else (finished[-1] + 1 if finished else 1)
    ahead_gws = [gw for gw in range(first_ahead, first_ahead + FIXTURES_AHEAD) if gw <= len(events)]

    current_gw = entry.get("current_event")
    if not current_gw:
        raise RuntimeError("This FPL team has no picks yet - has the season started?")
    picks_data = source.get(f"entry/{team_id}/event/{current_gw}/picks/")
    bank = (picks_data.get("entry_history") or {}).get("bank", 0)

    squad = []
    for pick in sorted(picks_data["picks"], key=lambda x: x["position"]):
        p = players[pick["element"]]
        summary = source.get(f"element-summary/{p['id']}/")
        form = recent_form(summary["history"], past_gws)
        runs = upcoming(p["team"], fixtures, ahead_gws, teams)
        flag, reasons, score = assess(p, form, runs)
        squad.append({
            "p": p, "pick": pick, "form": form, "runs": runs,
            "flag": flag, "reasons": reasons, "score": score,
            "starter": pick["position"] <= 11, "price": price_trend(p, total_players),
        })

    # Transfer ideas: weakest players (starters weighted slightly higher) and
    # in-form, available alternatives in the same position within budget.
    squad_ids = {s["p"]["id"] for s in squad}
    club_counts = {}
    for s in squad:
        club_counts[s["p"]["team"]] = club_counts.get(s["p"]["team"], 0) + 1

    sells = sorted((s for s in squad if s["score"] >= 2),
                   key=lambda s: (s["score"] + (0.5 if s["starter"] else 0)), reverse=True)[:MAX_SELLS]
    ideas = []
    for s in sells:
        out = s["p"]
        budget = out["now_cost"] + bank
        options = []
        for p in boot["elements"]:
            if (p["element_type"] != out["element_type"] or p["id"] in squad_ids
                    or p["now_cost"] > budget or chance_of_playing(p) < 100
                    or p["minutes"] < 270):
                continue
            if p["team"] != out["team"] and club_counts.get(p["team"], 0) >= 3:
                continue
            runs = upcoming(p["team"], fixtures, ahead_gws, teams)
            options.append((replacement_score(p, runs), p, runs))
        options.sort(key=lambda o: o[0], reverse=True)
        ideas.append({"out": s, "budget": budget, "options": options[:REPLACEMENTS_PER_SELL]})

    try:
        history = source.get(f"entry/{team_id}/history/")
    except LookupError:
        history = {}
    flagged = sum(1 for s in squad if s["flag"] != "green")
    chip_plan = chips.plan(squad, players, fixtures, first_ahead, len(events),
                           chips.available_chips(boot, history, first_ahead), flagged) if next_event else []

    leagues = mini_leagues(source, entry, team_id, current_gw, squad)
    my_meta = {"chip": picks_data.get("active_chip"),
               "hit": (picks_data.get("entry_history") or {}).get("event_transfers_cost", 0)}
    for lg in leagues:
        lg["meta"][team_id] = {**my_meta, "history": history}
        for m in lg["meta"].values():
            m["left"] = [c["name"] for c in chips.available_chips(boot, m.get("history"), first_ahead)]
    try:
        live_data = live.build_live(source, events, players, picks_data["picks"], my_meta, team_id, leagues)
    except Exception as exc:  # live scores are a bonus: never let them break the page
        print(f"Live scores skipped: {exc}")
        live_data = None

    return {
        "entry": entry, "teams": teams, "players": players, "squad": squad, "ideas": ideas,
        "live": live_data,
        "chip_plan": chip_plan, "history": history,
        "bank": bank, "current_gw": current_gw, "next_event": next_event,
        "past_gws": past_gws, "chip": picks_data.get("active_chip"),
        "captains": captain_picks(squad),
        "leagues": leagues,
    }


# --------------------------------------------------------------------------- page

def esc(x):
    return html.escape(str(x))


def money(tenths):
    return f"£{tenths / 10:.1f}m"


def price_label(pr):
    """Short text for a player's price movement, or '' when nothing to report."""
    bits = []
    if pr["change"]:
        bits.append(f"{'▲' if pr['change'] > 0 else '▼'} {money(abs(pr['change']))} this GW")
    if pr["likely"]:
        bits.append(f"likely to {pr['likely']}")
    return " · ".join(bits)


def fixtures_html(runs):
    cells = []
    for gw, games in runs:
        if not games:
            cells.append(f'<span class="fx blank" title="GW{gw}: no fixture">–</span>')
        for opp, home, fdr in games:
            label = opp if home else opp.lower()
            cells.append(f'<span class="fx d{fdr}" title="GW{gw}: {esc(opp)} ({"home" if home else "away"}), difficulty {fdr}">'
                         f'{esc(label)}<small>{"H" if home else "A"}</small></span>')
    return "".join(cells)


def form_html(form):
    cells = []
    for gw, f in form:
        cls = "pts" if f["played"] and f["mins"] else "pts none"
        cells.append(f'<span class="{cls}" title="GW{gw}: {f["pts"]} pts, {f["mins"]} mins">{f["pts"]}</span>')
    return "".join(cells)


def player_row(s, teams, first=False):
    """One compact row per player; a second line only for news or form warnings."""
    p, pick = s["p"], s["pick"]
    badge = ' <span class="badge">C</span>' if pick.get("is_captain") else (
        ' <span class="badge">V</span>' if pick.get("is_vice_captain") else "")
    bench = "" if s["starter"] else ' <span class="bench">B</span>'
    status_words = ("Injured", "Suspended", "Unavailable", "Not in squad")
    shown = [p["news"]] if p.get("news") else [r for r in s["reasons"] if r in status_words or "chance" in r]
    shown += [r for r in s["reasons"] if r.startswith("Only ")]  # low minutes / low points
    hidden = [r for r in s["reasons"] if r not in shown and r not in status_words and "chance" not in r]
    pl = price_label(s["price"])
    tip = [f'{p["web_name"]} · {POS_SHORT[p["element_type"]]} · {teams[p["team"]]["name"]} · {money(p["now_cost"])}']
    tip += hidden + ([pl] if pl else [])
    total5 = sum(f["pts"] for _, f in s["form"])
    note = esc(" · ".join(shown))
    return f"""
      <div class="prow flag-{s['flag']}{' posfirst' if first else ''}">
        <div class="name" title="{esc(' · '.join(tip))}"><strong>{esc(p['web_name'])}</strong>{badge}{bench}</div>
        <div class="strip" title="Last {len(s['form'])} GWs: {total5} pts">{form_html(s['form'])}</div>
        <div class="strip">{fixtures_html(s['runs'])}</div>
        {f'<div class="note">{note}</div>' if note else ''}
      </div>"""


def squad_html(d):
    rows = []
    for pos in POSITIONS:
        group = [s for s in d["squad"] if s["p"]["element_type"] == pos]
        rows.extend(player_row(s, d["teams"], first=(i == 0 and pos != 1)) for i, s in enumerate(group))
    return f"""
  <div class="box squad">
    <div class="prow head"><div class="dhead">Your squad</div><div class="lbl">Last {FORM_WINDOW}</div><div class="lbl">Next {FIXTURES_AHEAD}</div></div>
    {''.join(rows)}
  </div>"""


def captains_html(d):
    if not d["captains"]:
        return '<p class="ok">No fit starters with a fixture next gameweek.</p>'
    rows = []
    for i, c in enumerate(d["captains"]):
        p = c["s"]["p"]
        tag = ["C", "V", "3rd"][min(i, 2)]
        rows.append(f'<div class="crow" title="{esc(", ".join(c["why"]))}"><span class="tag">{tag}</span>'
                    f'<strong>{esc(p["web_name"])}</strong><span class="strip">{fixtures_html(c["games"])}</span>'
                    f'<span class="val">{float(p["ep_next"] or 0):.1f}<small>xP</small></span></div>')
    return "".join(rows)


def prices_html(d):
    moving = [s for s in d["squad"] if price_label(s["price"])]
    if not moving:
        return '<p class="ok">No price moves expected for your players.</p>'
    rows = []
    for s in moving:
        pr = s["price"]
        direction = pr["likely"] or ("rise" if pr["change"] > 0 else "fall")
        bits = []
        if pr["change"]:
            moved = "rise" if pr["change"] > 0 else "fall"
            bits.append(f'<span class="price {moved}">{"+" if pr["change"] > 0 else "−"}{abs(pr["change"]) / 10:.1f}</span>')
        if pr["likely"]:
            bits.append(f'<span class="price {pr["likely"]}">likely {pr["likely"]}</span>')
        rows.append(f'<div class="crow" title="Net transfers this GW: {pr["net"]:+,}">'
                    f'<span class="price {direction}">{"▲" if direction == "rise" else "▼"}</span>'
                    f'<strong>{esc(s["p"]["web_name"])}</strong><span class="meta">{money(s["p"]["now_cost"])}</span>'
                    f'<span class="val">{" · ".join(bits)}</span></div>')
    return "".join(rows)


def duo_html(d):
    """Captain picks and price watch side by side: a header row then three rows each."""
    caps = []
    for i, c in enumerate(d["captains"][:3]):
        p = c["s"]["p"]
        fx = ", ".join(f'{o} ({"H" if h else "A"})' for _, games in c["games"] for o, h, _ in games)
        caps.append(f'<div class="dcell" title="{esc(p["web_name"])} v {esc(fx)} · {esc(", ".join(c["why"]))}">'
                    f'<span class="tag">{["C", "V", "3rd"][i]}</span><strong>{esc(p["web_name"])}</strong>'
                    f'<span class="val">{float(p["ep_next"] or 0):.1f}<small>xP</small></span></div>')

    moving = sorted((s for s in d["squad"] if price_label(s["price"])), key=lambda s: -abs(s["price"]["net"]))
    prices = []
    for i, s in enumerate(moving[:3]):
        pr = s["price"]
        direction = pr["likely"] or ("rise" if pr["change"] > 0 else "fall")
        change = (f'<span class="price {"rise" if pr["change"] > 0 else "fall"}">{"+" if pr["change"] > 0 else "−"}'
                  f'{abs(pr["change"]) / 10:.1f}</span>') if pr["change"] else ""
        tip = (f'{s["p"]["web_name"]} {money(s["p"]["now_cost"])} · {price_label(pr)} · '
               f'net transfers {pr["net"]:+,}')
        if i == 2 and len(moving) > 3:
            tip += " · also: " + ", ".join(f'{m["p"]["web_name"]} ({price_label(m["price"])})' for m in moving[3:])
        prices.append(f'<div class="dcell" title="{esc(tip)}"><span class="price {direction}">{"▲" if direction == "rise" else "▼"}</span>'
                      f'<strong>{esc(s["p"]["web_name"])}</strong><span class="val">{change}</span></div>')
    if not prices:
        prices.append('<div class="dcell meta">No moves expected</div>')
    if not caps:
        caps.append('<div class="dcell meta">No fit starters</div>')

    cells = ['<div class="dhead">Captain</div>',
             f'<div class="dhead">Price watch{f" <span class=meta>+{len(moving) - 3}</span>" if len(moving) > 3 else ""}</div>']
    for i in range(3):
        cells.append(caps[i] if i < len(caps) else '<div class="dcell"></div>')
        cells.append(prices[i] if i < len(prices) else '<div class="dcell"></div>')
    return f'<div class="box duo">{"".join(cells)}</div>'


def leagues_html(d, team_id):
    if not d["leagues"]:
        return ""
    players, teams = d["players"], d["teams"]
    out = ['<h2>Mini-leagues</h2>']
    for lg in d["leagues"]:
        leader = lg["rows"][0]["total"] if lg["rows"] else 0
        rows = []
        for r in lg["rows"]:
            move = r["last_rank"] - r["rank"] if r.get("last_rank") else 0
            arrow = f'<span class="up">▲{move}</span>' if move > 0 else (f'<span class="down">▼{-move}</span>' if move < 0 else "")
            rows.append(f'<tr class="{"me" if r["entry"] == team_id else ""}" data-entry="{r["entry"]}"><td>{r["rank"]}{arrow}</td>'
                        f'<td class="team" title="{esc(r["player_name"])}">{chip_badge(lg, r["entry"])}{esc(r["entry_name"])}</td>'
                        f'<td>{r["event_total"]}</td><td>{r["total"]}</td><td>{r["total"] - leader or ""}</td></tr>')
        n = max(lg["rivals"], 1)
        targets = "".join(
            f'<span class="pchip" title="{esc(players[el]["web_name"])} · {money(players[el]["now_cost"])} · started by {c} of {lg["rivals"]} rivals">'
            f'{esc(players[el]["web_name"])} <b>{c * 100 // n}%</b></span>'
            for c, el in lg["targets"]) or "–"
        caps = "".join(f'<span class="pchip" title="Captained by {c} of {lg["rivals"]} rivals">{esc(players[el]["web_name"])} <b>{c}</b></span>'
                       for c, el in lg["captained"]) or "–"
        diffs = "".join(f'<span class="pchip">{esc(players[el]["web_name"])}</span>' for el in lg["differentials"]) or "–"
        h2h = h2h_html(d, lg, team_id)
        me = lg["me"]
        pos = f'You are {me["rank"]} of {len(lg["rows"])}{"+" if lg["more"] else ""}' if me else ""
        out.append(f"""
        <details class="league" open>
          <summary><strong>{esc(lg['name'])}</strong> <span class="meta">{pos}</span></summary>
          <div class="tablewrap"><table class="compact">
            <thead><tr><th>#</th><th>Team</th><th>GW</th><th>Total</th><th>Gap</th></tr></thead>
            <tbody>{''.join(rows)}</tbody>
          </table></div>
          {h2h}
          <div class="groups summary-groups">
            <div class="glabel" title="Players your rivals started in GW{d['current_gw']} that you don't own, with the share of rivals starting them">Rivals have</div><div class="chips">{targets}</div>
            <div class="glabel" title="Who your rivals captained in GW{d['current_gw']}">Their C</div><div class="chips">{caps}</div>
            <div class="glabel" title="Your starters owned by {int(DIFFERENTIAL_SHARE * 100)}% or fewer of your rivals">Your diffs</div><div class="chips">{diffs}</div>
          </div>
        </details>""")
    return "".join(out)


def abbrev(name):
    """Three capital letters for a player: Haaland -> HAA, B.Fernandes -> FER, João Pedro -> JOA."""
    import unicodedata
    special = str.maketrans({"Ø": "O", "ø": "o", "Æ": "AE", "æ": "ae", "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "ß": "ss", "ı": "i"})
    plain = unicodedata.normalize("NFKD", name.split(".")[-1].translate(special)).encode("ascii", "ignore").decode()
    letters = "".join(ch for ch in plain if ch.isalpha())
    return letters[:3].upper() or name[:3]


def chip_badge(lg, entry_id):
    """'BB' / 'TC' / 'FH' / 'WC' badge when that manager is playing a chip this gameweek."""
    name = (lg.get("meta", {}).get(entry_id) or {}).get("chip")
    if not name:
        return ""
    label = chips.CHIP_NAMES.get(name, name)
    return f'<span class="chipbadge" title="Playing {esc(label)} this gameweek">{esc(chips.CHIP_SHORT.get(name, name))}</span>'


def chips_left(lg, entry_id):
    left = (lg.get("meta", {}).get(entry_id) or {}).get("left", [])
    return " ".join(chips.CHIP_SHORT.get(n, n) for n in left) or "none"


def chip_grid(lg, entry_id):
    """Chips left as a tiny 2x2 block of letters; used ones are blank."""
    left = set((lg.get("meta", {}).get(entry_id) or {}).get("left", []))
    cells = "".join(f'<i>{chips.CHIP_SHORT[n] if n in left else ""}</i>' for n in ("bboost", "3xc", "freehit", "wildcard"))
    names = ", ".join(chips.CHIP_NAMES[n] for n in chips.CHIP_NAMES if n in left) or "none"
    return f'<span class="cgrid" title="Chips left: {esc(names)}">{cells}</span>'


def h2h_html(d, lg, team_id):
    """Side-by-side squad comparison with every rival, chosen from a dropdown."""
    me = lg["me"]
    if not me or not lg["squads"]:
        return ""
    players, teams = d["players"], d["teams"]
    mine = [s["pick"] for s in d["squad"]]
    rows = [r for r in lg["rows"] if r["entry"] in lg["squads"]]
    i = lg["rows"].index(me)
    default = (lg["rows"][i - 1] if i > 0 else lg["rows"][min(i + 1, len(lg["rows"]) - 1)])["entry"]
    if default not in lg["squads"]:
        default = rows[0]["entry"]

    def chip(el, *picks):
        """A small player chip; captain badge, faded if benched, live points when matches are on."""
        p = players[el]
        caps = [who for who, pk in picks if pk["is_captain"]]
        benched = [who for who, pk in picks if pk["multiplier"] == 0]
        badge = ""
        if caps:
            badge = ' <span class="badge">C</span>' + (f'<small>{caps[0]}</small>' if len(picks) > 1 and len(caps) == 1 else "")
        tip = f'{p["web_name"]} · {POS_SHORT[p["element_type"]]} · {teams[p["team"]]["name"]}'
        if caps:
            tip += " · captain" + (f" ({caps[0]})" if len(picks) > 1 and len(caps) == 1 else "")
        if benched:
            tip += " · bench" + (f" ({benched[0]})" if len(picks) > 1 and len(benched) == 1 else "")
        live_pts = f' <b>{d["live"]["pts"].get(el, {"pts": 0})["pts"]}</b>' if d["live"] else ""
        faded = " off" if len(benched) == len(picks) else ""
        return f'<span class="pchip{faded}" title="{esc(tip)}">{esc(p["web_name"])}{badge}{live_pts}</span>'

    options, panels = [], []
    for r in rows:
        c = head_to_head(mine, lg["squads"][r["entry"]], players)
        gap = me["total"] - r["total"]
        standing = f"{gap} ahead" if gap > 0 else (f"{-gap} behind" if gap < 0 else "level")
        options.append(f'<option value="{r["entry"]}"{" selected" if r["entry"] == default else ""}>'
                       f'{r["rank"]}. {esc(r["entry_name"])}</option>')
        group = lambda label, els, fn: (f'<div class="glabel">{label} <span class="meta">{len(els)}</span></div>'
                                        f'<div class="chips">{"".join(fn(el) for el in els) or "–"}</div>')
        panels.append(f"""
          <div class="h2h-panel" data-entry="{r['entry']}"{"" if r["entry"] == default else " hidden"}>
            <p class="meta" title="Expected points next GW if neither team changes">You're {standing} · next GW xP you {c['exp_me']:.0f}, them {c['exp_them']:.0f}</p>
            <p class="meta" title="Chips still available this half of the season">{chip_badge(lg, r["entry"]) + " this GW · " if chip_badge(lg, r["entry"]) else ""}Chips left: them <b>{chips_left(lg, r["entry"])}</b> · you <b>{chips_left(lg, team_id)}</b></p>
            <div class="groups">
              {group("You", c["mine"], lambda el: chip(el, ("", c["a"][el])))}
              {group("Both", c["both"], lambda el: chip(el, ("you", c["a"][el]), ("them", c["b"][el])))}
              {group("Them", c["theirs"], lambda el: chip(el, ("", c["b"][el])))}
            </div>
          </div>""")
    return f"""
          <div class="h2h">
            <label><strong>vs</strong> <select class="h2h-select">{''.join(options)}</select></label>
            {''.join(panels)}
          </div>"""


def live_html(d, team_id):
    lv = d["live"]
    if not lv:
        return ""
    players, teams = d["players"], d["teams"]
    me = lv["me"]
    status_word = {"done": "", "playing": " playing", "todo": " to play"}
    xi = []
    for s in d["squad"]:
        el = s["p"]["id"]
        m = me["mult"].get(el, 0)
        p = lv["pts"].get(el, {"pts": 0, "mins": 0})
        st = lv["status"].get(s["p"]["team"], "done")
        cls = "pchip" + (" off" if m == 0 else "") + (" on" if st == "playing" else "")
        badge = ' <span class="badge">C</span>' if el == me["captain"] else ""
        xi.append(f'<span class="{cls}" title="{esc(s["p"]["web_name"])}: {p["pts"]} pts, {p["mins"]} mins{status_word[st]}">'
                  f'{esc(s["p"]["web_name"])}{badge} <b>{p["pts"] * max(m, 1)}</b></span>')
    tables = []
    for t in lv["tables"]:
        rows = []
        for r in t["rows"]:
            move = r["rank"] - r["live_rank"]
            arrow = f'<span class="up">▲{move}</span>' if move > 0 else (f'<span class="down">▼{-move}</span>' if move < 0 else "")
            cap = players[r["live"]["captain"]]["web_name"] if r["live"]["captain"] else "–"
            rows.append(f'<tr class="{"me" if r["entry"] == team_id else ""}"><td>{r["live_rank"]}{arrow}</td>'
                        f'<td class="team" title="{esc(r["player_name"])}">{chip_badge(t, r["entry"])}{esc(r["entry_name"])}</td>'
                        f'<td class="cap" title="Captain: {esc(cap)}">{esc(abbrev(cap))} <b>{r["live"]["captain_pts"]}</b></td>'
                        f'<td>{r["live"]["pts"]}</td><td>{r["live_total"]}</td><td>{r["live"]["left"]}</td>'
                        f'<td>{chip_grid(t, r["entry"])}</td></tr>')
        tables.append(f"""
          <div class="tablewrap"><table class="compact live-t" title="{esc(t['name'])} live table">
            <thead><tr><th>#</th><th>Team</th><th>Capt</th><th>GW</th><th>Tot</th><th title="Players still to play">Pl</th><th title="Chips left">Chips</th></tr></thead>
            <tbody>{''.join(rows)}</tbody></table></div>""")
    return f"""
  <section class="live">
    <h2>{'<span class="pulse"></span>' if lv['playing'] else ''}GW{lv['gw']} live</h2>
    <div class="box">
      <p class="liveline"><strong>{me['pts']}</strong> pts <span class="meta">· {me['left']} to play · updated <time data-hm="{lv['updated']}">{lv['updated'][11:16]}</time></span></p>
      <div class="chips livexi">{''.join(xi)}</div>
      {''.join(tables)}
    </div>
  </section>"""


def chips_html(d):
    """Chips in a 2x2 grid: each chip's best week and chance, or 'Hold'."""
    if not d["chip_plan"]:
        return '<div class="box duo"><div class="dhead span">Chips</div><div class="dcell meta">None left right now</div></div>'
    targets = {"bboost": f"bench scores {chips.BB_TARGET}+", "3xc": f"captain scores {chips.TC_TARGET}+",
               "freehit": f"{chips.FH_TARGET}+ pts more than your team"}
    cells = []
    for c in d["chip_plan"]:
        code = chips.CHIP_SHORT.get(c["name"], c["name"])
        if c["name"] == "wildcard":
            tip = f'Wildcard (use by GW{c["stop"]}): {c["verdict"]}' + (
                f' – {", ".join(c["problems"])} need replacing' if c["problems"] else "")
            value = "Play" if c["verdict"].startswith("Good") else ("Maybe" if c["verdict"].startswith("Worth") else "Hold")
            cells.append(f'<div class="dcell" title="{esc(tip)}"><span class="tag">{code}</span>'
                         f'<span class="val">{value}</span></div>')
            continue
        top = [r for r in sorted(c["rows"], key=lambda r: (r["chance"], r["ev"]), reverse=True)[:2]
               if r["chance"] >= chips.HOLD_BELOW]
        tip = f'{c["label"]} (use by GW{c["stop"]}): % chance {targets[c["name"]]}. '
        if top:
            tip += " · ".join(f'GW{r["gw"]} {r["chance"] * 100:.0f}% ({r["ev"]:.1f} xP{", " + r["note"] if r["note"] else ""})' for r in top)
            value = f'<span class="best">GW{top[0]["gw"]}</span> {top[0]["chance"] * 100:.0f}%'
        else:
            tip += "No strong week in the next 8 gameweeks."
            value = '<span class="meta">Hold</span>'
        cells.append(f'<div class="dcell" title="{esc(tip)}"><span class="tag">{code}</span>'
                     f'<span class="val">{value}</span></div>')
    return f'<div class="box duo chipduo"><div class="dhead span">Chips · best week</div>{"".join(cells)}</div>'


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def short_num(n):
    """3712754 -> 3.71m, 507977 -> 508k."""
    n = abs(n)
    if n >= 1_000_000:
        return f"{n / 1_000_000:.2f}m"
    if n >= 10_000:
        return f"{n / 1000:.0f}k"
    return f"{n:,}"


def movement(up):
    """Green ▲ / red ▼ for a rank change (positive = moved up)."""
    if not up:
        return '<span class="same">–</span>'
    return f'<span class="{"up" if up > 0 else "down"}">{"▲" if up > 0 else "▼"}{short_num(up)}</span>'


def ranks_html(d, team_id):
    """Overall and mini-league rank pills, each with last gameweek's movement."""
    pills = []
    gws = [g for g in (d.get("history") or {}).get("current", []) if g.get("overall_rank")]
    rank = gws[-1]["overall_rank"] if gws else d["entry"].get("summary_overall_rank")
    if rank:
        up = gws[-2]["overall_rank"] - gws[-1]["overall_rank"] if len(gws) > 1 else 0
        pills.append(f'<span class="pill rank" title="Overall rank {rank:,}">OR {short_num(rank)} {movement(up)}</span>')
    for lg in d["leagues"]:
        me = lg["me"]
        if me:
            up = me["last_rank"] - me["rank"] if me.get("last_rank") else 0
            pills.append(f'<span class="pill rank" title="{esc(lg["full_name"])}">{esc(lg["name"])} {ordinal(me["rank"])}/{len(lg["rows"])} {movement(up)}</span>')
    return "".join(pills)


def render(d, team_id):
    entry, teams = d["entry"], d["teams"]
    counts = {"red": 0, "amber": 0, "green": 0}
    for s in d["squad"]:
        counts[s["flag"]] += 1


    if d["ideas"]:
        idea_rows = []
        for idea in d["ideas"]:
            out = idea["out"]
            why = "; ".join(out["reasons"])
            if idea["options"]:
                _, p, runs = idea["options"][0]
                others = ", ".join(f'{o["web_name"]} {money(o["now_cost"])}' for _, o, _ in idea["options"][1:])
                tip = f'Sell: {why}. Budget {money(idea["budget"])}.' + (f' Also: {others}.' if others else "")
                target = (f'<strong>{esc(p["web_name"])}</strong><span class="meta">{money(p["now_cost"])}</span>'
                          f'<span class="strip val">{fixtures_html(runs)}</span>')
            else:
                tip = f'Sell: {why}. No fit alternatives within {money(idea["budget"])}.'
                target = '<span class="meta val">no option in budget</span>'
            idea_rows.append(f'<div class="crow idea flag-{out["flag"]}" title="{esc(tip)}">'
                             f'<span class="out">{esc(out["p"]["web_name"])}</span><span class="arrow">→</span>{target}</div>')
        ideas = "".join(idea_rows)
    else:
        ideas = '<div class="crow meta">No urgent transfers – squad looks healthy</div>'

    nxt = d["next_event"]
    deadline = (f'<div class="deadline">⏰ GW{nxt["id"]} deadline <time data-iso="{esc(nxt["deadline_time"])}">'
                f'{esc(nxt["deadline_time"])}</time> <span class="countdown" data-until="{esc(nxt["deadline_time"])}"></span></div>') if nxt else ""
    chip = f' · Chip: {esc(d["chip"])}' if d["chip"] else ""
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manager = f'{entry.get("player_first_name", "")} {entry.get("player_last_name", "")}'.strip()

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(entry.get('name', 'FPL'))} · Team News</title>
<style>
:root {{
  --bg:#f5f6f8; --card:#fff; --text:#1b1d22; --muted:#667085; --line:#e4e7ec;
  --red:#d92d20; --amber:#f79009; --green:#12b76a; --accent:#37003c; --hl:#f4ebff;
  --d1:#147d1b; --d2:#5fd16b; --d3:#e7e7e7; --d4:#ff4a6b; --d5:#80072d;
}}
@media (prefers-color-scheme: dark) {{
  :root {{ --bg:#101216; --card:#1a1d23; --text:#eceef2; --muted:#98a2b3; --line:#2b3039; --d3:#3a3f48; --hl:#2d1f3d; }}
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--text); }}
header {{ background:var(--accent); color:#fff; padding:10px 16px 12px; }}
header h1 {{ margin:0; font-size:1.15rem; line-height:1.3; }}
header h1 span {{ font-size:.8rem; font-weight:400; opacity:.8; margin-left:4px; white-space:nowrap; }}
main {{ max-width:1100px; margin:0 auto; padding:16px; }}
.summary {{ display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 0; }}
.pill {{ background:rgba(255,255,255,.15); border-radius:99px; padding:2px 9px; font-size:.8rem; white-space:nowrap; }}
.deadline {{ background:#00ff87; color:#1b1d22; font-weight:700; text-align:center; padding:6px 12px; font-size:.9rem; }}
.countdown {{ font-weight:400; white-space:nowrap; }}
h2 {{ font-size:.95rem; margin:18px 0 6px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }}
h4 {{ margin:14px 0 4px; font-size:.95rem; }}
.grid {{ display:grid; gap:10px; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }}
.card, .box {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; border-left:5px solid var(--green); }}
.box {{ border-left-color:var(--accent); }}
.card.flag-amber {{ border-left-color:var(--amber); }}
.card.flag-red {{ border-left-color:var(--red); }}
.row {{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }}
.top h3 {{ margin:0; font-size:1.05rem; flex:1; }}
.dot {{ width:10px; height:10px; border-radius:50%; background:var(--green); display:inline-block; flex:none; margin-right:4px; }}
.flag-amber .dot, .dot.flag-amber {{ background:var(--amber); }}
.flag-red .dot, .dot.flag-red {{ background:var(--red); }}
.badge {{ background:var(--text); color:var(--card); font-size:.7rem; border-radius:4px; padding:0 5px; margin-left:6px; vertical-align:middle; }}
.bench {{ font-size:.75rem; color:var(--muted); border:1px solid var(--line); border-radius:4px; padding:0 5px; }}
.tag {{ font-size:.75rem; background:var(--accent); color:#fff; border-radius:4px; padding:1px 6px; }}
.meta {{ color:var(--muted); font-size:.85rem; }}
.news {{ margin:8px 0 0; font-size:.9rem; }}
.price {{ margin:6px 0 0; font-size:.85rem; font-weight:600; }}
.price.rise, .up {{ color:var(--green); }} .price.fall, .down {{ color:var(--red); }}
.up, .down {{ font-size:.7rem; margin-left:3px; }}
.reasons {{ margin:6px 0 0; padding-left:18px; font-size:.85rem; color:var(--muted); }}
.strips {{ margin-top:10px; gap:16px; align-items:flex-start; }}
.lbl {{ font-size:.75rem; color:var(--muted); }}
.strip {{ display:flex; gap:3px; margin-top:3px; flex-wrap:wrap; }}
.pts, .fx {{ min-width:28px; text-align:center; border-radius:5px; font-size:.8rem; padding:2px 4px; font-weight:600; }}
.pts {{ background:var(--line); }}
.pts.none {{ opacity:.45; }}
.fx small {{ font-weight:400; margin-left:2px; opacity:.8; }}
.fx.d1 {{ background:var(--d1); color:#fff; }} .fx.d2 {{ background:var(--d2); color:#0b2d0e; }}
.fx.d3 {{ background:var(--d3); color:var(--text); }} .fx.d4 {{ background:var(--d4); color:#fff; }}
.fx.d5 {{ background:var(--d5); color:#fff; }} .fx.blank {{ background:transparent; border:1px dashed var(--muted); color:var(--muted); }}
.plain {{ margin:4px 0; padding-left:18px; }} .plain li {{ margin-bottom:4px; }}
.ok {{ margin:0; }}
.cols {{ display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); }}
.cols h2 {{ margin-top:0; }}
.league {{ background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; margin-bottom:10px; }}
.league summary {{ cursor:pointer; }}
.league p {{ margin:8px 0 0; }}
.tablewrap {{ overflow-x:auto; margin-top:10px; }}
table {{ width:100%; border-collapse:collapse; font-size:.9rem; }}
th, td {{ text-align:left; padding:6px; border-bottom:1px solid var(--line); vertical-align:top; }}
th:nth-child(n+3), td:nth-child(n+3) {{ text-align:right; }}
tr.me td {{ background:var(--hl); font-weight:600; }}
.crow {{ display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid var(--line); font-size:.9rem; }}
.crow:last-child {{ border-bottom:0; }}
.crow strong {{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }}
.crow .strip {{ margin:0; flex:none; }}
.crow .fx {{ font-size:.7rem; padding:1px 4px; min-width:0; }}
.crow .val {{ margin-left:auto; white-space:nowrap; font-weight:600; }}
.crow .val small {{ font-weight:400; color:var(--muted); margin-left:1px; }}
.crow .tag {{ flex:none; min-width:26px; text-align:center; }}
.crow .price {{ margin:0; }}
.h2h {{ margin-top:14px; border-top:1px solid var(--line); padding-top:12px; }}
.h2h select {{ font:inherit; padding:4px 6px; border-radius:6px; border:1px solid var(--line); background:var(--card); color:var(--text); max-width:100%; }}
tr[data-entry] {{ cursor:pointer; }}
.liveline {{ margin:0 0 6px; }} .liveline strong {{ font-size:1.5rem; line-height:1; }}
.pchip.on, .pts.on {{ outline:2px solid var(--green); outline-offset:-2px; }}
.livexi {{ margin-bottom:4px; }}
.pulse {{ display:inline-block; width:9px; height:9px; border-radius:50%; background:var(--red); margin-right:6px; animation:pulse 1.5s infinite; }}
@keyframes pulse {{ 50% {{ opacity:.25; }} }}
header .up {{ color:#00ff87; }} header .down {{ color:#ff6b81; }} header .same {{ opacity:.6; }}
header .up, header .down {{ font-size:.8rem; font-weight:700; margin-left:2px; }}
.pill.rank {{ background:rgba(255,255,255,.22); font-weight:600; }}
.squad {{ padding:8px 12px; margin-top:16px; }}
.squad .dhead {{ border:0; padding:0; }}
.prow.posfirst {{ border-top:2px solid var(--muted); }}
.prow {{ display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:2px 8px; align-items:center;
  padding:4px 0 4px 9px; border-bottom:1px solid var(--line); border-left:3px solid var(--green); margin-left:-12px; }}
.prow.flag-amber {{ border-left-color:var(--amber); }} .prow.flag-red {{ border-left-color:var(--red); }}
.prow.head {{ border:0; padding-top:2px; padding-bottom:0; }}
.prow .name {{ display:flex; align-items:center; min-width:0; font-size:.85rem; }}
.prow .name strong {{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }}
.prow .name .badge, .prow .name .bench {{ flex:none; }}
.prow .name .meta {{ font-size:.75rem; }}
.prow .strip {{ margin:0; gap:2px; flex-wrap:nowrap; }}
.prow .pts, .prow .fx {{ min-width:20px; font-size:.7rem; padding:1px 3px; }}
.prow .fx small {{ display:none; }}
.prow .note {{ grid-column:1 / -1; font-size:.75rem; color:var(--muted); line-height:1.25; }}
.squad .badge {{ margin-left:3px; }} .squad .bench {{ margin-left:3px; padding:0 3px; font-size:.65rem; }}
table.compact th, table.compact td {{ padding:5px 4px; white-space:nowrap; }}
table.compact td.team {{ width:100%; max-width:0; overflow:hidden; text-overflow:ellipsis; }}
table.compact td.cap {{ text-align:left; color:var(--muted); font-size:.75rem; }}
table.live-t th, table.live-t td {{ padding:5px 3px; }}
table.compact td.cap b {{ color:var(--text); }}
table.compact th:nth-child(3) {{ text-align:left; }}
.tbox {{ padding:8px 12px; margin-top:16px; }}
.tbox .dhead .meta {{ text-transform:none; letter-spacing:0; font-weight:400; }}
.tbox .crow {{ font-size:.85rem; padding:5px 0 5px 7px; }}
.crow.idea {{ border-left:3px solid var(--green); padding-left:7px; margin-left:-10px; }}
.crow.idea.flag-amber {{ border-left-color:var(--amber); }} .crow.idea.flag-red {{ border-left-color:var(--red); }}
.crow.idea .out {{ color:var(--muted); text-decoration:line-through; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }}
.crow.idea .arrow {{ color:var(--muted); flex:none; }}
.crow.idea strong {{ flex:none; }}
.crow.idea .meta {{ flex:none; font-size:.78rem; }}
.crow .fx small {{ display:none; }}
.tip {{ position:fixed; left:12px; right:12px; bottom:16px; z-index:10; background:var(--text); color:var(--bg);
  padding:10px 14px; border-radius:10px; font-size:.9rem; box-shadow:0 4px 16px rgba(0,0,0,.3); max-width:560px; margin:0 auto; }}
[title] {{ cursor:pointer; -webkit-tap-highlight-color:transparent; }}
.groups {{ display:grid; grid-template-columns:auto 1fr; gap:6px 8px; align-items:start; margin-top:6px; }}
.glabel {{ font-size:.75rem; font-weight:700; padding-top:3px; white-space:nowrap; }}
.chips {{ display:flex; flex-wrap:wrap; gap:3px; }}
.pchip {{ background:var(--line); border-radius:5px; padding:1px 6px; font-size:.78rem; white-space:nowrap; }}
.pchip b {{ margin-left:2px; }}
.pchip .badge {{ font-size:.6rem; padding:0 3px; margin-left:3px; }}
.pchip small {{ font-size:.6rem; color:var(--muted); margin-left:1px; }}
.pchip.off {{ opacity:.5; }}
.h2h-panel p {{ margin:6px 0 0; }}
.summary-groups {{ border-top:1px solid var(--line); margin-top:10px; padding-top:8px; }}
.chipbadge {{ background:#00ff87; color:#1b1d22; font-size:.65rem; font-weight:800; border-radius:4px; padding:1px 4px; margin-right:5px; vertical-align:1px; }}
.cgrid {{ display:inline-grid; grid-template-columns:repeat(2, 1.4em); gap:1px; vertical-align:middle; }}
.cgrid i {{ font-style:normal; font-size:.55rem; font-weight:700; line-height:1.3; text-align:center; border-radius:2px; background:var(--line); min-height:1.3em; }}
.cgrid i:empty {{ background:transparent; outline:1px dashed var(--line); outline-offset:-1px; }}
.duo {{ display:grid; grid-template-columns:1fr 1fr; column-gap:12px; padding:8px 12px; margin-top:16px; }}
.dhead.span {{ grid-column:1 / -1; }}
.chipduo .val .best {{ color:var(--green); }}
.chipduo .tag {{ font-size:.75rem; padding:1px 6px; }}
.dhead {{ font-size:.72rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; padding-bottom:2px; border-bottom:1px solid var(--line); }}
.dcell {{ display:flex; align-items:center; gap:5px; min-width:0; padding:5px 0; border-bottom:1px solid var(--line); font-size:.85rem; }}
.duo .dcell:nth-last-child(-n+2) {{ border-bottom:0; }}
.dcell strong {{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }}
.dcell .val {{ margin-left:auto; white-space:nowrap; font-weight:600; }}
.dcell .val small {{ font-weight:400; color:var(--muted); margin-left:1px; font-size:.7rem; }}
.dcell .tag {{ flex:none; font-size:.65rem; padding:1px 4px; }}
.dcell .price {{ margin:0; flex:none; }}
footer {{ color:var(--muted); font-size:.8rem; text-align:center; padding:24px 16px 40px; }}
</style>
</head>
<body>
{deadline}
<header>
  <h1>{esc(entry.get('name', 'My FPL Team'))} <span>{esc(manager)} · GW{d['current_gw']} squad{chip} · {money(d['bank'])} in bank</span></h1>
  <div class="summary">
    {ranks_html(d, team_id)}
    <span class="pill" title="out / doubtful / fine">🔴{counts['red']} 🟠{counts['amber']} 🟢{counts['green']}</span>
  </div>
</header>
<main>
  {live_html(d, team_id)}
  {duo_html(d)}
  {chips_html(d)}
  <div class="box tbox"><div class="dhead">Transfer ideas <span class="meta">sell → buy</span></div>{ideas}</div>
  {squad_html(d)}
  {leagues_html(d, team_id)}
</main>
<footer>
  Data from the official Fantasy Premier League site. Updated <time data-iso="{updated}">{updated}</time>.<br>
  Tap a player, pick, price or transfer for more details.<br>
  Live scores include provisional bonus, auto-subs and transfer hits. Green outline = playing now, faded = not
  counting (bench or subbed off). Pl = players still to play, Chips = chips left.<br>
  Chip % = estimated chance it pays off: Bench Boost bench 15+, Triple Captain captain 12+, Free Hit 12+ more than your team.<br>
  Fixture colours: dark green = easiest … dark red = hardest. Lowercase opponent = away.<br>
  Price predictions are estimates from this gameweek's transfers.<br>
  Chip chances are estimates from a simple simulation of your current squad – transfers, rotation and
  double gameweeks announced later will change them.
</footer>
<script>
document.querySelectorAll('time[data-iso]').forEach(function (t) {{
  var d = new Date(t.dataset.iso);
  if (!isNaN(d)) t.textContent = d.toLocaleString(undefined, {{weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}});
}});
{"setTimeout(function () { location.reload(); }, 5 * 60 * 1000);" if d["live"] and d["live"]["playing"] else ""}
// Phones don't show title tooltips, so tapping anything with details shows them in a small pop-up.
(function () {{
  var tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true;
  document.body.appendChild(tip);
  var timer;
  document.addEventListener('click', function (e) {{
    var el = e.target.closest('[title]');
    if (!el || !el.getAttribute('title')) {{ tip.hidden = true; return; }}
    tip.textContent = el.getAttribute('title');
    tip.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () {{ tip.hidden = true; }}, 6000);
  }});
}})();
document.querySelectorAll('time[data-hm]').forEach(function (t) {{
  var d = new Date(t.dataset.hm);
  if (!isNaN(d)) t.textContent = d.toLocaleTimeString(undefined, {{hour:'2-digit', minute:'2-digit'}});
}});
document.querySelectorAll('.countdown[data-until]').forEach(function (c) {{
  function tick() {{
    var ms = new Date(c.dataset.until) - new Date();
    if (isNaN(ms)) return;
    if (ms <= 0) {{ c.textContent = '· passed'; return; }}
    var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    c.textContent = '· ' + (d ? d + 'd ' + h + 'h' : (h ? h + 'h ' : '') + m + 'm') + ' to go';
  }}
  tick(); setInterval(tick, 30000);
}});
document.querySelectorAll('.league').forEach(function (lg) {{
  var sel = lg.querySelector('.h2h-select');
  if (!sel) return;
  function show(id) {{
    lg.querySelectorAll('.h2h-panel').forEach(function (p) {{ p.hidden = p.dataset.entry !== id; }});
  }}
  sel.addEventListener('change', function () {{ show(sel.value); }});
  lg.querySelectorAll('tr[data-entry]').forEach(function (tr) {{
    tr.addEventListener('click', function () {{
      if (!lg.querySelector('.h2h-panel[data-entry="' + tr.dataset.entry + '"]')) return;
      sel.value = tr.dataset.entry; show(sel.value);
      sel.scrollIntoView({{behavior: 'smooth', block: 'start'}});
    }});
  }});
}});
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", help="folder of saved API responses to use instead of the live API")
    ap.add_argument("--out", default="site/index.html")
    ap.add_argument("--email", choices=["auto", "force", "off"], default="auto",
                    help="auto = only on the morning of a deadline")
    ap.add_argument("--email-preview", help="also save the email to this file")
    ap.add_argument("--live-check", action="store_true", help="only report whether matches are on")
    args = ap.parse_args()

    team_id = int(os.environ.get("TEAM_ID") or DEFAULT_TEAM_ID)
    if args.live_check:
        source = Source(args.sample)
        current = next((e for e in source.get("bootstrap-static/")["events"] if e["is_current"]), None)
        on = bool(current) and live.matches_on(source.get(f"fixtures/?event={current['id']}"))
        print(f"Matches on: {on}")
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
                fh.write(f"live={'true' if on else 'false'}\n")
        return
    data = build(Source(args.sample), team_id)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(data, team_id), encoding="utf-8")
    print(f"Wrote {out} for team {team_id} ({len(data['squad'])} players, {len(data['ideas'])} transfer ideas, "
          f"{len(data['leagues'])} mini-leagues)")

    if args.email_preview:
        subject, body = email_digest.compose(data, team_id)
        Path(args.email_preview).write_text(body, encoding="utf-8")
        print(f"Email preview: {subject}")
    if args.email == "force" or (args.email == "auto" and email_digest.is_deadline_morning(data["next_event"])):
        email_digest.send(data, team_id)


if __name__ == "__main__":
    sys.exit(main())
