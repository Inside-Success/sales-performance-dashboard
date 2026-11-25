"""Render one reviewed exchange from its matched Zoom MP4. No model request."""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "call2-duration"))
from recording_tail import download_audio
from review import timestamp


def render(source, first, last, directory):
    call, video = source["call"], source["video"]
    if video["type"] != "MP4" or video["url"] != call["recording"]:
        raise ValueError("Mismatched recording file")
    entries = call["entries"]
    if not 0 <= first < last < len(entries):
        raise ValueError("Invalid clip cues")
    start, end = timestamp(entries[first]["start"]), timestamp(entries[last]["end"])
    ident = uuid.uuid5(uuid.NAMESPACE_URL, f"training-clips/v1/{call['uuid']}/{start}/{end}")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    output = directory / f"{ident}.mp4"
    if output.exists():
        return output
    with tempfile.TemporaryDirectory(dir=directory) as work:
        recording = Path(work) / "recording.mp4"
        # This existing media reader verifies the resolved Zoom file ID before download.
        download_audio(video, recording)
        tmp = Path(work) / "clip.mp4"
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-ss", str(start), "-i", str(recording),
                        "-t", str(end - start), "-map", "0:v:0", "-map", "0:a:0", "-map_metadata", "-1",
                        "-map_chapters", "-1", "-vf", "scale=640:-2,fps=15", "-c:v", "libx264",
                        "-threads", "2", "-preset", "ultrafast", "-crf", "32", "-c:a", "aac", "-b:a", "56k",
                        "-movflags", "+faststart", str(tmp)], check=True)
        result = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                            "stream=codec_type:format=duration", "-of", "json", str(tmp)]))
        if ({s["codec_type"] for s in result["streams"]} != {"audio", "video"} or
            abs(float(result["format"]["duration"]) - (end - start)) > 0.3):
            raise ValueError("Media tracks or duration failed verification")
        tmp.replace(output)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("first", type=int)
    parser.add_argument("last", type=int)
    parser.add_argument("private_media", type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    print(render(json.loads(args.source.read_text()), args.first, args.last, args.private_media).name)
