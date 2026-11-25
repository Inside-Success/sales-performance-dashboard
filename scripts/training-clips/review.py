"""One paid review per exact source/model/prompt. Local state must be private."""
import hashlib
import json
from pathlib import Path

import urllib.request

PROMPT = Path(__file__).with_name("review-prompt.txt").read_text().strip()
MODELS = ("gpt-6-luna", "gpt-6.1-terra")
FIELDS = {"candidate": "boolean", "show": "string", "topic": "string",
          "training_moment": "array", "opening_cue": "string", "closing_cue": "string",
          "review_reason": "string"}
SCHEMA = {"type": "object", "additionalProperties": False, "required": list(FIELDS),
          "properties": {k: ({"type": "array", "items": {"type": "string"}} if t == "array"
                              else {"type": t}) for k, t in FIELDS.items()}}


for field in ("opening_cue", "closing_cue"):
    SCHEMA["properties"][field].update(description="Exact cue identifier such as C00042 from transcript, or NONE for No clip.", pattern=r"^(C[0-9]{5}|NONE)$")


def review(source, model, directory, key):
    if model not in MODELS:
        raise ValueError("Unknown pilot model")
    call = source["call"]
    data = {"title": source["title"], "rep": call["rep"], "show": call["show"],
            "transcript": [[f"C{i:05d}", e["start"], e["end"], e["speaker"], e["text"]]
                           for i, e in enumerate(call["entries"])]}
    payload = dict(model=model, reasoning_effort="medium", max_completion_tokens=6500,
                   messages=[{"role": "system", "content": PROMPT},
                             {"role": "user", "content": json.dumps(data, ensure_ascii=False)}],
                   response_format={"type": "json_schema", "json_schema": {
                       "name": "training_clip", "strict": True, "schema": SCHEMA}})
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    target = directory / (digest + ".json")
    if target.exists():
        return json.loads(target.read_text())
    # An existing claim with no receipt requires reconciliation after an interruption.
    claim = target.with_suffix(".claim")
    with claim.open("x") as handle:
        handle.write(model)
    request = urllib.request.Request("https://api.openai.com/v1/chat/completions", json.dumps(payload).encode(),
        {"Content-Type": "application/json", "Authorization": "Bearer " + key})
    with urllib.request.urlopen(request, timeout=240) as response:
        receipt = json.load(response)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(receipt))
    temporary.replace(target)
    return json.loads(target.read_text())


def result(receipt, call):
    choice = receipt["choices"][0]
    if choice["finish_reason"] != "stop":
        raise ValueError("Incomplete response")
    clip = json.loads(choice["message"]["content"])
    if clip["candidate"]:
        first, last = (int(clip[k].removeprefix("C")) for k in ("opening_cue", "closing_cue"))
        clip["opening_cue"], clip["closing_cue"] = first, last
        if not (0 <= first < last < len(call["entries"]) and clip["topic"].strip()
                and clip["training_moment"]):
            raise ValueError("Invalid candidate boundaries or description")
    return clip
