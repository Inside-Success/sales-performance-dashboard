import json
import sqlite3
import unittest
from unittest.mock import patch
from audit_mark import audit
from check_exchange import check, same_exchange
from review import union_seconds, prepare, review, first_pullback, speech_rows


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

    def test_long_call_schema_still_rejects_a_non_cast_cue(self):
        call = self.call()
        call["entries"] *= 1001
        call["entries"].append(dict(start="00:00:12.000", speaker="Rep", text="Okay."))
        result = {"candidates": [dict(cue=1001, classification="pullback", reason="test")]}
        response = {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(result)}}]}
        with patch("review.obtain_receipt", return_value=(response, "")) as send:
            with self.assertRaisesRegex(ValueError, "source-matched cast cues"):
                review(call, None, "unused")
        schema = send.call_args.args[1]["response_format"]["json_schema"]["schema"]
        item = schema["properties"]["candidates"]["items"]
        self.assertEqual(item["properties"]["cue"], {"type": "integer"})

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

    def test_second_check_routes_separate_cast_turns_and_signal_disagreements(self):
        cast_ids = {0, 1, 3}
        for pair in [(0, 0), (1, 0), (-1, -1)]:
            self.assertTrue(same_exchange(*pair, cast_ids))
        for pair in [(0, 3), (1, -1), (-1, 0)]:
            self.assertFalse(same_exchange(*pair, cast_ids))

    def test_second_check_validates_evidence_and_keeps_prior_results_blind(self):
        call = self.call() | {"review": "private prior mark", "signal": 999}
        for cue, quote, valid in [(0, "need to pause", True), (-1, "", True),
                                  (0, "invented quote", False), (1, "pause", False),
                                  (0, "", False), (-1, "pause", False)]:
            result = {"cue": cue, "quote": quote}
            choice = {"finish_reason": "stop", "message": {"content": json.dumps(result)}}
            with patch("check_exchange.obtain_receipt", return_value=({"choices": [choice]}, "digest")) as send:
                if valid:
                    self.assertEqual(check(call, None, "key"), result)
                else:
                    with self.assertRaises(ValueError):
                        check(call, None, "key")
                messages = send.call_args.args[1]["messages"]
                self.assertNotIn(call["officialOutcome"], str(messages))
                self.assertNotIn(call["review"], str(messages))
                self.assertEqual(json.loads(messages[1]["content"]), [[0, "cast", "", "I need to pause."]])

    def test_mark_audit_skips_absent_clock_and_rejects_mismatched_sources(self):
        call = self.call()
        first = {"occurrence": call["uuid"], "summary": {"signal": None}}
        with patch("audit_mark.obtain_receipt") as send:
            self.assertEqual(audit(call, first, None, "unused")["decision"], "no_clock")
            with self.assertRaises(ValueError):
                audit(call, first | {"occurrence": "other"}, None, "unused")
            with self.assertRaises(ValueError):
                audit(call, first | {"summary": {"signal": {"id": 500}}}, None, "unused")
            send.assert_not_called()

    def test_mark_audit_requires_source_bound_evidence_and_omits_outcome(self):
        call = self.call()
        first = {"occurrence": call["uuid"], "summary": {"signal": prepare(call)[1][0]}}
        for decision, evidence, valid in [("keep", 0, True), ("hold", -1, True), ("keep", -1, False)]:
            result = {"decision": decision, "evidence": evidence, "reason": "assessment"}
            response = {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(result)}}]}
            with patch("audit_mark.obtain_receipt", return_value=(response, "")) as send:
                if valid:
                    self.assertEqual(audit(call, first, None, "unused"), result)
                else:
                    with self.assertRaises(ValueError):
                        audit(call, first, None, "unused")
                payload = send.call_args.args[1]["messages"][1]["content"]
                self.assertNotIn(call["officialOutcome"], payload)
                self.assertEqual(json.loads(payload)["proposed_cue"], 0)
