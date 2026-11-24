import unittest
from unittest.mock import Mock, patch

from live import Ineligible, process, shared_intervals, verified_input


class LiveTrackerTest(unittest.TestCase):
    def test_first_calls_and_prelaunch_calls_never_reach_zoom_or_luna(self):
        db = Mock()
        source = "record"
        for label, floor in [("Call 1", 0), ("Call 2+", 1800000000)]:
            row = {"id": source, "fields": {"Call #": label, "Meeting Start Date": "2026-11-25T00:00:00Z"}}
            with patch("live.source_read", return_value={"records": [row]}) as reader, patch("live.publish") as publish:
                self.assertEqual(process(db, source, floor), "outside")
                reader.assert_called_once_with("source", {"id": source})
                publish.assert_not_called()

    def test_source_outcome_must_match_transcript_before_model_spend(self):
        db = Mock()
        db.execute.return_value.fetchall.return_value = [("other transcript", "Closed")]
        row = {"id": "record", "fields": {"Call #": "Call 2+", "Meeting Start Date": "2026-11-25T00:00:00Z",
               "Processing Status": "Processed", "AI Decision Reason": "attendance_status=normal",
               "Meeting Transcript Link": "current transcript"}}
        with patch("live.source_read", return_value={"records": [row]}) as reader, patch("live.publish") as publish:
            with self.assertRaisesRegex(ValueError, "Outcome pending"):
                process(db, "record", 0)
            reader.assert_called_once()
            publish.assert_not_called()

    def test_call_two_label_alone_is_insufficient(self):
        row = {"Client Name": "Test Guest", "Meeting Start Date": "2026-11-25", "Rep Name": "Rep"}
        with self.assertRaises(Ineligible):
            verified_input(row, {}, {"transcript": ""}, "Follow-up")

    def test_backfill_rejects_another_followup_even_with_second_call_language(self):
        row = {"Client Name": "Test Guest", "Rep Name": "Rep", "Meeting Start Date": "2026-11-25",
               "Zoom Meeting UUID": "new"}
        older = dict(row, **{"Meeting Start Date": "2026-11-24", "Zoom Meeting UUID": "older",
                             "Call #": "Call 2+", "AI Decision Reason": "attendance_status=normal"})
        with self.assertRaises(Ineligible):
            verified_input(row, {"records": [{"fields": older}]}, {}, "Follow-up", True)

    def test_attendance_unions_duplicate_devices_and_excludes_rep_absences(self):
        c = {"rep": "Rep", "castSpeakers": ["Cast"], "castIntervals": [[10, 50], [20, 70]], "meetingStart": 0}
        sessions = [{"name": "Rep", "join": a, "leave": b} for a,b in [(0, 30), (40, 100)]]
        with patch("live.seconds", side_effect=lambda x: x):
            self.assertEqual(shared_intervals(c, sessions, {})[0], [[10, 30], [40, 70]])
