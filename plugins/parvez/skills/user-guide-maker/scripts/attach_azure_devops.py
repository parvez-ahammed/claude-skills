"""Attach files to an Azure DevOps work item. A file with the same name that is already
attached is replaced, so the work item never shows two versions of one guide.

Usage: python attach_azure_devops.py <workItemId> "<comment>" <file> [<file> ...]
Env:   ADO_ORG_URL  e.g. https://dev.azure.com/<your-org>
       ADO_PROJECT  the project name
Needs `az login` (uses an az access token, no PAT).
"""
import json
import os
import pathlib
import subprocess
import sys
import urllib.parse
import urllib.request

ORG = os.environ.get("ADO_ORG_URL", "").rstrip("/")
PROJECT = os.environ.get("ADO_PROJECT", "")
if not ORG or not PROJECT:
    sys.exit("Set ADO_ORG_URL and ADO_PROJECT.")
ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798"  # Azure DevOps app id, the same for every org

work_item_id, comment, *files = sys.argv[1:]
bad = [f for f in files if not pathlib.Path(f).name.startswith(f"{work_item_id}-")]
if bad:
    sys.exit(f"Refusing {bad}: the file name becomes the attachment name, so it must start with '{work_item_id}-'.")
token = subprocess.run(
    ["az", "account", "get-access-token", "--resource", ADO_RESOURCE, "--query", "accessToken", "-o", "tsv"],
    capture_output=True, text=True, shell=(os.name == "nt"), check=True,
).stdout.strip()


def call(method, url, body=None, content_type="application/json"):
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("Authorization", f"Bearer {token}")
    if body is not None:
        request.add_header("Content-Type", content_type)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read())


project = urllib.parse.quote(PROJECT)
item = call("GET", f"{ORG}/_apis/wit/workitems/{work_item_id}?$expand=relations&api-version=7.1")
relations = item.get("relations") or []
names = {pathlib.Path(f).name for f in files}
# Remove from the highest index down, so earlier indexes stay valid.
patch = [
    {"op": "remove", "path": f"/relations/{index}"}
    for index, relation in sorted(enumerate(relations), reverse=True)
    if relation["rel"] == "AttachedFile" and relation["attributes"].get("name") in names
]
for file in files:
    path = pathlib.Path(file)
    upload = call("POST", f"{ORG}/{project}/_apis/wit/attachments?fileName={urllib.parse.quote(path.name)}&api-version=7.1",
                  path.read_bytes(), "application/octet-stream")
    patch.append({"op": "add", "path": "/relations/-",
                  "value": {"rel": "AttachedFile", "url": upload["url"], "attributes": {"comment": comment}}})

result = call("PATCH", f"{ORG}/_apis/wit/workitems/{work_item_id}?api-version=7.1",
              json.dumps(patch).encode(), "application/json-patch+json")
print(f"Work item {work_item_id}: {result['fields']['System.Title']}")
for relation in result.get("relations") or []:
    if relation["rel"] == "AttachedFile":
        print("  attached:", relation["attributes"].get("name"), relation["attributes"].get("resourceSize"))
