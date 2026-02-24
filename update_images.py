#!/usr/bin/env python3
"""
update_images.py
================
Updates image URLs across three JSON data files:

1. stakeholders.json & escolas.json:
   - Replaces Clearbit logo URLs with Google Favicons at 128px.
   - Extracts domain from the existing clearbit URL or falls back to the website field.

2. pesquisadores.json:
   - Sets empty "foto" fields to a DiceBear initials avatar URL based on the researcher's name.

All files are saved with indent=2 and ensure_ascii=False.
"""

import json
import re
from urllib.parse import urlparse
from pathlib import Path

BASE_DIR = Path(r"C:\Users\sn1096448\Desktop\senai-parceiros\src\data")

STAKEHOLDERS_PATH = BASE_DIR / "stakeholders.json"
ESCOLAS_PATH      = BASE_DIR / "escolas.json"
PESQUISADORES_PATH = BASE_DIR / "pesquisadores.json"


def extract_domain(url: str) -> str:
    """Extract the domain (host) from any URL, stripping www. prefix."""
    if not url:
        return ""
    # Ensure the URL has a scheme so urlparse works correctly
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    domain = parsed.hostname or ""
    return domain


def clearbit_to_google_favicon(entry: dict, logo_key: str = "logo") -> dict:
    """
    Replace a Clearbit logo URL with a Google Favicon URL.
    Falls back to the 'website' field if the Clearbit URL is missing or malformed.
    """
    current_logo = entry.get(logo_key, "")
    domain = ""

    # Try to extract domain from the current clearbit URL
    if current_logo and "logo.clearbit.com" in current_logo:
        # The clearbit URL format is https://logo.clearbit.com/DOMAIN
        # So the domain is the path component after the host
        match = re.search(r"logo\.clearbit\.com/(.+)", current_logo)
        if match:
            domain = match.group(1).strip().rstrip("/")

    # Fallback: extract domain from the website field
    if not domain:
        website = entry.get("website", "")
        domain = extract_domain(website)

    if domain:
        entry[logo_key] = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
    else:
        print(f"  WARNING: Could not determine domain for entry id={entry.get('id')}, "
              f"nome/instituicao={entry.get('nome', entry.get('instituicao', 'N/A'))}")

    return entry


def set_dicebear_avatar(entry: dict) -> dict:
    """Set the 'foto' field to a DiceBear initials avatar URL based on the researcher's name."""
    name = entry.get("nome", "").strip()
    if name:
        # URL-encode the name for the seed parameter (spaces become %20)
        seed = name.replace(" ", "%20")
        entry["foto"] = f"https://api.dicebear.com/7.x/initials/svg?seed={seed}"
    else:
        print(f"  WARNING: Empty name for pesquisador id={entry.get('id')}")
    return entry


def load_json(path: Path) -> list:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: list) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved {path.name} ({len(data)} entries)")


def main():
    # --- Stakeholders ---
    print("Processing stakeholders.json ...")
    stakeholders = load_json(STAKEHOLDERS_PATH)
    for entry in stakeholders:
        clearbit_to_google_favicon(entry, logo_key="logo")
    save_json(STAKEHOLDERS_PATH, stakeholders)

    # --- Escolas ---
    print("Processing escolas.json ...")
    escolas = load_json(ESCOLAS_PATH)
    for entry in escolas:
        clearbit_to_google_favicon(entry, logo_key="logo")
    save_json(ESCOLAS_PATH, escolas)

    # --- Pesquisadores ---
    print("Processing pesquisadores.json ...")
    pesquisadores = load_json(PESQUISADORES_PATH)
    for entry in pesquisadores:
        set_dicebear_avatar(entry)
    save_json(PESQUISADORES_PATH, pesquisadores)

    print("\nDone! All 3 files updated successfully.")


if __name__ == "__main__":
    main()
