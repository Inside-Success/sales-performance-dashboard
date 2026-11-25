import unittest
from unittest.mock import Mock, patch

from live import guest_channel, IdentityHold, Reconcile, run, Ineligible, process, shared_intervals, verified_input


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
            verified_input(dict(row, **{"Zoom Meeting UUID": "m"}), {}, self.zoom(), "Follow-up")

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

    @staticmethod
    def zoom():
        return {"uuid": "m", "sessions": [{"name": "Test Guest"}],
                "transcript": "00:00:01.000 --> 00:00:02.000\nTest Guest: Hello"}

    def test_source_vs_identity_failures(self):
        row = {"Client Name": "Test Guest", "Rep Name": "Rep", "Meeting Start Date": "today",
               "Zoom Meeting UUID": "m"}
        with patch("live.confirmed_history", return_value=True), patch("live.normalize") as normalize:
            for update, expected in [
                ({"transcript": ""}, ValueError), ({"sessions": []}, ValueError),
                ({"uuid": "wrong"}, ValueError),
                ({"transcript": self.zoom()["transcript"].replace("Test Guest", "unknown")}, IdentityHold),
                ({"sessions": [{"name": "alias"}]}, IdentityHold),
                ({"sessions": [{"name": "Test Guest", "email": e} for e in ("a@x", "b@x")]}, IdentityHold),
            ]:
                with self.subTest(update=update), self.assertRaises(expected) as error:
                    verified_input(row, {}, dict(self.zoom(), **update), "Follow-up")
                self.assertIs(type(error.exception), expected)
            normalize.assert_not_called()

    def test_missing_and_overlapping_rep_identity(self):
        c = {"rep": "Rep", "castSpeakers": ["Guest"]}
        for sessions in ([], [{"name": "GUEST", "email": "rep@example.org"}]):
            with self.assertRaises(IdentityHold):
                shared_intervals(c, sessions, {"Rep Email": "rep@example.org"})

    def test_identity_hold_continues_sweep_and_real_failures_alert(self):
        from datetime import datetime, timezone
        for failure, status in [(None, "published"), (ValueError("source"), "retry"),
                                (TimeoutError(), "retry"), (Reconcile(), "reconcile")]:
            connect = Mock()
            connect.return_value = unittest.mock.MagicMock()
            with self.subTest(status=status), patch.dict("sys.modules", {"psycopg": Mock(connect=connect)}), patch.dict(
                "os.environ", {"CALL2_DATABASE_URL": "test"}
            ), patch("live.process", side_effect=[IdentityHold(), failure or status]):
                db = connect.return_value.__enter__.return_value
                db.execute.return_value.fetchone.return_value = (datetime.now(timezone.utc),)
                db.execute.return_value.fetchall.return_value = [("held", False), ("other", False)]
                if failure:
                    with self.assertRaises(SystemExit) as exit_status:
                        run()
                    self.assertEqual(exit_status.exception.code, 1)
                else:
                    run()
                writes = [args.args[1] for args in db.execute.call_args_list if "INSERT" in args.args[0]]
                self.assertEqual(writes, [("held", "identity_hold", False), ("other", status, status == "retry")])

    def test_guest_channel_requires_independent_evidence(self):
        row = {"Rep Name": "Rep", "Rep Email": "rep@x", "Client Name": "Alex Smith",
               "Meeting Title": "Followup - Alex Smith"}
        sessions = [{"name": "Rep", "email": "rep@x"}, {"name": "Tablet"}]
        es = [{"speaker": "Rep", "text": "Hi, Alex!"},
              {"speaker": "Tablet", "text": "The invitation says Dear Alex."},
              {"speaker": "Audio shared by Rep", "text": "Welcome back."}]
        expected = ({"Tablet"}, {"Tablet"})
        self.assertEqual(guest_channel(row, sessions, es), expected)
        self.assertEqual(guest_channel(dict(row, **{"Client Email": "a@x"}),
                         [sessions[0], dict(sessions[1], email="a@x")], es[1:] + [dict(es[0], text="Welcome")]), expected)
        for r, ss, ee in [
            (dict(row, **{"Meeting Title": "Alex Smithson"}), sessions, es),
            (row, sessions, [es[0], dict(es[1], text="Hello")]),
            (row, sessions + [{"name": "Observer"}], es),
            (row, sessions, es + [{"speaker": "Observer", "text": "Hi"}]),
            (row, sessions[1:], es),
            (row, [dict(sessions[0], email="wrong@x"), sessions[1]], es),
            (dict(row, **{"Client Email": "a@x"}), [sessions[0],dict(sessions[1], email="other@x")], es),
        ]:
            with self.subTest(r=r, ss=ss, ee=ee), self.assertRaises(IdentityHold):
                guest_channel(r, ss, ee)
