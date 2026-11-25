"""Publish a manually reviewed dated selection; unpublished media is never listed."""
import argparse
import hashlib
import json
import os
from datetime import date
from pathlib import Path
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

BLOCK = 256 * 1024


def store_video(db, ident, path):
    # Concurrent republishing must not expose a partially stored video.
    with db.transaction():
        db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (ident,))
        expected = path.stat().st_size
        existing = db.execute("SELECT size_bytes FROM training_clip_media WHERE id=%s", (ident,)).fetchone()
        if existing and existing[0] != expected:
            raise ValueError("Saved media differs in size")
        if not existing:
            db.execute("INSERT INTO training_clip_media VALUES (%s,%s)", (ident, expected))
            with path.open("rb") as file, db.cursor() as cursor:
                with cursor.copy("COPY training_clip_chunks (media_id,part,content) FROM STDIN") as copy:
                    part = 0
                    while block := file.read(BLOCK):
                        copy.write_row((ident, part, block))
                        part += 1
        (digest,) = db.execute("""
            SELECT encode(sha256(string_agg(content, ''::bytea ORDER BY part)), 'hex')
            FROM training_clip_chunks WHERE media_id=%s
        """, (ident,)).fetchone()
        with path.open("rb") as file:
            if digest != hashlib.file_digest(file, "sha256").hexdigest():
                raise ValueError("Media failed readback")


def publish(db, manifest, media):
    day = date.fromisoformat(manifest["date"])
    picks = manifest["picks"]
    ids = [str(UUID(p["id"])) for p in picks]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate selected clip")
    for ident in ids:
        store_video(db, ident, media / (ident + ".mp4"))
    with db.transaction():
        db.execute("INSERT INTO training_clip_reports VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                   (day, Jsonb(picks), manifest["sheet"]))
        saved = db.execute("SELECT picks,sheet_url FROM training_clip_reports WHERE report_date=%s", (day,)).fetchone()
        if saved != (picks, manifest["sheet"]):
            raise ValueError("This date already has a different selection")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("private_media", type=Path)
    args = parser.parse_args()
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as db:
        publish(db, json.loads(args.manifest.read_text()), args.private_media)
