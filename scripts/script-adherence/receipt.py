"""Read one known pilot execution into an ignored receipt file; never replay it."""
import json
import ssl
import sys
import tomllib
import urllib.request
from pathlib import Path
import certifi

execution_id, output_name = sys.argv[1:]
if not execution_id.isdigit() or Path(output_name).name != output_name:
    raise ValueError("Invalid receipt target")
env = tomllib.loads(Path.home().joinpath(".codex/config.toml").read_text())["mcp_servers"]["n8n"]["env"]
base = env["N8N_API_URL"].rstrip("/")
if base != "https://insidesuccess.app.n8n.cloud":
    raise ValueError("Unexpected n8n instance")
req = urllib.request.Request(base + "/api/v1/executions/" + execution_id + "?includeData=true", headers={"X-N8N-API-KEY": env["N8N_API_KEY"]})
with urllib.request.urlopen(req, context=ssl.create_default_context(cafile=certifi.where()), timeout=30) as response:
    data = json.load(response)
if data["workflowId"] != "2xX5gVtc1BKlhyG3":
    raise ValueError("Not the pilot workflow")
runs = data["data"]["resultData"]["runData"]
receipts = runs["Pilot receipts"][0]["data"]["main"][0][0]["json"]["results"]
path = Path(".private-adherence") / output_name
path.write_text(json.dumps(receipts))
path.chmod(0o600)
print({"execution": execution_id, "status": data["status"], "receipts": len(receipts)})
