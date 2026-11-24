import sqlite3
import unittest
from unittest.mock import patch
from review import union_seconds, prepare, review


class TimingTest(unittest.TestCase):
    def call(self):
        return dict(
            officialOutcome="Follow-up scheduled",
            uuid="example",
            confirmedSecond=True,
            complete=True,
            entries=[
                dict(start="00:00:10.100", speaker="Cast", text="I need to pause.")
            ],
            recordingStart=105,
            recordingEnd=195,
            meetingStart=100,
            meetingEnd=200,
            castIntervals=[[100, 130], [120, 140], [150, 190]],
            castSpeakers=["Cast"],
            rep="Rep",
            cast="Cast",
            show="Show",
            date="2026-11-23T00:00:00Z",
            recording="sample",
        )

    def test_rejoins_and_devices(self):
        self.assertEqual(union_seconds(self.call()["castIntervals"]), 80)
        self.assertIsNone(union_seconds([]))

    def test_clock_alignment(self):
        _, cues, s = prepare(self.call())
        self.assertEqual(
            (cues[0]["at"], cues[0]["playback"], s["total"] - cues[0]["at"]),
            (15, 10, 85),
        )

    def test_before_spend(self):
        for change in [
            dict(confirmedSecond=False),
            dict(complete=False),
            dict(castSpeakers=[]),
            dict(meetingEnd=109),
        ]:
            with self.assertRaises(ValueError):
                prepare(self.call() | change)

    def test_uncertain_request_is_not_repeated(self):
        db = sqlite3.connect(":memory:")
        db.execute(
            "CREATE TABLE jobs(occurrence TEXT PRIMARY KEY,digest TEXT,receipt TEXT)"
        )
        with patch("urllib.request.urlopen", side_effect=TimeoutError) as send:
            with self.assertRaises(TimeoutError):
                review(self.call(), db, "key")
            with self.assertRaises(RuntimeError):
                review(self.call(), db, "key")
            self.assertEqual(send.call_count, 1)
