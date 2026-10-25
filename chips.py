"""Chip planner: estimates how likely each remaining chip is to pay off in
each of the coming gameweeks, and picks the best week to play it.

How it works (a rough model, not a guarantee):
  * Each player's expected points per fixture come from FPL's own projection
    (ep_next) for the next gameweek, and from form, points per game, fixture
    difficulty and fitness for later gameweeks. Double gameweeks count twice;
    blank gameweeks count zero.
  * Actual scores are simulated thousands of times around those expectations
    (FPL scores are spiky: mostly 1-3 points, sometimes a big haul).
  * "Chance" is the share of simulations where the chip hits its target below.
"""

import random

CHIP_LOOKAHEAD = 8      # gameweeks checked ahead
SIMULATIONS = 4000

# What counts as the chip "paying off".
BB_TARGET = 15          # Bench Boost: your 4 bench players score 15+ between them
TC_TARGET = 12          # Triple Captain: your captain scores 12+ (so the chip adds 12+)
FH_TARGET = 12          # Free Hit: 12+ more points than your own team would score
HOLD_BELOW = 0.10      # best week below this chance -> "hold it"
WC_FLAGGED = 4          # Wildcard: suggest it when this many players need replacing

FDR_MULTIPLIER = {1: 1.3, 2: 1.15, 3: 1.0, 4: 0.85, 5: 0.7}
CHIP_NAMES = {"bboost": "Bench Boost", "3xc": "Triple Captain", "freehit": "Free Hit", "wildcard": "Wildcard"}
CHIP_SHORT = {"bboost": "BB", "3xc": "TC", "freehit": "FH", "wildcard": "WC", "manager": "AM"}


def available_chips(boot, history, next_gw):
    """The current, unused window for each chip: [{name, label, stop}]."""
    used = [(c["name"], c["event"]) for c in (history or {}).get("chips", [])]
    windows = boot.get("chips") or [
        {"name": n, "start_event": s, "stop_event": e}
        for n in CHIP_NAMES for s, e in ((1, 19), (20, 38))
    ]
    out = {}
    for w in sorted(windows, key=lambda w: w["start_event"]):
        name = w["name"]
        if name not in CHIP_NAMES or name in out:
            continue
        if w["stop_event"] < next_gw or w["start_event"] > next_gw:
            continue
        if any(n == name and w["start_event"] <= gw <= w["stop_event"] for n, gw in used):
            continue
        out[name] = {"name": name, "label": CHIP_NAMES[name], "stop": w["stop_event"]}
    return [out[n] for n in CHIP_NAMES if n in out]


def fixture_difficulties(fixtures):
    """{(team_id, gw): [difficulty, ...]} for every scheduled fixture."""
    fx = {}
    for f in fixtures:
        if f.get("event"):
            fx.setdefault((f["team_h"], f["event"]), []).append(f["team_h_difficulty"])
            fx.setdefault((f["team_a"], f["event"]), []).append(f["team_a_difficulty"])
    return fx


def fixture_means(p, gw, next_gw, fx):
    """Expected points for each of a player's fixtures in a gameweek."""
    fdrs = fx.get((p["team"], gw), [])
    if not fdrs:
        return []
    if gw == next_gw and p.get("ep_next") is not None:
        total = float(p["ep_next"])
        return [total / len(fdrs)] * len(fdrs)
    base = 0.7 * float(p.get("form") or 0) + 0.3 * float(p.get("points_per_game") or 0)
    fit = {"a": 1.0, "d": 0.75}.get(p["status"], 0.4)
    return [base * FDR_MULTIPLIER.get(d, 1.0) * fit for d in fdrs]


def simulate(means, rng):
    """One simulated score: each fixture's points drawn around its expectation."""
    return sum(rng.expovariate(1 / m) for m in means if m > 0.05)


def chance(samples, target):
    return sum(1 for s in samples if s >= target) / len(samples)


def plan(squad, players, fixtures, next_gw, last_gw, chips_left, flagged):
    """Per-chip estimates for each upcoming gameweek, plus the best week."""
    rng = random.Random(42)  # same data -> same numbers on every refresh
    fx = fixture_difficulties(fixtures)
    squad_ids = {s["p"]["id"] for s in squad}
    xi = [s for s in squad if s["starter"]]
    bench = [s for s in squad if not s["starter"]]
    results = []

    for chip in chips_left:
        end = min(chip["stop"], next_gw + CHIP_LOOKAHEAD - 1, last_gw)
        rows = []
        if chip["name"] == "wildcard":
            results.append(_wildcard(chip, squad, flagged))
            continue
        for gw in range(next_gw, end + 1):
            if chip["name"] == "bboost":
                means = [m for s in bench for m in fixture_means(s["p"], gw, next_gw, fx)]
                samples = [simulate(means, rng) for _ in range(SIMULATIONS)]
                doubles = sum(1 for s in bench if len(fx.get((s["p"]["team"], gw), [])) > 1)
                note = f"{doubles} bench player{'s' if doubles != 1 else ''} with 2 games" if doubles else ""
                rows.append(_row(gw, sum(means), chance(samples, BB_TARGET), note))
            elif chip["name"] == "3xc":
                best = max(xi, key=lambda s: sum(fixture_means(s["p"], gw, next_gw, fx)), default=None)
                means = fixture_means(best["p"], gw, next_gw, fx) if best else []
                samples = [simulate(means, rng) for _ in range(SIMULATIONS)]
                note = best["p"]["web_name"] + (" (2 games)" if len(means) > 1 else "") if means else ""
                rows.append(_row(gw, sum(means), chance(samples, TC_TARGET), note))
            elif chip["name"] == "freehit":
                rows.append(_free_hit(gw, next_gw, xi, players, squad_ids, fx, rng))
        if rows:
            best = max(rows, key=lambda r: (r["chance"], r["ev"]))
            best["best"] = True
            results.append({**chip, "rows": rows, "best": best, "end": end})
    return results


def _row(gw, ev, p, note):
    return {"gw": gw, "ev": ev, "chance": p, "note": note, "best": False}


def _free_hit(gw, next_gw, xi, players, squad_ids, fx, rng):
    """Gain from swapping out XI players who have no game (or are out) that week."""
    missing = []
    for s in xi:
        means = fixture_means(s["p"], gw, next_gw, fx)
        if not means or (gw == next_gw and s["flag"] == "red"):
            missing.append((s["p"]["element_type"], means))
    # A typical strong replacement: average of the top 10 projected players per position.
    top = {}
    for pos in {m[0] for m in missing}:
        scores = sorted((sum(fixture_means(p, gw, next_gw, fx)) for p in players.values()
                         if p["element_type"] == pos and p["id"] not in squad_ids), reverse=True)[:10]
        top[pos] = sum(scores) / len(scores) if scores else 0
    ev = sum(top[pos] - sum(m) for pos, m in missing)
    samples = [sum(simulate([top[pos]], rng) - simulate(m, rng) for pos, m in missing) for _ in range(SIMULATIONS)]
    note = f"{len(missing)} of your XI missing" if missing else ""
    return _row(gw, ev, chance(samples, FH_TARGET) if missing else 0.0, note)


def _wildcard(chip, squad, flagged):
    problems = [s for s in squad if s["score"] >= 2]
    if len(problems) >= WC_FLAGGED:
        verdict = "Good time to play it"
    elif len(problems) >= WC_FLAGGED - 1:
        verdict = "Worth considering"
    else:
        verdict = "Hold it"
    return {**chip, "rows": [], "best": None, "verdict": verdict,
            "problems": [s["p"]["web_name"] for s in problems]}
