"""Head-to-head squad comparison with mini-league rivals."""


def head_to_head(mine, theirs, players):
    """Splits two squads into only-mine / both / only-theirs, plus next-GW expected points."""
    a = {pk["element"]: pk for pk in mine}
    b = {pk["element"]: pk for pk in theirs}

    def order(el):
        p, pk = players[el], a.get(el) or b.get(el)
        return (pk["multiplier"] == 0, p["element_type"], -float(p["ep_next"] or 0))

    def expected(picks):
        return sum(float(players[pk["element"]]["ep_next"] or 0) * pk["multiplier"] for pk in picks)

    return {
        "mine": sorted((el for el in a if el not in b), key=order),
        "both": sorted((el for el in a if el in b), key=order),
        "theirs": sorted((el for el in b if el not in a), key=order),
        "a": a, "b": b, "exp_me": expected(mine), "exp_them": expected(theirs),
    }


def nearest_rivals(lg, team_id):
    """Leader plus the managers directly above and below you."""
    rows, me = lg["rows"], lg["me"]
    if not me:
        return []
    i = rows.index(me)
    picks = [rows[0]] + rows[max(i - 1, 0):i] + rows[i + 1:i + 2]
    seen, out = set(), []
    for r in picks:
        if r["entry"] != team_id and r["entry"] not in seen and r["entry"] in lg["squads"]:
            seen.add(r["entry"])
            out.append(r)
    return out
