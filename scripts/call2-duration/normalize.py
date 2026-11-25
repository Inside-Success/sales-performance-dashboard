"""Join one verified Airtable occurrence, Zoom manifest and reviewed cast identities."""

import datetime
import re


def seconds(iso):
    return datetime.datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def entries(vtt):
    parsed = []
    for block in re.split(r"\n\s*\n", vtt.replace("\r", "").strip()):
        lines = block.splitlines()
        for i, line in enumerate(lines):
            if " --> " not in line:
                continue
            start, end = line.split(" --> ")
            speaker, sep, text = " ".join(lines[i + 1 :]).partition(": ")
            if not sep:
                text, speaker = speaker, "Unidentified"
            parsed.append(
                dict(start=start, end=end.split()[0], speaker=speaker, text=text)
            )
            break
    return parsed


def confirmed_history(row, history):
    if not history or history.get("offset"):
        return False
    name = (row.get("Client Name") or "").casefold().strip()
    if len(name.split()) < 2 or re.search(
        r"zoom|iphone|android|assistant|samsung|meeting", name
    ):
        return False
    prior = {}
    for record in history.get("records", []):
        f = record["fields"]
        if (
            f["Meeting Start Date"] >= row["Meeting Start Date"]
            or f.get("Zoom Meeting UUID") == row["Zoom Meeting UUID"]
        ):
            continue
        prior[f.get("Zoom Meeting UUID")] = f
    if len(prior) != 1:
        return False
    f = next(iter(prior.values()))
    return (
        f.get("Call #") == "Call 1"
        and (f.get("Client Name") or "").strip().casefold() == name
        and f.get("Rep Name") == row.get("Rep Name")
        and f.get("Zoom Meeting UUID")
        and f.get("Meeting Transcript Link")
        and "attendance_status=normal" in f.get("AI Decision Reason", "")
    )


def normalize(
    row, zoom, proof, speakers, participant_names, display_name, history=None, *, tail_check=None
):
    if (
        row["Call #"] != "Call 2+"
        or row["Processing Status"] != "Processed"
        or row["Zoom Meeting UUID"] != zoom["uuid"]
    ):
        raise ValueError("Wrong occurrence or source stage")
    es = entries(zoom["transcript"])
    if not confirmed_history(row, history) and not any(
        proof and proof in e["text"] for e in es
    ):
        raise ValueError("Missing second-call evidence")
    files = zoom["files"]
    transcript = next(
        f
        for f in files
        if f["id"] == row["Recording File ID"] and f["type"] == "TRANSCRIPT"
    )
    videos = [
        f
        for f in files
        if f["type"] == "MP4"
        and (f["start"], f["end"]) == (transcript["start"], transcript["end"])
    ]
    if not videos:
        raise ValueError("No aligned video")
    if len({(f["start"], f["end"]) for f in files if f["type"] == "TRANSCRIPT"}) != 1:
        raise ValueError("Multiple recording segments need reconciliation")
    sessions = zoom["sessions"]
    if not sessions or any(not p["join"] or not p["leave"] for p in sessions):
        raise ValueError("Missing meeting intervals")
    lo = min(seconds(p["join"]) for p in sessions)
    hi = max(seconds(p["leave"]) for p in sessions)
    start = seconds(zoom["start"]) if zoom.get("start") else lo
    end = seconds(zoom["end"]) if zoom.get("end") else hi
    rs, re_ = seconds(transcript["start"]), seconds(transcript["end"])
    if rs > start + 120 or re_ < end - 120:
        raise ValueError("Recording misses meeting boundary; verify source")
    if not es:
        raise ValueError("Transcript is empty")
    from review import timestamp

    cue_end = max(timestamp(e["end"]) for e in es)
    tail = None
    if re_ - rs - cue_end > 120:
        if tail_check is None:
            raise ValueError("Transcript stops before recording ends")
        tail = tail_check(files, transcript, cue_end, re_ - rs)
    if any(timestamp(e["end"]) < timestamp(e["start"]) for e in es):
        raise ValueError("Invalid transcript timestamps")
    if not speakers or not set(speakers) <= set(e["speaker"] for e in es):
        raise ValueError("Missing cast speech")
    intervals = [
        [seconds(p["join"]), seconds(p["leave"])]
        for p in sessions
        if p["name"] in participant_names
    ]
    return dict(
        uuid=zoom["uuid"],
        confirmedSecond=True,
        complete=True,
        rep=row["Rep Name"],
        cast=display_name,
        show=row["Show Name"],
        date=row["Meeting Start Date"],
        recording=videos[0]["url"],
        recordingStart=rs,
        recordingEnd=re_,
        meetingStart=start,
        meetingEnd=end,
        castIntervals=intervals,
        castSpeakers=speakers,
        entries=es,
        **({"verifiedTail": tail} if tail else {}),
    )
