"""Rendu isolé du frontend au SHA 65bcde7 (code applicatif d2e9d9a) avec API simulée.

Aucun serveur : la build statique (dist/) et l'API sont servies par interception
réseau Playwright. Aucune requête ne sort du navigateur (tout domaine non routé
est bloqué et journalisé).
"""
from __future__ import annotations

import json
import os
import mimetypes
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from mockapi import MockApi

HERE = Path(__file__).parent
DIST = Path(os.environ["CASA_RENDER_DIR"]) / "frontend/dist"  # build Vite de la copie isolée
FONTS = Path(os.environ["CASA_TOOLS_DIR"]) / "node_modules/@fontsource"  # @fontsource/* installés hors dépôt
AXE = (Path(os.environ["CASA_TOOLS_DIR"]) / "node_modules/axe-core/axe.min.js").read_text()
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
APP = "http://app.local"

FONT_FILES = {
    ("IBM Plex Sans", w): FONTS / f"ibm-plex-sans/files/ibm-plex-sans-latin-{w}-normal.woff2" for w in (400, 500, 600, 700)
}
FONT_FILES.update({("Space Grotesk", w): FONTS / f"space-grotesk/files/space-grotesk-latin-{w}-normal.woff2" for w in (500, 600, 700)})
FONT_FILES.update({("IBM Plex Mono", w): FONTS / f"ibm-plex-mono/files/ibm-plex-mono-latin-{w}-normal.woff2" for w in (400, 500)})
FONT_CSS = "\n".join(
    f"@font-face{{font-family:'{fam}';font-weight:{w};font-style:normal;font-display:block;"
    f"src:url(https://fonts.gstatic.com/local/{p.name}) format('woff2');}}"
    for (fam, w), p in FONT_FILES.items()
)
FONT_BY_NAME = {p.name: p for p in FONT_FILES.values()}

VIEWPORTS = {"desktop-1440": (1440, 900), "mobile-390": (390, 844), "mobile-320": (320, 700)}


def make_router(api: MockApi, blocked: list):
    def handler(route):
        req = route.request
        url = req.url
        if url.startswith(APP):
            path = url[len(APP):].split("?")[0]
            f = DIST / path.lstrip("/")
            if path != "/" and f.is_file():
                ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
                return route.fulfill(status=200, body=f.read_bytes(), headers={"content-type": ctype})
            return route.fulfill(status=200, body=(DIST / "index.html").read_bytes(), headers={"content-type": "text/html"})
        if url.startswith("http://api.mock"):
            cors = {"access-control-allow-origin": APP, "access-control-allow-headers": "*",
                    "access-control-allow-methods": "*", "content-type": "application/json"}
            if req.method == "OPTIONS":
                return route.fulfill(status=204, headers=cors)
            status, body = api.respond(req.method, url, req.headers)
            return route.fulfill(status=status, body=json.dumps(body), headers=cors)
        if url.startswith("https://fonts.googleapis.com/"):
            return route.fulfill(status=200, body=FONT_CSS, headers={"content-type": "text/css", "access-control-allow-origin": "*"})
        if url.startswith("https://fonts.gstatic.com/local/"):
            p = FONT_BY_NAME[url.rsplit("/", 1)[1]]
            return route.fulfill(status=200, body=p.read_bytes(), headers={"content-type": "font/woff2", "access-control-allow-origin": "*"})
        blocked.append(url)
        return route.abort()
    return handler


def reveal_all(page):
    """Fait défiler la page pour déclencher les RevealSection, puis revient en haut."""
    h = page.evaluate("document.documentElement.scrollHeight")
    y = 0
    while y < h:
        page.evaluate(f"window.scrollTo(0,{y})"); page.wait_for_timeout(120); y += 400
        h = page.evaluate("document.documentElement.scrollHeight")
    page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(900)


def measure(page):
    m = page.evaluate("""() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflowing: [...document.querySelectorAll('body *')].filter(e => {
         const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > document.documentElement.clientWidth + 1);
      }).slice(0, 8).map(e => (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '') + ' «' + (e.innerText||'').slice(0,40).replace(/\\n/g,' ') + '»'))
    })""")
    page.add_script_tag(content=AXE)
    axe = page.evaluate("""async () => { const r = await axe.run(document, {runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
       return r.violations.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help})); }""")
    m["axe_violations"] = axe
    return m


