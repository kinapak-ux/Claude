"""Free transfers estimate, double/blank gameweek alerts and the NLLL points race chart."""

import html

MAX_FREE_TRANSFERS = 5
ALERT_LOOKAHEAD = 8     # gameweeks checked for doubles and blanks

# Chart colours (validated categorical slots, light / dark). Slot 1 is always you.
SERIES_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]
SERIES_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"]


def esc(x):
    return html.escape(str(x))


# --------------------------------------------------------------------------- free transfers

def free_transfers(history):
    """Estimated free transfers for the next deadline, rebuilt from transfer history.

    Rules assumed: +1 each gameweek, at most 5 banked, transfers beyond the free ones
    are hits, and Wildcard/Free Hit weeks keep whatever was banked. FPL does not publish
    the exact figure, so treat it as an estimate."""
    gws = sorted((history or {}).get("current", []), key=lambda g: g["event"])
    if not gws:
        return None
    chip_weeks = {c["event"]: c["name"] for c in (history or {}).get("chips", [])}
    ft = None
    for g in gws:
        if ft is None:          # first gameweek: unlimited transfers before it
            ft = 1
            continue
        if chip_weeks.get(g["event"]) not in ("wildcard", "freehit"):
            ft = max(ft - g.get("event_transfers", 0), 0)
        ft = min(MAX_FREE_TRANSFERS, ft + 1)
    return ft


# --------------------------------------------------------------------------- doubles and blanks

def gameweek_alerts(fixtures, teams, squad, first_gw, last_gw):
    """Upcoming double and blank gameweeks, with which of your players they affect."""
    counts = {}
    for f in fixtures:
        if f.get("event"):
            for t in (f["team_h"], f["team_a"]):
                counts[(f["event"], t)] = counts.get((f["event"], t), 0) + 1
    unscheduled = sum(1 for f in fixtures if not f.get("event"))
    mine = {}
    for s in squad:
        mine.setdefault(s["p"]["team"], []).append(s["p"]["web_name"])

    alerts = []
    for gw in range(first_gw, min(first_gw + ALERT_LOOKAHEAD, last_gw + 1)):
        doubles = [t for t in teams if counts.get((gw, t), 0) >= 2]
        blanks = [t for t in teams if counts.get((gw, t), 0) == 0]
        if len(blanks) == len(teams):
            continue  # fixtures for this week aren't published yet
        for kind, ts in (("double", doubles), ("blank", blanks)):
            if ts:
                affected = [n for t in ts for n in mine.get(t, [])]
                alerts.append({"gw": gw, "kind": kind,
                               "teams": [teams[t]["short_name"] for t in ts], "mine": affected})
    return {"alerts": alerts, "unscheduled": unscheduled}


def alerts_html(info):
    if not info or not info["alerts"]:
        return ""
    rows = []
    for a in info["alerts"]:
        icon = "⬆" if a["kind"] == "double" else "⬇"
        yours = (f'<span class="val">{esc(", ".join(a["mine"]))}</span>' if a["mine"]
                 else '<span class="val meta">none of yours</span>')
        rows.append(f'<div class="crow alert {a["kind"]}" title="GW{a["gw"]} {a["kind"]}: {esc(", ".join(a["teams"]))}">'
                    f'<span class="tag">{icon} GW{a["gw"]}</span><strong>{a["kind"].title()}</strong>'
                    f'<span class="meta teams">{esc(" ".join(a["teams"]))}</span>{yours}</div>')
    extra = (f' <span class="meta">· {info["unscheduled"]} match{"es" if info["unscheduled"] != 1 else ""} '
             f'still to be rescheduled</span>') if info["unscheduled"] else ""
    return (f'<div class="box tbox alerts"><div class="dhead">⚠ Doubles &amp; blanks{extra}</div>'
            f'{"".join(rows)}</div>')


# --------------------------------------------------------------------------- points race

def race_data(lg, team_id):
    """Each manager's season totals by gameweek, with you first."""
    names = {r["entry"]: r["entry_name"] for r in lg["rows"]}
    series = []
    for entry_id, m in lg["meta"].items():
        gws = (m.get("history") or {}).get("current", [])
        if entry_id in names and gws:
            series.append({"entry": entry_id, "name": names[entry_id], "me": entry_id == team_id,
                           "totals": {g["event"]: g["total_points"] for g in gws}})
    # you first, then rivals by current total (colour follows the manager, set once here)
    series.sort(key=lambda s: (not s["me"], -max(s["totals"].values())))
    return series


