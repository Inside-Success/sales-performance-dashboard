import unittest
from unittest.mock import patch

from live import Ineligible, shared_intervals, verified_input


class LiveTrackerTest(unittest.TestCase):
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
