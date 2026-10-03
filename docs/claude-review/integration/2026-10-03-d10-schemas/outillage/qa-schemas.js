const { chromium } = require("/opt/node-tools/node_modules/playwright");
const fs = require("fs");
const axeSrc = fs.readFileSync(__dirname + "/node_modules/axe-core/axe.min.js", "utf8");
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const user = { id: "u0", first_name: "TEST", last_name: "User", email: "u@example.test", role: "LEARNER", status: "ACTIVE" };
const body = "Un paragraphe de lecture synthétique. ".repeat(6);
const lesson = { id: "a", course_id: "c", title: "TEST leçon avec schémas", level: "N2", duration_min: 25, summary: "s", example: "e", position: 1, skill_id: null, demo_id: null, objectives: ["o"], validation_quiz_id: null, has_document: false, depth_levels: [],
  sections: [
    { position: 1, title: "Processus", body, diagram: { type: "flow", steps: ["Collecter les données", "Entraîner le modèle", "Évaluer", "Déployer en production"], caption: "Les étapes se suivent dans l'ordre." } },
    { position: 2, title: "Hiérarchie", body, diagram: { type: "hierarchy", items: ["Intelligence artificielle", "Apprentissage automatique", "Apprentissage profond"], caption: "Chaque niveau contient le suivant." } },
    { position: 3, title: "Matrice", body, diagram: { type: "matrix", xLabel: "Effort", yLabel: "Impact", quadrants: ["Gains rapides", "Projets majeurs", "À éviter", "À reporter"], caption: "Impact selon l'effort." } },
  ] };
const api = p => p === "/api/auth/me" ? user : p === "/api/lessons/a" ? lesson : p === "/api/lessons/a/start" ? { lesson_id: "a", status: "IN_PROGRESS", progress_pct: 0 } : p === "/api/courses/c" ? { id: "c", school_id: "s", title: "C", level: null, duration_min: null, color: null, description: null, final_quiz_id: null, resources: [], lessons: [] } : [];
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] }); const res = [];
  for (const [sz, w, h] of [["desktop-1440", 1440, 900], ["mobile-390", 390, 844], ["mobile-320", 320, 640], ["zoom200-720", 720, 450]]) {
    const c = await b.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(() => localStorage.setItem("casa_access_token", "x"));
    const p = await c.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 120)));
    await p.route("**/*", r => { const u = new URL(r.request().url()); if (u.hostname === "api.test") return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(api(u.pathname)) }); if (u.hostname !== "localhost") return r.abort(); return r.continue(); });
    await p.goto("http://localhost:4173/app/lessons/a"); await p.waitForSelector("text=Collecter les données"); await p.waitForTimeout(400);
    await p.evaluate(axeSrc);
    const axe = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }).then(r => r.violations.map(v => ({ id: v.id, n: v.nodes.length, sample: v.nodes[0].target.join(" ").slice(0, 90) }))));
    const m = await p.evaluate(() => {
      const sat = col => { const c = (col.match(/[\d.]+/g) || []).map(Number); return c.length >= 3 && c[3] !== 0 ? Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) : 0; };
      const root = document.querySelector(".course-content") || document.body;
      const colored = [...root.querySelectorAll("[role=img] *, [style*='border']")].filter(e => { const s = getComputedStyle(e); return (e.tagName.toLowerCase() === "rect" && sat(s.stroke) > 60) || ["Top", "Right", "Bottom", "Left"].some(d => parseFloat(s["border" + d + "Width"]) && s["border" + d + "Style"] !== "none" && sat(s["border" + d + "Color"]) > 60); }).length;
      // Étapes du flux : un <span> "N." suivi du libellé, dans la boîte parente. Collecte exacte depuis le DOM, sans filtre sur la lettre initiale.
      const flow = [...document.querySelectorAll("span")].filter(e => /^\d+\.$/.test(e.textContent || "")).map(e => (e.parentElement.textContent || "").trim());
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, colored, flow, svgs: document.querySelectorAll("[role=img]").length };
    });
    const el = await p.$("text=Processus"); await el.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${OUT}/integ-schemas--${sz}.png`, fullPage: true });
    const expected = ["1.Collecter les données", "2.Entraîner le modèle", "3.Évaluer", "4.Déployer en production"]; const flowOk = JSON.stringify(m.flow) === JSON.stringify(expected); if (!flowOk) { console.error("ECHEC flux", sz, JSON.stringify(m.flow)); process.exitCode = 1; }
    res.push({ file: `integ-schemas--${sz}.png`, flow_expected: expected, flow_matches_exactly: flowOk, ...m, axe_violations: axe, js_errors: errs }); await c.close();
  }
  fs.writeFileSync(OUT + "/_mesures.json", JSON.stringify(res, null, 1));
  for (const r of res) console.log(r.file, `${r.sw}/${r.cw}`, "colored:" + r.colored, "svg:" + r.svgs, "axe:" + r.axe_violations.map(a => a.id + "x" + a.n + "(" + a.sample + ")").join(","), "err:" + r.js_errors.length, "flow_ok:" + r.flow_matches_exactly + " " + JSON.stringify(r.flow));
  await b.close();
})();
