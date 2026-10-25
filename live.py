"""Live gameweek scores: works out each manager's points while matches are on,
the way the FPL app does - live points, provisional bonus, automatic
substitutions, vice-captain cover, chips and transfer hits."""

from datetime import datetime, timedelta, timezone

LIVE_WINDOW_HOURS = 4   # keep refreshing this long after a kick-off (covers bonus confirmation)
MIN_IN_XI = {1: 1, 2: 3, 3: 2, 4: 1}  # formation minimums: GK, DEF, MID, FWD


def kickoff(f):
    return datetime.fromisoformat(f["kickoff_time"].replace("Z", "+00:00")) if f.get("kickoff_time") else None


def matches_on(fixtures, now=None):
    """True when a match kicked off within the last few hours (worth refreshing)."""
    now = now or datetime.now(timezone.utc)
    return any(k and now - timedelta(hours=LIVE_WINDOW_HOURS) <= k <= now
               for k in (kickoff(f) for f in fixtures))


def team_status(fixtures):
    """{team_id: 'done' | 'playing' | 'todo'} for this gameweek."""
    status = {}
    for f in fixtures:
        if not f.get("started"):
            s = "todo"
        elif f.get("finished") or f.get("finished_provisional"):
            s = "done"
        else:
            s = "playing"
        for team in (f["team_h"], f["team_a"]):
            prev = status.get(team)
            # a double gameweek team is only 'done' once both games are
            if prev is None or s == "todo" or (s == "playing" and prev == "done"):
                status[team] = s
    return status


def provisional_bonus(fixtures):
    """Bonus points not yet added by FPL, from the live bonus points system (BPS)."""
    extra = {}
    for f in fixtures:
        if not f.get("started"):
            continue
        stats = {s["identifier"]: s for s in f.get("stats", [])}
        if stats.get("bonus", {}).get("a") or stats.get("bonus", {}).get("h"):
            continue  # FPL has already confirmed and added bonus for this match
        bps = sorted((e["value"], e["element"]) for side in ("a", "h") for e in stats.get("bps", {}).get(side, []))
        bps.reverse()
        rank, prev = 0, None
        for i, (value, el) in enumerate(bps):
            if value != prev:
                rank, prev = i + 1, value
            if rank > 3:
                break
            extra[el] = extra.get(el, 0) + (4 - rank)
    return extra


def player_points(live, fixtures):
    bonus = provisional_bonus(fixtures)
    return {e["id"]: {"pts": e["stats"]["total_points"] + bonus.get(e["id"], 0), "mins": e["stats"]["minutes"]}
            for e in live.get("elements", [])}


def manager_score(picks, chip, hit, pts, status, players):
    """Live points for one manager plus who's still to play."""
    picks = sorted(picks, key=lambda pk: pk["position"])
    mult = {pk["element"]: pk["multiplier"] for pk in picks}
    blank = {"pts": 0, "mins": 0}
    done = lambda el: status.get(players[el]["team"], "done") == "done"
    missed = lambda el: pts.get(el, blank)["mins"] == 0 and done(el)

    if chip != "bboost":
        xi = [pk["element"] for pk in picks if pk["position"] <= 11]
        bench = [pk["element"] for pk in picks if pk["position"] > 11]
        for el in list(xi):
            if not missed(el):
                continue
            for sub in bench:
                if pts.get(sub, blank)["mins"] == 0:
                    continue
                new_xi = [sub if x == el else x for x in xi]
                pos = [players[x]["element_type"] for x in new_xi]
                gk_ok = (players[el]["element_type"] == 1) == (players[sub]["element_type"] == 1)
                if gk_ok and all(pos.count(t) >= n for t, n in MIN_IN_XI.items()):
                    xi, mult[sub], mult[el] = new_xi, 1, 0
                    bench.remove(sub)
                    break

    captain = next((pk for pk in picks if pk["is_captain"]), None)
    vice = next((pk for pk in picks if pk["is_vice_captain"]), None)
    if captain and vice and missed(captain["element"]) and mult.get(vice["element"], 0) > 0:
        mult[vice["element"]], mult[captain["element"]] = captain["multiplier"], 0
        captain = vice

    total = sum(pts.get(el, blank)["pts"] * m for el, m in mult.items()) - (hit or 0)
    left = sum(1 for el, m in mult.items() if m > 0 and status.get(players[el]["team"]) in ("todo", "playing"))
    cap = captain["element"] if captain else None
    return {"pts": total, "left": left, "mult": mult, "captain": cap,
            "captain_pts": pts.get(cap, blank)["pts"] * mult.get(cap, 0) if cap else 0}


def build_live(source, events, players, my_picks, my_meta, team_id, leagues):
    """Live data for the current gameweek, or None when nothing has kicked off yet."""
    current = next((e for e in events if e["is_current"]), None)
    if not current or current.get("finished"):
        return None
    fixtures = source.get(f"fixtures/?event={current['id']}")
    if not any(f.get("started") for f in fixtures):
        return None
    pts = player_points(source.get(f"event/{current['id']}/live/"), fixtures)
    status = team_status(fixtures)
    me = manager_score(my_picks, my_meta["chip"], my_meta["hit"], pts, status, players)

    tables = []
    for lg in leagues:
        rows = []
        for r in lg["rows"]:
            if r["entry"] == team_id:
                score = me
            elif r["entry"] in lg["squads"]:
                m = lg["meta"][r["entry"]]
                score = manager_score(lg["squads"][r["entry"]], m["chip"], m["hit"], pts, status, players)
            else:
                continue
            rows.append({**r, "live": score, "live_total": r["total"] - r["event_total"] + score["pts"]})
        rows.sort(key=lambda x: -x["live_total"])
        for i, row in enumerate(rows):
            row["live_rank"] = i + 1
        tables.append({"name": lg["name"], "rows": rows})

    return {"gw": current["id"], "pts": pts, "status": status, "me": me, "tables": tables,
            "playing": any(s == "playing" for s in status.values()),
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