def race_svg(lg, team_id):
    """Line chart of each manager's gap to the leader, gameweek by gameweek."""
    series = race_data(lg, team_id)
    if len(series) < 2:
        return ""
    gws = sorted({gw for s in series for gw in s["totals"]})
    if len(gws) < 2:
        return ""
    leader = {gw: max(s["totals"].get(gw, 0) for s in series) for gw in gws}
    for s in series:
        s["gap"] = {gw: s["totals"][gw] - leader[gw] for gw in gws if gw in s["totals"]}
    low = min(v for s in series for v in s["gap"].values())
    step = 10 if low > -60 else (20 if low > -150 else 50)
    low = min(-step, (low // step) * step)

    W, H, L, R, T, B = 360, 170, 34, 46, 8, 20
    x = lambda gw: L + (gw - gws[0]) / (gws[-1] - gws[0]) * (W - L - R)
    y = lambda v: T + (v / low) * (H - T - B)

    shown = series[:5]                       # you + up to 4 rivals in colour
    others = series[5:]                      # anyone else in grey

    grid = "".join(
        f'<line class="grid" x1="{L}" x2="{W - R}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>'
        f'<text class="ax" x="{L - 4}" y="{y(v) + 3:.1f}" text-anchor="end">{v}</text>'
        for v in range(0, int(low) - 1, -step))
    ticks = "".join(f'<text class="ax" x="{x(gw):.1f}" y="{H - 5}" text-anchor="middle">{gw}</text>'
                    for gw in gws if gw == gws[0] or gw == gws[-1] or gw % 5 == 0)

    def path(s):
        pts = [(x(gw), y(v)) for gw, v in sorted(s["gap"].items())]
        return "M" + " L".join(f"{px:.1f},{py:.1f}" for px, py in pts), pts[-1]

    lines = []
    for s in others:
        d, _ = path(s)
        lines.append(f'<path class="ln other" d="{d}"/>')
    for i, s in reversed(list(enumerate(shown))):   # draw you last, on top
        d, (ex, ey) = path(s)
        lines.append(f'<path class="ln s{i + 1}{" me" if s["me"] else ""}" d="{d}"/>'
                     f'<circle class="dot s{i + 1}" cx="{ex:.1f}" cy="{ey:.1f}" r="4"/>')
        if s["me"]:
            lines.append(f'<text class="lbl-me" x="{ex + 7:.1f}" y="{ey + 4:.1f}">You</text>')

    # one invisible column per gameweek: hover highlights it, tap shows everyone's numbers
    cols = []
    half = (W - L - R) / (len(gws) - 1) / 2
    for gw in gws:
        parts = sorted(((s["gap"][gw], "You" if s["me"] else s["name"]) for s in series if gw in s["gap"]), reverse=True)
        tip = f"GW{gw} – " + ", ".join(f"{n} {'leader' if g == 0 else g}" for g, n in parts)
        cols.append(f'<rect class="col" x="{x(gw) - half:.1f}" y="{T}" width="{2 * half:.1f}" '
                    f'height="{H - T - B}" title="{esc(tip)}"><title>{esc(tip)}</title></rect>')

    legend = "".join(f'<span class="lg"><i class="s{i + 1}"></i>{esc("You" if s["me"] else s["name"])}</span>'
                     for i, s in enumerate(shown))
    if others:
        legend += f'<span class="lg"><i class="other"></i>{len(others)} others</span>'

    table_rows = "".join(
        f'<tr><td class="team">{esc("You" if s["me"] else s["name"])}</td>'
        + "".join(f'<td>{s["gap"].get(gw, "")}</td>' for gw in gws[-6:]) + "</tr>"
        for s in series)
    table = (f'<details class="racetable"><summary>Show as table</summary><div class="tablewrap">'
             f'<table class="compact"><thead><tr><th>Team</th>{"".join(f"<th>GW{gw}</th>" for gw in gws[-6:])}'
             f'</tr></thead><tbody>{table_rows}</tbody></table></div></details>')

    return f"""
          <div class="race">
            <div class="dhead">Points race <span class="meta">gap to the leader each gameweek</span></div>
            <svg viewBox="0 0 {W} {H}" role="img" aria-label="Points behind the league leader by gameweek">
              {grid}{ticks}{''.join(lines)}{''.join(cols)}
            </svg>
            <div class="legend">{legend}</div>
            {table}
          </div>"""


RACE_CSS = """
.race {{ margin-top:12px; border-top:1px solid var(--line); padding-top:8px; }}
.race .dhead {{ border:0; }} .race .dhead .meta {{ text-transform:none; letter-spacing:0; font-weight:400; }}
.race svg {{ width:100%; height:auto; display:block; margin-top:4px; }}
.race .grid {{ stroke:var(--line); stroke-width:1; }}
.race .ax {{ fill:var(--muted); font-size:9px; }}
.race .ln {{ fill:none; stroke-width:2; stroke-linejoin:round; stroke-linecap:round; }}
.race .ln.me {{ stroke-width:3; }}
.race .ln.other {{ stroke:var(--muted); opacity:.45; stroke-width:1.5; }}
.race .dot {{ stroke:var(--card); stroke-width:2; }}
.race .lbl-me {{ fill:var(--text); font-size:10px; font-weight:700; }}
.race .col {{ fill:transparent; cursor:pointer; }}
.race .col:hover {{ fill:var(--text); fill-opacity:.06; }}
.race .legend {{ display:flex; flex-wrap:wrap; gap:4px 12px; font-size:.75rem; color:var(--muted); margin-top:4px; }}
.race .lg i {{ display:inline-block; width:12px; height:3px; border-radius:2px; vertical-align:middle; margin-right:4px; }}
.race .lg i.other {{ background:var(--muted); opacity:.45; }}
.racetable {{ margin-top:6px; font-size:.8rem; }} .racetable summary {{ color:var(--muted); cursor:pointer; }}
""" + "".join(
    f".race .s{i} {{{{ stroke:{c}; fill:{c}; }}}} .race .ln.s{i} {{{{ fill:none; }}}} .race .lg i.s{i} {{{{ background:{c}; }}}}\n"
    for i, c in enumerate(SERIES_LIGHT, 1)
) + "@media (prefers-color-scheme: dark) {{\n" + "".join(
    f"  .race .s{i} {{{{ stroke:{c}; fill:{c}; }}}} .race .ln.s{i} {{{{ fill:none; }}}} .race .lg i.s{i} {{{{ background:{c}; }}}}\n"
    for i, c in enumerate(SERIES_DARK, 1)
) + "}}\n"
RACE_CSS = RACE_CSS.replace("{{", "{").replace("}}", "}")  # inserted verbatim into the page
