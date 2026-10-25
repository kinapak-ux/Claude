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


def mini_leagues(source, entry, team_id, gw, squad):
    """Standings plus rival ownership for each private classic league."""
    mine_xi = {s["p"]["id"] for s in squad if s["pick"]["multiplier"] > 0}
    mine_all = {s["p"]["id"] for s in squad}
    leagues = []
    for lg in (entry.get("leagues") or {}).get("classic", []):
        if lg.get("league_type") != "x":  # private leagues only
            continue
        try:
            data = source.get(f"leagues-classic/{lg['id']}/standings/")
        except LookupError:
            continue
        rows = data["standings"]["results"][:MAX_RIVALS]
        owned, captained, rivals = {}, {}, 0
        for r in rows:
            if r["entry"] == team_id:
                continue
            try:
                picks = source.get(f"entry/{r['entry']}/event/{gw}/picks/")["picks"]
            except LookupError:
                continue  # joined after this gameweek
            rivals += 1
            for pk in picks:
                if pk["multiplier"] > 0:
                    owned[pk["element"]] = owned.get(pk["element"], 0) + 1
                if pk["is_captain"]:
                    captained[pk["element"]] = captained.get(pk["element"], 0) + 1
        targets = sorted(((n, el) for el, n in owned.items() if el not in mine_all), reverse=True)[:RIVAL_TARGETS]
        differentials = [el for el in mine_xi if rivals and owned.get(el, 0) / rivals <= DIFFERENTIAL_SHARE]
        me = next((r for r in rows if r["entry"] == team_id), None)
        leagues.append({
            "name": data["league"]["name"], "rows": rows, "me": me, "rivals": rivals,
            "more": data["standings"].get("has_next", False),
            "targets": targets, "captained": sorted(((n, el) for el, n in captained.items()), reverse=True)[:3],
            "differentials": differentials, "owned": owned,
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

    return {
        "entry": entry, "teams": teams, "players": players, "squad": squad, "ideas": ideas,
        "bank": bank, "current_gw": current_gw, "next_event": next_event,
        "past_gws": past_gws, "chip": picks_data.get("active_chip"),
        "captains": captain_picks(squad),
        "leagues": mini_leagues(source, entry, team_id, current_gw, squad),
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


def player_card(s, teams):
    p, pick = s["p"], s["pick"]
    badges = ""
    if pick.get("is_captain"):
        badges += '<span class="badge">C</span>'
    elif pick.get("is_vice_captain"):
        badges += '<span class="badge">V</span>'
    news = f'<p class="news">{esc(p["news"])}</p>' if p.get("news") else ""
    reasons = "".join(f"<li>{esc(r)}</li>" for r in s["reasons"])
    reasons = f'<ul class="reasons">{reasons}</ul>' if reasons else ""
    bench = "" if s["starter"] else '<span class="bench">Bench</span>'
    total5 = sum(f["pts"] for _, f in s["form"])
    pl = price_label(s["price"])
    direction = s["price"]["likely"] or ("rise" if s["price"]["change"] > 0 else "fall")
    price = f'<p class="price {direction}">{esc(pl)}</p>' if pl else ""
    return f"""
    <article class="card flag-{s['flag']}">
      <div class="row top">
        <span class="dot" aria-label="{s['flag']}"></span>
        <h3>{esc(p['web_name'])}{badges}</h3>
        {bench}
        <span class="meta">{esc(teams[p['team']]['short_name'])} · {money(p['now_cost'])}</span>
      </div>
      {news}{reasons}{price}
      <div class="row strips">
        <div><span class="lbl">Last {len(s['form'])} GWs · {total5} pts</span><div class="strip">{form_html(s['form'])}</div></div>
        <div><span class="lbl">Next {FIXTURES_AHEAD}</span><div class="strip">{fixtures_html(s['runs'])}</div></div>
      </div>
    </article>"""


def captains_html(d):
    if not d["captains"]:
        return '<p class="ok">No fit starters with a fixture next gameweek.</p>'
    items = []
    for i, c in enumerate(d["captains"]):
        p = c["s"]["p"]
        tag = ["Captain", "Vice", "Also consider"][min(i, 2)]
        items.append(f'<li><span class="tag">{tag}</span> <strong>{esc(p["web_name"])}</strong> '
                     f'<span class="meta">{esc(", ".join(c["why"]))}</span>'
                     f'<div class="strip">{fixtures_html(c["games"])}</div></li>')
    return f'<ol class="caps">{"".join(items)}</ol>'


def prices_html(d):
    moving = [s for s in d["squad"] if price_label(s["price"])]
    if not moving:
        return '<p class="ok">No price moves expected for your players.</p>'
    items = "".join(
        f'<li class="price {s["price"]["likely"] or ("rise" if s["price"]["change"] > 0 else "fall")}">'
        f'<strong>{esc(s["p"]["web_name"])}</strong> {money(s["p"]["now_cost"])} · {esc(price_label(s["price"]))} '
        f'<span class="meta">(net transfers {s["price"]["net"]:+,})</span></li>'
        for s in moving)
    return f'<ul class="plain">{items}</ul>'


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
            rows.append(f'<tr class="{"me" if r["entry"] == team_id else ""}"><td>{r["rank"]}{arrow}</td>'
                        f'<td>{esc(r["entry_name"])}<div class="meta">{esc(r["player_name"])}</div></td>'
                        f'<td>{r["event_total"]}</td><td>{r["total"]}</td><td>{r["total"] - leader or ""}</td></tr>')
        n = max(lg["rivals"], 1)
        targets = "".join(
            f'<li><strong>{esc(players[el]["web_name"])}</strong> <span class="meta">{esc(teams[players[el]["team"]]["short_name"])} · '
            f'{money(players[el]["now_cost"])} · started by {c} of {lg["rivals"]} ({c * 100 // n}%)</span></li>'
            for c, el in lg["targets"]) or "<li>None – you own everything they do.</li>"
        caps = ", ".join(f'{esc(players[el]["web_name"])} ({c})' for c, el in lg["captained"]) or "–"
        diffs = ", ".join(esc(players[el]["web_name"]) for el in lg["differentials"]) or "None"
        me = lg["me"]
        pos = f'You are {me["rank"]} of {len(lg["rows"])}{"+" if lg["more"] else ""}' if me else ""
        out.append(f"""
        <details class="league" open>
          <summary><strong>{esc(lg['name'])}</strong> <span class="meta">{pos}</span></summary>
          <div class="tablewrap"><table>
            <thead><tr><th>#</th><th>Team</th><th>GW</th><th>Total</th><th>Gap</th></tr></thead>
            <tbody>{''.join(rows)}</tbody>
          </table></div>
          <h4>Rivals own, you don't (GW{d['current_gw']} starters)</h4><ul class="plain">{targets}</ul>
          <p><strong>Rivals' captains:</strong> {caps}</p>
          <p><strong>Your differentials:</strong> {diffs} <span class="meta">(started by ≤{int(DIFFERENTIAL_SHARE * 100)}% of rivals)</span></p>
        </details>""")
    return "".join(out)


def render(d, team_id):
    entry, teams = d["entry"], d["teams"]
    counts = {"red": 0, "amber": 0, "green": 0}
    for s in d["squad"]:
        counts[s["flag"]] += 1

    sections = []
    for pos, title in POSITIONS.items():
        cards = "".join(player_card(s, teams) for s in d["squad"] if s["p"]["element_type"] == pos)
        sections.append(f'<section><h2>{title}</h2><div class="grid">{cards}</div></section>')

    if d["ideas"]:
        idea_html = []
        for idea in d["ideas"]:
            out = idea["out"]["p"]
            opts = "".join(
                f'<li><strong>{esc(p["web_name"])}</strong> <span class="meta">{esc(teams[p["team"]]["short_name"])} · '
                f'{money(p["now_cost"])} · form {esc(p["form"])}</span><div class="strip">{fixtures_html(runs)}</div></li>'
                for _, p, runs in idea["options"]
            ) or "<li>No available alternatives within budget.</li>"
            idea_html.append(f"""
            <div class="idea">
              <p class="sell"><span class="dot flag-{idea['out']['flag']}"></span>Consider selling
                <strong>{esc(out['web_name'])}</strong> <span class="meta">{POS_SHORT[out['element_type']]} · {esc('; '.join(idea['out']['reasons']))}</span></p>
              <p class="meta">Budget up to {money(idea['budget'])} (price + bank). Try:</p>
              <ol>{opts}</ol>
            </div>""")
        ideas = "".join(idea_html)
    else:
        ideas = '<p class="ok">No urgent transfers – your squad looks healthy.</p>'

    nxt = d["next_event"]
    deadline = (f'<p class="deadline">GW{nxt["id"]} deadline: <time data-iso="{esc(nxt["deadline_time"])}">'
                f'{esc(nxt["deadline_time"])}</time></p>') if nxt else ""
    chip = f' · Chip: {esc(d["chip"])}' if d["chip"] else ""
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manager = f'{entry.get("player_first_name", "")} {entry.get("player_last_name", "")}'.strip()
    rank = entry.get("summary_overall_rank")

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
header {{ background:var(--accent); color:#fff; padding:20px 16px; }}
header h1 {{ margin:0; font-size:1.4rem; }}
header p {{ margin:4px 0 0; opacity:.85; }}
main {{ max-width:1100px; margin:0 auto; padding:16px; }}
.summary {{ display:flex; gap:8px; flex-wrap:wrap; margin:12px 0 0; }}
.pill {{ background:rgba(255,255,255,.15); border-radius:99px; padding:3px 10px; font-size:.85rem; }}
.deadline {{ font-weight:600; }}
h2 {{ font-size:1.05rem; margin:24px 0 10px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }}
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
.idea + .idea {{ border-top:1px solid var(--line); margin-top:12px; padding-top:12px; }}
.idea p {{ margin:0 0 4px; }}
.idea ol, .caps {{ margin:6px 0 0; padding-left:20px; }}
.idea li, .caps li {{ margin-bottom:8px; }}
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
footer {{ color:var(--muted); font-size:.8rem; text-align:center; padding:24px 16px 40px; }}
</style>
</head>
<body>
<header>
  <h1>{esc(entry.get('name', 'My FPL Team'))}</h1>
  <p>{esc(manager)} · GW{d['current_gw']} squad{chip}{f' · Overall rank {rank:,}' if rank else ''}</p>
  <div class="summary">
    <span class="pill">🔴 {counts['red']} out</span>
    <span class="pill">🟠 {counts['amber']} doubtful</span>
    <span class="pill">🟢 {counts['green']} fine</span>
    <span class="pill">Bank {money(d['bank'])}</span>
  </div>
</header>
<main>
  {deadline}
  <div class="cols">
    <section><h2>Captain picks</h2><div class="box">{captains_html(d)}</div></section>
    <section><h2>Price watch</h2><div class="box">{prices_html(d)}</div></section>
  </div>
  <h2>Transfer ideas</h2>
  <div class="box">{ideas}</div>
  {''.join(sections)}
  {leagues_html(d, team_id)}
</main>
<footer>
  Data from the official Fantasy Premier League site. Updated <time data-iso="{updated}">{updated}</time>.<br>
  Fixture colours: dark green = easiest … dark red = hardest. Lowercase opponent = away.<br>
  Price predictions are estimates from this gameweek's transfers.
</footer>
<script>
document.querySelectorAll('time[data-iso]').forEach(function (t) {{
  var d = new Date(t.dataset.iso);
  if (!isNaN(d)) t.textContent = d.toLocaleString(undefined, {{weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}});
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
    args = ap.parse_args()

    team_id = int(os.environ.get("TEAM_ID") or DEFAULT_TEAM_ID)
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
