import json
import os

FILE = os.path.join("C:", os.sep, "Users", "sn1096448", "Desktop", "senai-parceiros", "src", "data", "pesquisadores.json")

with open(FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

print(f"Loaded {len(data)} entries.")

changed = 0
for entry in data:
    nome = entry.get("nome", "")
    name_param = nome.replace(" ", "+")
    new_url = (
        "https://ui-avatars.com/api/"
        "?name=" + name_param +
        "&size=128"
        "&background=random"
        "&color=fff"
        "&bold=true"
        "&format=png"
    )
    old_url = entry.get("foto", "")
    if old_url != new_url:
        entry["foto"] = new_url
        changed += 1
        eid = entry.get("id", "?")
        print(f"  [{eid}] {nome}")

with open(FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print()
print(f"Done. Updated {changed}/{len(data)} foto URLs.")
