import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from recording_tail import TailReview, verify_silence


class RecordingTailTest(unittest.TestCase):
    file = {"type": "M4A", "start": "a", "end": "b", "id": "audio"}

    def test_download_failure_stays_an_operational_failure(self):
        with patch("recording_tail.download_audio", side_effect=TimeoutError), self.assertRaises(TimeoutError):
            verify_silence([self.file], self.file, 3, 200)

    def test_missing_or_duplicate_aligned_audio(self):
        for files in [[], [self.file, self.file], [dict(self.file, end="other")]]:
            with self.assertRaises(TailReview):
                verify_silence(files, self.file, 3, 200)

    def test_decodes_control_and_entire_tail(self):
        from imageio_ffmpeg import get_ffmpeg_exe
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.m4a"
            for name, expr, duration, accepted in [
                ("silence", "sin(440*2*PI*t)*lt(t,2)", 9, True),
                ("late sound", "sin(440*2*PI*t)*(lt(t,2)+gt(t,8))", 9, False),
                ("missing end", "sin(440*2*PI*t)*lt(t,2)", 14, False),
                ("silent control", "0", 9, False),
                ("sound only in second channel", "0|sin(440*2*PI*t)*(lt(t,2)+gt(t,8))", 9, False),
            ]:
                subprocess.run([get_ffmpeg_exe(), "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                                f"aevalsrc='{expr}':d=9", "-c:a", "aac", str(path)], check=True)
                with self.subTest(name=name), patch("recording_tail.download_audio",
                        side_effect=lambda _, dest: shutil.copyfile(path, dest)):
                    if accepted:
                        self.assertEqual(verify_silence([self.file], self.file, 3, duration)["verifiedSeconds"], 6)
                    else:
                        with self.assertRaises(TailReview):
                            verify_silence([self.file], self.file, 3, duration)
