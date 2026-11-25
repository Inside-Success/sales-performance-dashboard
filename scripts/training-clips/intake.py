"""Additional Call 2 evidence for reassigned reps and incomplete/no-show history."""
from collections import Counter
import re
from normalize import entries, seconds
from review import timestamp


def additional_input(row, history, zoom):
    if history.get("offset") or row["Zoom Meeting UUID"] != zoom.get("uuid"):
        raise ValueError("Incomplete or mismatched source")
    name = row.get("Client Name", "").strip().casefold()
    email = row.get("Client Email", "").strip().casefold()
    def matches(f):
        return name and f.get("Client Name", "").strip().casefold() == name and (
            (email and email == f.get("Client Email", "").strip().casefold()) or
            row.get("Rep Name") == f.get("Rep Name"))
    earlier = [x["fields"] for x in history["records"] if
               x["fields"].get("Zoom Meeting UUID") != zoom["uuid"] and
               x["fields"].get("Meeting Start Date", "") < row["Meeting Start Date"] and
               "attendance_status=normal" in x["fields"].get("AI Decision Reason", "")]
    if any(f.get("Call #") == "Call 2+" for f in earlier):
        raise ValueError("Earlier attended follow-up")
    es = entries(zoom.get("transcript", ""))
    rep = row["Rep Name"]
    rep_email = row.get("Rep Email", "").casefold()
    sessions = zoom.get("sessions", [])
    reps = [s for s in sessions if s["name"].casefold() == rep.casefold() or
            (rep_email and s.get("email", "").casefold() == rep_email)]
    guests = [s for s in sessions if s not in reps and
              (s["name"].strip().casefold() == name or (email and s.get("email", "").casefold() == email))]
    rep_names = {s["name"] for s in reps} | {rep}
    guest_names = {s["name"] for s in guests}
    spoken = Counter(e["speaker"] for e in es)
    if (guest_names & rep_names or not any(spoken[s] >= 2 for s in guest_names)
        or not any(spoken[s] >= 2 for s in rep_names)
        or not any(max(a["join"], b["join"]) < min(a["leave"], b["leave"]) for a in reps for b in guests)):
        raise ValueError("Attendance or speaker unconfirmed")
    prior_first = any(matches(f) and f.get("Call #") == "Call 1" and f.get("Meeting Transcript Link") for f in earlier)
    spoken_second = any(e["speaker"] in rep_names and re.search(
        r"\b(?:welcome (?:back )?to|here (?:on|for)|this is) (?:the |your |our )?second (?:casting |sales )?(?:call|interview|audition)\b",
        e["text"], re.I) for e in es[:120])
    if not (prior_first or spoken_second):
        raise ValueError("Second call unconfirmed")
    transcript = next(f for f in zoom["files"] if f["id"] == row["Recording File ID"] and f["type"] == "TRANSCRIPT")
    bounds = transcript["start"], transcript["end"]
    if any((f["start"], f["end"]) != bounds for f in zoom["files"] if f["type"] == "TRANSCRIPT"):
        raise ValueError("Multiple recording segments")
    video = next(f for f in zoom["files"] if f["type"] == "MP4" and (f["start"], f["end"]) == bounds)
    duration = seconds(bounds[1]) - seconds(bounds[0])
    if any(not 0 <= timestamp(e["start"]) <= timestamp(e["end"]) <= duration + 1 for e in es):
        raise ValueError("Cue outside recording")
    if duration - timestamp(es[-1]["end"]) > 120:
        raise ValueError("Incomplete transcript ending")
    return dict(call=dict(uuid=zoom["uuid"], rep=rep, show=row.get("Show Name", ""), date=row["Meeting Start Date"],
                          recording=video["url"], recordingStart=seconds(bounds[0]), entries=es),
                video=video, title=row.get("Meeting Title", ""))
