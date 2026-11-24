import json
import sqlite3
import unittest
from unittest.mock import patch
from review import union_seconds, prepare, review, first_pullback, speech_rows, grounded_excerpt


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

    def test_media_is_context_and_live_interruption_stays_eligible(self):
        entries = [dict(speaker=s, text=t) for s, t in [
            ("Audio shared by Host", "Welcome"), ("Guest", "Please pause the offer."),
            ("Audio shared by Host", "Our history"), ("Host", "What concerns you?"),
        ]]
        rows = speech_rows(entries, ["Guest"])
        self.assertEqual([r[1] for r in rows], ["shared_media", "cast", "shared_media", "other_live"])
        self.assertEqual(rows[1][2], "between_media_cues")

    def test_earliest_supported_candidate_or_none(self):
        candidates = [dict(cue=i, classification=k) for i, k in
                      [(9, "pullback"), (1, "unclear"), (3, "engaged"), (5, "pullback")]]
        ids = {1, 3, 5, 9}
        self.assertEqual(first_pullback(candidates, ids), 5)
        self.assertIsNone(first_pullback(candidates[1:3], ids))
        with self.assertRaises(ValueError):
            first_pullback(candidates, {9})
        with self.assertRaises(ValueError):
            first_pullback(candidates * 2, ids)

    def test_pullback_requires_evidence_from_its_own_cue(self):
        candidate = dict(cue=0, reason="Defers", classification="pullback")
        for evidence in ("", "invented", "need to pause"):
            result = {"candidates": [candidate | {"evidence": evidence}]}
            choice = dict(finish_reason="stop", message=dict(content=json.dumps(result)))
            receipt = dict(choices=[choice], usage={})
            with patch("review.obtain_receipt", return_value=(receipt, "test")):
                if evidence == "need to pause":
                    self.assertEqual(review(self.call(), None, "test")["summary"]["signal"]["at"], 15)
                else:
                    with self.assertRaises(ValueError):
                        review(self.call(), None, "test")

    def test_no_pullback_needs_no_confirmation(self):
        with patch("review.completed_review", return_value=({"candidates": []}, "digest", [])) as run:
            self.assertIsNone(review(self.call(), None, "unused")["summary"]["signal"])
            self.assertEqual(run.call_count, 1)

    def test_independent_confirmation_can_reject_candidate(self):
        proposal = dict(cue=0, classification="pullback", reason="first reader assessment", evidence="pause")
        rejected = proposal | dict(classification="engaged", reason="logistics", evidence="")
        with patch("review.completed_review", side_effect=[
            ({"candidates": [proposal]}, "first", []), ({"candidates": [rejected]}, "second", [])
        ]) as run:
            self.assertIsNone(review(self.call(), None, "unused")["summary"]["signal"])
            confirm_input = json.loads(run.call_args.args[1]["messages"][1]["content"])
            self.assertEqual(confirm_input["proposed"], [0])
            self.assertNotIn(proposal["reason"], str(confirm_input))

    def test_quoted_omissions_preserve_word_order(self):
        source = "Maybe later. I still have to decide."
        self.assertTrue(grounded_excerpt("maybe later... to decide", source))
        for evidence in ("decide… maybe", "ate", "...", "maybe tomorrow"):
            self.assertFalse(grounded_excerpt(evidence, source))

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
