#!/usr/bin/env python3
import json
import sys
import time
import os

sys.stdout.reconfigure(encoding="utf-8")
os.environ["PYTHONUNBUFFERED"] = "1"
import functools
print = functools.partial(print, flush=True)

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    import urllib.request
    import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.join(SCRIPT_DIR, "src", "data")
STAKEHOLDERS_FILE = os.path.join(BASE_DIR, "stakeholders.json")
ESCOLAS_FILE = os.path.join(BASE_DIR, "escolas.json")
PESQUISADORES_FILE = os.path.join(BASE_DIR, "pesquisadores.json")
TIMEOUT = 5
PROGRESS_EVERY = 20
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}


def check_url(url):
    if not url or not url.strip():
        return False, "EMPTY_URL"
    if HAS_REQUESTS:
        try:
            r = requests.head(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
            if r.status_code == 405:
                r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True, stream=True)
            return r.status_code < 400, str(r.status_code)
        except requests.exceptions.Timeout:
            return False, "TIMEOUT"
        except requests.exceptions.ConnectionError:
            return False, "CONNECTION_ERROR"
        except requests.exceptions.RequestException as e:
            return False, "ERROR: " + type(e).__name__
    else:
        req = urllib.request.Request(url, method="HEAD", headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return resp.status < 400, str(resp.status)
        except urllib.error.HTTPError as e:
            return False, str(e.code)
        except urllib.error.URLError as e:
            return False, "URL_ERROR: " + str(e.reason)
        except Exception as e:
            return False, "ERROR: " + type(e).__name__


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def test_url_list(urls, label, source_names=None):
    total = len(urls)
    working = 0
    broken = 0
    broken_details = []
    for i, url in enumerate(urls):
        ok, status = check_url(url)
        if ok:
            working += 1
        else:
            broken += 1
            name = source_names[i] if source_names else "#" + str(i + 1)
            broken_details.append((name, url, status))
        checked = i + 1
        if checked % PROGRESS_EVERY == 0 or checked == total:
            pline = "  [" + label + "] Checked " + str(checked) + "/" + str(total) + "..."
            print(pline)
    return {"total": total, "working": working, "broken": broken, "broken_details": broken_details}


def main():
    start_time = time.time()
    print("=" * 70)
    print("  SENAI PARCEIROS - URL Health Check")
    print("=" * 70)
    print()

    # 1. stakeholders.json
    print("Loading stakeholders.json ...")
    stakeholders = load_json(STAKEHOLDERS_FILE)
    print("  Found " + str(len(stakeholders)) + " stakeholder entries.")
    print()

    s_logo_urls = [s.get("logo", "") for s in stakeholders]
    s_names = [s.get("nome", "ID " + str(s.get("id"))) for s in stakeholders]
    s_web_urls = [s.get("website", "") for s in stakeholders]

    print("Testing stakeholder LOGO URLs ...")
    s_logo_results = test_url_list(s_logo_urls, "stakeholders/logos", s_names)
    print()
    print("Testing stakeholder WEBSITE URLs ...")
    s_web_results = test_url_list(s_web_urls, "stakeholders/websites", s_names)

    # 2. escolas.json
    print()
    print("-" * 70)
    print("Loading escolas.json ...")
    escolas = load_json(ESCOLAS_FILE)
    print("  Found " + str(len(escolas)) + " escola entries.")
    print()

    e_logo_urls = [e.get("logo", "") for e in escolas]
    e_names = [e.get("instituicao", "ID " + str(e.get("id"))) for e in escolas]
    e_web_urls = [e.get("website", "") for e in escolas]

    print("Testing escola LOGO URLs ...")
    e_logo_results = test_url_list(e_logo_urls, "escolas/logos", e_names)
    print()
    print("Testing escola WEBSITE URLs ...")
    e_web_results = test_url_list(e_web_urls, "escolas/websites", e_names)

    # 3. pesquisadores.json
    print()
    print("-" * 70)
    print("Loading pesquisadores.json ...")
    pesquisadores = load_json(PESQUISADORES_FILE)
    print("  Found " + str(len(pesquisadores)) + " pesquisador entries.")
    print()

    n = len(pesquisadores)
    sample_indices = [0, n // 3, 2 * n // 3, n - 1]
    sample_fotos = [(pesquisadores[i].get("nome", "#" + str(i)), pesquisadores[i].get("foto", "")) for i in sample_indices]

    print("Testing " + str(len(sample_fotos)) + " sample pesquisador FOTO URLs (DiceBear API) ...")
    p_foto_working = 0
    p_foto_broken = 0
    p_foto_broken_details = []
    for name, url in sample_fotos:
        ok, status = check_url(url)
        symbol = "OK" if ok else "BROKEN"
        print("  [" + symbol + "] " + name + ": " + status)
        if ok:
            p_foto_working += 1
        else:
            p_foto_broken += 1
            p_foto_broken_details.append((name, url, status))

    # Broken details
    all_sections = [
        ("Stakeholder LOGOS (broken)", s_logo_results),
        ("Stakeholder WEBSITES (broken)", s_web_results),
        ("Escola LOGOS (broken)", e_logo_results),
        ("Escola WEBSITES (broken)", e_web_results),
    ]
    has_any_broken = any(r["broken"] > 0 for _, r in all_sections) or p_foto_broken > 0

    if has_any_broken:
        print()
        print("=" * 70)
        print("  BROKEN URL DETAILS")
        print("=" * 70)
        for section_name, results in all_sections:
            if results["broken"] > 0:
                print()
                print("  --- " + section_name + " ---")
                for name, url, status in results["broken_details"]:
                    print("    [" + status + "] " + name)
                    print("           " + url)
        if p_foto_broken > 0:
            print()
            print("  --- Pesquisador FOTOS (broken samples) ---")
            for name, url, status in p_foto_broken_details:
                print("    [" + status + "] " + name)
                print("           " + url)

    # Summary
    elapsed = time.time() - start_time
    print()
    print("=" * 70)
    print("  COMPREHENSIVE SUMMARY")
    print("=" * 70)

    def print_section(title, results):
        t = results["total"]
        w = results["working"]
        b = results["broken"]
        pct = (w / t * 100) if t > 0 else 0
        status_icon = "ALL OK" if b == 0 else str(b) + " BROKEN"
        title_padded = title + " " * max(0, 35 - len(title))
        w_str = str(w).rjust(4)
        t_str = str(t).ljust(4)
        pct_str = ("{:.1f}".format(pct)).rjust(5)
        print("  " + title_padded + "  " + w_str + "/" + t_str + " working (" + pct_str + "%)  [" + status_icon + "]")

    print()
    print_section("Stakeholder Logos", s_logo_results)
    print_section("Stakeholder Websites", s_web_results)
    print_section("Escola Logos", e_logo_results)
    print_section("Escola Websites", e_web_results)

    p_total = len(sample_fotos)
    p_status = "ALL OK" if p_foto_broken == 0 else str(p_foto_broken) + " BROKEN"
    ptitle = "Pesquisador Fotos (sampled)"
    ptitle_padded = ptitle + " " * max(0, 35 - len(ptitle))
    pw_str = str(p_foto_working).rjust(4)
    pt_str = str(p_total).ljust(4)
    print("  " + ptitle_padded + "  " + pw_str + "/" + pt_str + " working           [" + p_status + "]")

    total_checked = (s_logo_results["total"] + s_web_results["total"]
                     + e_logo_results["total"] + e_web_results["total"]
                     + len(sample_fotos))
    total_broken = (s_logo_results["broken"] + s_web_results["broken"]
                    + e_logo_results["broken"] + e_web_results["broken"]
                    + p_foto_broken)

    print()
    print("  TOTAL URLs checked: " + str(total_checked))
    print("  TOTAL broken:       " + str(total_broken))
    print("  Time elapsed:       " + "{:.1f}".format(elapsed) + " seconds")
    print("=" * 70)

    if total_broken == 0:
        print()
        print("  All URLs are reachable. No issues found.")
    else:
        print()
        print("  " + str(total_broken) + " URL(s) need attention. See broken details above.")
    print()


if __name__ == "__main__":
    main()
