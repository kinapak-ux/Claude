"""Deadline-morning email summary for the FPL tracker.

Sends through Gmail using two GitHub secrets:
    GMAIL_ADDRESS       the Gmail address to send from and to
    GMAIL_APP_PASSWORD  a Gmail app password (not your normal password)
"""

import html
import os
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo

UK = ZoneInfo("Europe/London")
PAGE_URL = os.environ.get("PAGE_URL", "https://kinapak-ux.github.io/Claude/")


def deadline_uk(next_event):
    return datetime.fromisoformat(next_event["deadline_time"].replace("Z", "+00:00")).astimezone(UK)


def is_deadline_morning(next_event, now=None):
    """True when it's before midday (UK) on a deadline day and the deadline hasn't passed."""
    if not next_event:
        return False
    now = (now or datetime.now(timezone.utc)).astimezone(UK)
    deadline = deadline_uk(next_event)
    return now.date() == deadline.date() and now < deadline and now.hour < 12


def esc(x):
    return html.escape(str(x))


def money(tenths):
    return f"£{tenths / 10:.1f}m"


def compose(d, team_id):
    """Returns (subject, html_body)."""
    nxt = d["next_event"]
    when = deadline_uk(nxt).strftime("%a %d %b, %H:%M") if nxt else "?"
    gw = nxt["id"] if nxt else d["current_gw"] + 1
    out = [s for s in d["squad"] if s["flag"] == "red"]
    doubts = [s for s in d["squad"] if s["flag"] == "amber"]
    subject = f"FPL GW{gw} deadline today {when[-5:]} – {len(out)} out, {len(doubts)} doubtful"

    h2 = 'style="font-size:15px;margin:20px 0 6px;color:#37003c"'
    parts = [f'<p style="font-size:16px"><strong>GW{gw} deadline: {esc(when)} (UK)</strong></p>']

    if d["captains"]:
        c = d["captains"]
        caps = " · ".join(f'{["Captain", "Vice", "Also"][i]}: <strong>{esc(o["s"]["p"]["web_name"])}</strong>'
                          for i, o in enumerate(c))
        parts.append(f"<h3 {h2}>Captain picks</h3><p>{caps}</p>")

    flagged = out + doubts
    if flagged:
        rows = "".join(
            f'<li>{"🔴" if s["flag"] == "red" else "🟠"} <strong>{esc(s["p"]["web_name"])}</strong>'
            f'{"" if s["starter"] else " (bench)"} – {esc(s["p"]["news"] or "; ".join(s["reasons"]))}</li>'
            for s in flagged)
        parts.append(f"<h3 {h2}>Players to check</h3><ul>{rows}</ul>")
    else:
        parts.append(f"<h3 {h2}>Players to check</h3><p>🟢 Everyone is fit and in form.</p>")

    if d["ideas"]:
        rows = "".join(
            f'<li>Sell <strong>{esc(i["out"]["p"]["web_name"])}</strong> → '
            f'{esc(", ".join(f"{p["web_name"]} ({money(p["now_cost"])})" for _, p, _ in i["options"]) or "no options in budget")}</li>'
            for i in d["ideas"])
        parts.append(f"<h3 {h2}>Transfer ideas</h3><ul>{rows}</ul><p style=\"color:#667085\">Bank: {money(d['bank'])}</p>")

    moving = [s for s in d["squad"] if s["price"]["likely"]]
    if moving:
        rows = "".join(f'<li>{"▲" if s["price"]["likely"] == "rise" else "▼"} {esc(s["p"]["web_name"])} '
                       f'likely to {s["price"]["likely"]}</li>' for s in moving)
        parts.append(f"<h3 {h2}>Price watch</h3><ul>{rows}</ul>")

    if d["leagues"]:
        rows = []
        for lg in d["leagues"]:
            me, leader = lg["me"], lg["rows"][0] if lg["rows"] else None
            if not me:
                continue
            gap = f", {leader['total'] - me['total']} pts behind {esc(leader['entry_name'])}" if leader and leader is not me and leader["total"] > me["total"] else ""
            rows.append(f'<li><strong>{esc(lg["name"])}</strong>: {me["rank"]} of {len(lg["rows"])}{gap}</li>')
        if rows:
            parts.append(f"<h3 {h2}>Mini-leagues</h3><ul>{''.join(rows)}</ul>")

    parts.append(f'<p style="margin-top:24px"><a href="{esc(PAGE_URL)}" style="background:#37003c;color:#fff;'
                 f'padding:10px 16px;border-radius:6px;text-decoration:none">Open full tracker</a></p>')
    body = (f'<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;'
            f'line-height:1.5;color:#1b1d22;max-width:600px">{"".join(parts)}</div>')
    return subject, body


def send(d, team_id):
    address = os.environ.get("GMAIL_ADDRESS")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not address or not password:
        print("Email skipped: GMAIL_ADDRESS / GMAIL_APP_PASSWORD secrets are not set.")
        return
    subject, body = compose(d, team_id)
    msg = MIMEMultipart("alternative")
    msg["Subject"], msg["From"], msg["To"] = subject, address, address
    msg.attach(MIMEText(f"Open your tracker: {PAGE_URL}", "plain"))
    msg.attach(MIMEText(body, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(address, password.replace(" ", ""))
        smtp.send_message(msg)
    print(f"Email sent: {subject}")
