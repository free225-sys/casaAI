"""Captures des maquettes « après » (fichiers locaux, tout accès réseau bloqué) + mesures."""
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
AXE = (Path(os.environ["CASA_TOOLS_DIR"]) / "node_modules/axe-core/axe.min.js").read_text()
SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
VP = {"desktop-1440": (1440, 900), "mobile-390": (390, 844), "mobile-320": (320, 700)}
ALL = ["desktop-1440", "mobile-390", "mobile-320"]
SHOTS = [
    ("apres-catalogue", "", ALL), ("apres-catalogue", "vide", ["desktop-1440", "mobile-390"]),
    ("apres-lecon", "", ALL), ("apres-lecon", "echec", ["desktop-1440", "mobile-390"]),
    ("apres-dashboard", "", ALL), ("apres-dashboard", "erreur", ["desktop-1440"]),
    ("apres-admin-cours", "", ALL), ("apres-admin-cours", "suppression", ["desktop-1440", "mobile-390"]),
    ("apres-pdf-1-selection", "", ALL), ("apres-pdf-2-previsualisation", "", ALL), ("apres-pdf-3-resultat", "", ALL),
]

res = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, state, vps in SHOTS:
        for vp in vps:
            w, h = VP[vp]
            ctx = b.new_context(viewport={"width": w, "height": h}, locale="fr-FR")
            blocked = []
            ctx.route("**/*", lambda route: route.continue_() if route.request.url.startswith("file://") else (blocked.append(route.request.url), route.abort())[1])
            pg = ctx.new_page()
            url = (SRC / f"{name}.html").as_uri() + (f"#{state}" if state else "")
            pg.goto(url); pg.wait_for_load_state("networkidle"); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(300)
            fname = f"{name}{'-' + state if state else ''}--{vp}.png"
            if vp != "desktop-1440" and not state and name in ("apres-lecon", "apres-pdf-2-previsualisation"):
                pg.screenshot(path=str(OUT / fname.replace("--", "-ecran-initial--")), full_page=False)
            # Pleine page : les barres collantes sont remises dans le flux (sinon figées au 1er écran).
            pg.add_style_tag(content=".sticky-cta,.confirm-bar{position:static!important;box-shadow:none!important}")
            pg.screenshot(path=str(OUT / fname), full_page=(state != 'suppression'))
            info = pg.evaluate("({scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth})")
            pg.add_script_tag(content=AXE)
            axe = pg.evaluate("""async () => (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,targets:v.nodes.slice(0,3).map(n=>n.target.join(' '))}))""")
            res.append({"file": fname, "viewport": vp, "state": state or "nominal", **info, "axe_violations": axe, "blocked_external": blocked})
            print(fname, "OVERFLOW" if info["scrollWidth"] > info["clientWidth"] else "ok", info["scrollWidth"], [(v["id"], v["nodes"], v["targets"]) for v in axe], len(blocked))
            ctx.close()
    b.close()
(OUT / "_mesures-apres.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
