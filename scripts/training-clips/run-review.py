"""Run a manual, resumable review on verified normalized Call 2 JSON inputs."""
import argparse
import json
import os
from pathlib import Path

from review import MODELS, result, review


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", type=Path)
    parser.add_argument("private_state", type=Path)
    parser.add_argument("--model", choices=MODELS, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    key = os.environ["TRAINING_CLIPS_OPENAI_API_KEY"]
    receipts = args.private_state / "receipts"
    results = args.private_state / args.model
    for path in (receipts, results):
        path.mkdir(parents=True, exist_ok=True)
    occurrences = set()
    for path in sorted(args.inputs.glob("*.json")):
        source = json.loads(path.read_text())
        call = source["call"]
        if call["uuid"] in occurrences:
            raise ValueError("Resolve duplicate input occurrences before review")
        occurrences.add(call["uuid"])
        receipt = review(source, args.model, receipts, key)
        validated = result(receipt, call)
        target = results / path.name
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps({"result": validated, "usage": receipt["usage"], "response": receipt["id"]}))
        tmp.replace(target)


if __name__ == "__main__":
    main()
