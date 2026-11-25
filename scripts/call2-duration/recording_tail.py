"""Verify a long untranscribed ending against the occurrence's aligned Zoom audio."""
import http.cookiejar
import json
import re
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit


class TailReview(ValueError):
    """Recording evidence is insufficient to publish a duration."""


def zoom_url(url):
    parts = urlsplit(url)
    return parts.scheme == "https" and (parts.hostname or "").endswith(".zoom.us")


class ZoomRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not zoom_url(newurl):
            raise RuntimeError("Unexpected playback redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download_audio(file, target):
    page = file["url"]
    if not zoom_url(page) or not urlsplit(page).path.startswith("/rec/play/"):
        raise RuntimeError("Invalid recording playback URL")
    opener = urllib.request.build_opener(
        ZoomRedirect(), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    with opener.open(page, timeout=45) as response:
        match = re.search(rb"fileId: '([^']+)'", response.read(4_000_000))
    if not match:
        raise RuntimeError("Recording playback unavailable")
    info = urljoin(page, "/nws/recording/1.0/play/info/" + quote(match[1].decode(), safe=""))
    with opener.open(urllib.request.Request(info, headers={"Referer": page}), timeout=45) as response:
        result = json.load(response)["result"]
    if result["recording"]["id"] != file["id"]:
        raise RuntimeError("Wrong playback recording")
    stream = result["viewMp4Url"]
    if not zoom_url(stream):
        raise RuntimeError("Unexpected audio origin")
    request = urllib.request.Request(stream, headers={"Referer": page, "User-Agent": "Mozilla/5.0"})
    with opener.open(request, timeout=60) as response, target.open("wb") as out:
        shutil.copyfileobj(response, out)


def measure(path, start, duration=None):
    # Keep every audio channel. A mono mix can cancel out speech on opposite channels.
    from imageio_ffmpeg import get_ffmpeg_exe

    cmd = [get_ffmpeg_exe(), "-nostdin", "-hide_banner", "-xerror", "-protocol_whitelist", "file",
           "-f", "mov", "-ss", str(start)]
    if duration is not None:
        cmd.extend(["-t", str(duration)])
    cmd.extend(["-i", str(path), "-map", "0:a:0", "-af", "asetpts=N/SR/TB,volumedetect", "-progress", "pipe:1", "-nostats", "-f", "null", "-"])
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=150)
    peaks = re.findall(r"max_volume: ([-.\d]+) dB", result.stderr)
    elapsed = re.findall(r"^out_time_us=(\d+)$", result.stdout, re.M)
    if result.returncode or len(peaks) != 1 or not elapsed:
        raise RuntimeError("Recording audio decode failed")
    return float(peaks[0]), int(elapsed[-1]) / 1_000_000


def verify_silence(files, transcript, cue_end, recording_length):
    aligned = [f for f in files if f["type"] == "M4A"
               and (f["start"], f["end"]) == (transcript["start"], transcript["end"])]
    if len(aligned) != 1 or cue_end < 1:
        raise TailReview("Missing unique aligned audio or speech control")
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "audio.m4a"
        download_audio(aligned[0], path)
        control_start = max(0, cue_end - 30)
        control, _ = measure(path, control_start, cue_end - control_start)
        fade, _ = measure(path, cue_end, 1)
        tail, duration = measure(path, cue_end + 1)
    # One second accommodates the final syllable fading at the transcript boundary.
    # The near-zero ceiling thereafter is deliberately stricter than a speech detector.
    if abs(duration - (recording_length - cue_end - 1)) > 1:
        raise TailReview("Decoded audio does not cover the recording")
    if control < -35 or fade > -36 or tail > -78:
        raise TailReview("Unverified silence after the last transcript cue")
    return {"audioId": aligned[0]["id"], "lastCueEnd": cue_end, "verifiedSeconds": round(duration + 1),
            "tailPeakDb": tail}
