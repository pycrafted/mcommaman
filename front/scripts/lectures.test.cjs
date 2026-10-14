// Teste les lectures réelles avec un fetch simulé, sans dépendance de test ajoutée.
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");

// Ces deux modules ne dépendent que de fetch. Compilation en mémoire pour
// tester le TypeScript du projet avec le lanceur natif de Node.
const modules = new Map();
function charger(nom) {
  if (modules.has(nom)) return modules.get(nom);
  const fichier = resolve(__dirname, `../lib/${nom}.ts`);
  const code = ts.transpileModule(readFileSync(fichier, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (chemin) => {
      if (chemin !== "./api") throw new Error(`Import inattendu : ${chemin}`);
      return charger("api");
    }, module, module.exports,
  );
  modules.set(nom, module.exports);
  return module.exports;
}
const { lirePageCatalogue, lireFacettes } = charger("catalogue");

for (const [nom, lire] of [["catalogue", lirePageCatalogue], ["facettes", lireFacettes]]) {
  test(`${nom} : une lecture annulée ne devient pas un résultat vide`, async (t) => {
    const controleur = new AbortController();
    t.mock.method(globalThis, "fetch", async (_url, options) => {
      assert.equal(options.signal, controleur.signal);
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    });
    const resultat = lire({ rayon: "robes" }, controleur.signal);
    controleur.abort();
    await assert.rejects(resultat, { name: "AbortError" });
  });
}

test("le catalogue conserve les filtres et la pagination", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get("rayon"), "robes");
    assert.equal(params.get("taille"), "4,6");
    assert.equal(params.get("page"), "2");
    assert.equal(params.get("page_size"), "24");
    return Response.json({ count: 60, results: [] });
  });
  assert.deepEqual(await lirePageCatalogue({ rayon: "robes", tailles: ["4", "6"], page: 2 }), {
    produits: [], total: 60, pages: 3,
  });
});

test("une panne réseau conserve le repli habituel", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Réseau indisponible"); });
  assert.deepEqual(await lirePageCatalogue(), { produits: [], total: 0, pages: 1 });
  assert.equal((await lireFacettes()).total, 0);
});