def run(scenarios):
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for sc in scenarios:
            for vp in sc.get("viewports", ["desktop-1440", "mobile-390", "mobile-320"]):
                api = MockApi(**sc.get("api", {}))
                blocked: list = []
                w, h = VIEWPORTS[vp]
                ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, locale="fr-FR",
                                          reduced_motion="reduce")
                if sc.get("token"):
                    ctx.add_init_script(f"localStorage.setItem('casa_access_token','{sc['token']}');localStorage.setItem('casa_refresh_token','r');")
                ctx.route("**/*", make_router(api, blocked))
                page = ctx.new_page()
                console = []
                page.on("console", lambda msg: console.append(f"{msg.type}: {msg.text}"[:200]))
                page.on("pageerror", lambda err: console.append(f"pageerror: {err}"[:200]))
                page.goto(APP + sc["path"]); page.wait_for_load_state("networkidle"); page.wait_for_timeout(500)
                for step in sc.get("steps", []):
                    step(page)
                    page.wait_for_load_state("networkidle"); page.wait_for_timeout(400)
                if sc.get("full", True):
                    reveal_all(page)
                if sc.get("before_shot"):
                    sc["before_shot"](page); page.wait_for_timeout(600)
                name = f"{sc['name']}--{vp}.png"
                page.screenshot(path=str(OUT / name), full_page=sc.get("full", True))
                info = measure(page)
                results.append({"file": name, "scenario": sc["name"], "viewport": vp, "path": sc["path"],
                                "requests": api.log, "blocked_external": blocked, "console": console, **info})
                ctx.close()
        browser.close()
    return results


def set_pdf(page):
    page.set_input_files("#file", files=[{"name": "support-synthetique.pdf", "mimeType": "application/pdf",
                                          "buffer": b"%PDF-1.4\n% fichier synthetique, contenu sans importance (API simulee)\n"}])


SCENARIOS = [
    {"name": "avant-catalogue", "path": "/catalog"},
    {"name": "avant-catalogue-recherche-vide", "path": "/catalog", "viewports": ["desktop-1440"],
     "steps": [lambda p: p.fill(".catalog-search", "blockchain")]},
    {"name": "avant-lecon", "path": "/app/lessons/vectors-tensors", "token": "mock-learner"},
    {"name": "avant-lecon-defilement", "path": "/app/lessons/vectors-tensors", "token": "mock-learner", "full": False,
     "viewports": ["desktop-1440", "mobile-390"],
     "before_shot": lambda p: p.evaluate("window.scrollTo(0, 700)")},
    {"name": "avant-lecon-echec-completion", "path": "/app/lessons/vectors-tensors", "token": "mock-learner",
     "api": {"complete_ok": False}, "viewports": ["desktop-1440"], "full": False,
     "steps": [lambda p: p.get_by_role("button", name="Marquer comme terminée").click()],
     "before_shot": lambda p: p.get_by_role("button", name="Marquer comme terminée").scroll_into_view_if_needed()},
    {"name": "avant-dashboard", "path": "/app/dashboard", "token": "mock-learner"},
    {"name": "avant-dashboard-erreur-api", "path": "/app/dashboard", "token": "mock-learner", "viewports": ["desktop-1440"],
     "api": {"failures": {r"/api/me/(progress|skills|badges)": 500}}},
    {"name": "avant-admin-cours", "path": "/admin/courses", "token": "mock-admin"},
    {"name": "avant-admin-cours-filtre-brouillons", "path": "/admin/courses", "token": "mock-admin", "viewports": ["desktop-1440"],
     "full": False, "steps": [lambda p: p.get_by_role("button", name="Brouillons").click(), lambda p: p.mouse.move(5, 880)]},
    {"name": "avant-pdf-1-selection", "path": "/admin/import-pdf", "token": "mock-admin", "steps": [set_pdf]},
    {"name": "avant-pdf-2-previsualisation", "path": "/admin/import-pdf", "token": "mock-admin",
     "steps": [set_pdf, lambda p: p.get_by_role("button", name="Analyser").click()]},
    {"name": "avant-pdf-3-resultat", "path": "/admin/import-pdf", "token": "mock-admin",
     "steps": [set_pdf, lambda p: p.get_by_role("button", name="Analyser").click(),
               lambda p: p.get_by_role("button", name="Valider et importer").click()]},
]

if __name__ == "__main__":
    only = sys.argv[2:] or None
    res = run([s for s in SCENARIOS if not only or s["name"] in only])
    (OUT / "_mesures-avant.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    for r in res:
        print(r["file"], "overflow" if r["scrollWidth"] > r["clientWidth"] else "ok", r["scrollWidth"], "axe:",
              [(v["id"], v["nodes"]) for v in r["axe_violations"]], "blocked:", len(r["blocked_external"]),
              "console:", [c for c in r["console"] if "error" in c][:2])
