/* <<GESTION */
/* =====================================================================
   BACK-OFFICE : LES WORKFLOWS DU SERVEUR, ÉCRAN PAR ÉCRAN
   Chaque écriture part à /api/gestion/, puis on relit : ce que le serveur
   renvoie fait foi (stock recalculé, publication refusée, commande bloquée).
   ===================================================================== */
document.head.insertAdjacentHTML('beforeend', `<style>
.btn.mini{height:36px;padding-inline:14px;font-size:13px;gap:8px}
.btn.rouge{background:var(--rose-sombre)}
.acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.acts button,.acts a{font:600 12px var(--f-sans);padding:6px 10px;border-radius:999px;border:0;background:var(--poudre,#FCE3EC);color:var(--encre);cursor:pointer;white-space:nowrap}
.acts button:hover,.acts a:hover{background:var(--encre);color:var(--lait)}
.acts .danger{background:#EFE9EC;color:var(--rose-sombre)}
.tab tr[data-lien]{cursor:pointer}
.ph-fiche{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;margin-bottom:14px}
.ph-fiche figure{position:relative;aspect-ratio:3/4;border-radius:12px;background:#F6E9F0 center/cover;margin:0;overflow:hidden}
.ph-fiche figure .couv{position:absolute;left:6px;top:6px;font:600 10px var(--f-sans);background:var(--encre);color:#fff;border-radius:999px;padding:3px 8px}
.ph-fiche figure .ops{position:absolute;inset:auto 6px 6px;display:flex;gap:4px;justify-content:flex-end}
.ph-fiche figure .ops button{width:26px;height:26px;border-radius:50%;border:0;background:rgba(255,255,255,.92);cursor:pointer;font-size:13px;line-height:1}
.manques{display:flex;flex-direction:column;gap:8px;font-size:14px}
.manques span{display:flex;gap:10px;align-items:center}
.manques i{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:12px;background:#EFE9EC;color:var(--taupe)}
.manques .ok i{background:#E0F0E6;color:#2D6A47}
.var-tab{width:100%;border-collapse:collapse;font-size:14px}
.var-tab th{text-align:left;font-weight:600;color:var(--taupe);font-size:12px;padding:8px 6px;border-bottom:1px solid var(--filet)}
.var-tab td{padding:10px 6px;border-bottom:1px solid var(--filet);vertical-align:middle}
.var-tab select,.var-tab input{height:38px;font-size:14px;padding:0 12px;border-radius:10px;border:0;box-shadow:inset 0 0 0 1px var(--filet);background:var(--lait);width:100%}
.var-tab select{padding-right:30px}
.ajust{display:flex;gap:6px;align-items:center;margin-top:8px}
.ajust input{width:80px}
.mouv{font-size:12px;color:var(--taupe);margin-top:6px;display:flex;flex-direction:column;gap:2px}
.cloche{position:relative;width:40px;height:40px;border-radius:50%;border:0;background:var(--lait);box-shadow:inset 0 0 0 1px var(--filet);cursor:pointer;display:grid;place-items:center}
.cloche svg{width:18px;height:18px;fill:none;stroke:var(--encre);stroke-width:1.8}
.cloche b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:999px;background:var(--rose);color:#fff;font-size:11px;display:grid;place-items:center;padding:0 5px}
.cloche b:empty{display:none}
.notif-l{display:flex;flex-direction:column}
.notif-l a{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:12px 0;border-bottom:1px solid var(--filet);font-size:14px}
.notif-l a.neuve b::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--rose);margin-right:8px}
.notif-l small{color:var(--taupe)}
.saisie-l{display:flex;flex-direction:column;gap:10px}
.saisie-l > div{display:grid;grid-template-columns:44px 1fr auto auto;gap:12px;align-items:center;font-size:14px}
.saisie-l .v{width:44px;height:56px;border-radius:10px;background:#F6E9F0 center/cover}
.choix-ligne{display:grid;grid-template-columns:2fr 1.4fr 90px auto;gap:10px;align-items:end}
.choix-ligne select,.choix-ligne input{width:100%}
.recap-s{display:grid;grid-template-columns:1fr auto;gap:8px;font-size:14px}
.recap-s .t{font-size:22px;font-weight:800;border-top:1px solid var(--filet);padding-top:10px}
.avis-l article{display:flex;flex-direction:column;gap:8px;padding:18px 0;border-bottom:1px solid var(--filet)}
.avis-l .etoiles{color:var(--or);letter-spacing:2px}
.journal-l{display:flex;flex-direction:column;font-size:14px}
.journal-l div{display:grid;grid-template-columns:1fr auto;gap:12px;padding:10px 0;border-bottom:1px solid var(--filet)}
.journal-l small{color:var(--taupe);white-space:nowrap}
.mini-in{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.mini-in input{height:40px;padding:0 14px;border-radius:999px;border:0;box-shadow:inset 0 0 0 1px var(--filet);background:var(--lait);font:500 14px var(--f-sans);min-width:0;flex:1}
.mini-in input[type=color]{flex:0 0 46px;padding:4px;border-radius:12px}
.suppr-x{border:0;background:none;color:var(--taupe);cursor:pointer;font-size:16px;padding:0 4px}
.suppr-x:hover{color:var(--rose-sombre)}
.promo .remise.montant{font-size:clamp(34px,3.4vw,52px);white-space:nowrap}
.erreur-bloc{background:#FCE3EC;color:var(--rose-sombre);border-radius:14px;padding:12px 16px;font-size:14px}
@media (max-width:760px){.choix-ligne{grid-template-columns:1fr 1fr}.saisie-l > div{grid-template-columns:44px 1fr auto}}
</style>`);

const ZONES = {dakar:'Dakar et banlieue', thies:'Thiès, Mbour', regions:'Autres régions', retrait:'Retrait en boutique'};
const MOTIFS = {reappro:'Réapprovisionnement', retour:'Retour cliente', ajustement:'Ajustement manuel'};
const ST_PROD = {publie:['Publié', 'e-publie'], brouillon:['Brouillon', 'e-brouillon'], archive:['Archivé', 'e-annulee']};
const G2 = {cloche:{non_lues:0, notifications:[]}, vues:0, avis:[], filtreAvis:'en_attente', journal:[], rechCli:'', saisie:null, filtreP:'tous', rechP:''};
const attr = s => esc(String(s ?? '')).replace(/"/g, '&quot;');
const fondImg = u => u ? `background-image:url(${urlCss(absolu(u))})` : '';
const optionsRayons = (sel, vide = '') => {
  const rac = GS.rayons.filter(r => !(r.parents || []).length).sort((a, b) => (a.ordre - b.ordre) || a.nom.localeCompare(b.nom));
  return (vide ? `<option value="">${esc(vide)}</option>` : '') + rac.map(r => {
    const enf = GS.rayons.filter(e => (e.parents || []).includes(r.id));
    return `<option value="${r.id}" ${+sel === r.id ? 'selected' : ''}>${esc(r.nom)}</option>` + enf.map(e => `<option value="${e.id}" ${+sel === e.id ? 'selected' : ''}>&nbsp;&nbsp;— ${esc(e.nom)}</option>`).join('');
  }).join('');
};

async function envoyerFichier(chemin, donnees) {
  await assurerJeton();
  const partir = () => fetch(API + chemin, {method:'POST', credentials:'include', headers:{Accept:'application/json', 'X-CSRFToken': jeton || decodeURIComponent(lireCookie('csrftoken'))}, body:donnees});
  let r = await partir();
  if (r.status === 403) { jeton = ''; await assurerJeton(); r = await partir(); }
  const d = await r.json().catch(() => null);
  if (!r.ok) { const v = d && (d.detail || Object.values(d)[0]); throw new Error(Array.isArray(v) ? v[0] : v || 'Envoi refusé.'); }
  return d;
}
/* Une écriture, puis on relit tout : l'écran montre l'état réel. */
async function ecrire(action, ok) {
  try { const r = await action(); await chargerGestion(); if (ok) notifier(ok); return r === undefined || r === null ? true : r; }
  catch (e) { notifier(e.message); await chargerGestion().catch(() => {}); return false; }
}
/* La vitrine relit son catalogue sans quitter le back-office. */
async function rafraichirVitrine() {
  try {
    const [rayons, produits] = await Promise.all([toutesLesPages('/api/catalogue/rayons/'), toutesLesPages('/api/catalogue/produits/?page_size=500')]);
    etatServeur.rayons = rayons; etatServeur.racines = rayons.filter(r => !(r.parents || []).length);
    rayons.forEach(r => { etatServeur.parSlugRayon[r.slug] = r; (r.enfants || []).forEach(e => { if (!etatServeur.parSlugRayon[e.slug]) etatServeur.parSlugRayon[e.slug] = {...e, parents_slugs:[r.slug], parents_noms:[r.nom]}; }); });
    Object.keys(CATS).forEach(k => { if (k !== 'tous') delete CATS[k]; }); etatServeur.racines.forEach(r => CATS[r.slug] = r.nom);
    C.length = 0; Object.keys(parSlug).forEach(k => delete parSlug[k]);
    produits.forEach((b, k) => { const p = versCarte(b, k); C.push(p); parSlug[p.slug] = p; });
    verifierImages(); reconstruireNav(); rafraichirAccueil(); majCompteurs();
  } catch (_) {}
}
/* Petite boîte de confirmation dans le tiroir (pas de fenêtre du navigateur). */
function confirmer(titre, texte, bouton = 'Confirmer', danger = true) {
  return new Promise(ok => {
    $('#tiroir').innerHTML = `<div class="t-tete"><div><h2>${titre}</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
      <div class="t-corps"><p>${texte}</p></div><div class="t-pied"><button class="btn ${danger ? 'rouge' : ''}" type="button" id="cf-oui" style="flex:1">${bouton}</button><button class="btn clair" type="button" id="cf-non">Annuler</button></div>`;
    ouvrirTiroir();
    const fin = v => { fermerTiroir(); ok(v); };
    $('#cf-oui').onclick = () => fin(true); $('#cf-non').onclick = () => fin(false); $('#fermer-tiroir').onclick = () => fin(false);
  });
}
function ouvrirTiroir() { $('#tiroir').classList.add('on'); $('#voile-tiroir').classList.add('on'); $('#tiroir').scrollTop = 0; }

/* ------------------------------------------------------------ PRODUITS */
const ECRANS = {};
ECRANS.produits = {
  html() {
    if (rechercheProd) { G2.rechP = rechercheProd; G2.filtreP = 'tous'; rechercheProd = ''; }
    const cp = GS.compteurs || {}, f = G2.filtreP, q = G2.rechP.toLowerCase();
    const l = GS.produits.filter(p => (f === 'tous' || (f === 'ruptures' ? p.statut === 'publie' && p.stock_total <= 0 : p.statut === f)) && (!q || (p.nom + ' ' + p.sku + ' ' + p.rayon_nom).toLowerCase().includes(q)));
    return `<div class="adm-titre"><div><span class="mono">Catalogue</span><h1>Pro<span class="serif">duits</span></h1></div><div class="actions-t"><a class="btn" href="#admin-produit-nouveau">+ Nouveau produit</a></div></div>
    <p class="note-demo">Seuls les produits <b>publiés</b> apparaissent en boutique. Un brouillon se publie quand il a un nom, au moins une photo et un prix — le serveur refuse sinon et dit ce qui manque.</p>
    <div class="barre-outils">
      <div class="onglets-adm" role="group" aria-label="Filtrer">${[['tous', 'Tous', cp.tous], ['publie', 'Publiés', cp.publie], ['brouillon', 'Brouillons', cp.brouillon], ['archive', 'Archivés', cp.archive], ['ruptures', 'Ruptures', cp.rupture]].map(([k, v, n]) => `<button type="button" data-fp="${k}" aria-pressed="${f === k}">${v}<span>${n ?? ''}</span></button>`).join('')}</div>
      <label class="champ-recherche"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="rech-prod" placeholder="Nom, référence, rayon…" value="${attr(G2.rechP)}"></label>
    </div>
    <section class="panneau">${l.length ? `<div class="tableau-zone"><table class="tab"><thead><tr><th>Produit</th><th>Référence</th><th class="num">Prix</th><th class="num">Stock</th><th>Statut</th><th style="text-align:right">Actions</th></tr></thead><tbody>
      ${l.map(p => `<tr data-lien="admin-produit-${p.id}"><td><div class="cell-prod"><span class="vign" style="background:#F6E9F0 center/cover;${fondImg(p.image)}"></span><span><b>${esc(p.nom)}</b><small>${esc(p.rayon_nom)}</small></span></div></td><td class="ref">${esc(p.sku)}</td><td class="num">${F(p.prix)}</td>
        <td class="num">${p.stock_total <= 0 ? `<span style="color:var(--rose-sombre);font-weight:700">0</span>` : p.stock_total}</td>
        <td>${p.statut === 'publie' && p.stock_total <= 0 ? '<span class="puce-etat e-rupture">Rupture</span>' : `<span class="puce-etat ${ST_PROD[p.statut][1]}">${ST_PROD[p.statut][0]}</span>`}</td>
        <td><div class="acts">${p.statut === 'publie' ? `<button data-act="retirer" data-id="${p.id}">Retirer</button>` : `<button data-act="publier" data-id="${p.id}">Publier</button>`}<button data-act="dupliquer" data-id="${p.id}">Dupliquer</button>${p.statut !== 'archive' ? `<button data-act="archiver" data-id="${p.id}" class="danger">Archiver</button>` : `<button data-act="supprimer" data-id="${p.id}" class="danger">Supprimer</button>`}</div></td></tr>`).join('')}</tbody></table></div>
      <div class="pagination"><span>${l.length} produit${l.length > 1 ? 's' : ''} affiché${l.length > 1 ? 's' : ''} sur ${cp.tous ?? GS.produits.length}</span></div>`
      : '<div class="vide" style="border:0"><span class="grand-vide">Aucun produit</span><p>ne correspond à ce filtre.</p></div>'}</section>`;
  },
  lier() {
    $$('[data-fp]').forEach(b => b.onclick = () => { G2.filtreP = b.dataset.fp; rendreAdmin(); });
    const ri = $('#rech-prod'); ri.oninput = () => { G2.rechP = ri.value; const pos = ri.selectionStart; rendreAdmin().then(() => { const n = $('#rech-prod'); n.focus(); n.setSelectionRange(pos, pos); }); };
    $$('tr[data-lien]').forEach(tr => tr.onclick = e => { if (!e.target.closest('.acts')) location.hash = tr.dataset.lien; });
    $$('[data-act]').forEach(b => b.onclick = async e => { e.stopPropagation(); await actionProduit(b.dataset.act, +b.dataset.id); rendreAdmin(); });
  },
};
async function actionProduit(act, id) {
  const p = GS.produits.find(x => x.id === id) || {nom:'Ce produit'};
  if (act === 'supprimer' && !(await confirmer('Supprimer définitivement ?', `« ${esc(p.nom)} » sera supprimé de la base. Une fiche citée par une commande ne peut pas l'être : archivez-la plutôt.`, 'Supprimer'))) return false;
  if (act === 'archiver' && !(await confirmer('Archiver ce produit ?', `« ${esc(p.nom)} » quitte la boutique mais reste dans l'historique des commandes. Vous pourrez le remettre en brouillon.`, 'Archiver'))) return false;
  const faire = {
    publier: () => api(`/api/gestion/produits/${id}/publier/`, 'POST'),
    retirer: () => api(`/api/gestion/produits/${id}/`, 'PATCH', {statut:'brouillon'}),
    archiver: () => api(`/api/gestion/produits/${id}/archiver/`, 'POST'),
    dupliquer: () => api(`/api/gestion/produits/${id}/dupliquer/`, 'POST'),
    supprimer: () => api(`/api/gestion/produits/${id}/`, 'DELETE'),
  }[act];
  const msg = {publier:`${p.nom} est en ligne`, retirer:`${p.nom} repasse en brouillon`, archiver:`${p.nom} archivé`, dupliquer:'Copie créée en brouillon, stock à zéro', supprimer:`${p.nom} supprimé`}[act];
  const r = await ecrire(faire, msg);
  if (r && act !== 'dupliquer') rafraichirVitrine();
  return r;
}

/* La fiche : création et modification */
let FICHE = null;
const ficheVide = () => ({id:null, nom:'', slug:'', sku:'', prix:'', prix_barre:'', description:'', rayon:(GS.rayons[0] || {}).id || '', matieres:[], statut:'brouillon', photos:[], variantes:[], nouvelles:[], retirees:[], manques:[], modifie:false});
async function chargerFiche(id) {
  if (!id) { FICHE = ficheVide(); return; }
  const p = await api(`/api/gestion/produits/${id}/`);
  FICHE = {...p, prix_barre:p.prix_barre ?? '', photos:p.photos.map(x => ({media:x.media, url:x.url})), nouvelles:[], retirees:[], modifie:false};
}
const manquesLocaux = f => [!f.nom.trim() && 'un nom commercial', !f.photos.length && 'au moins une photo', !(+f.prix > 0) && 'un prix supérieur à zéro'].filter(Boolean);
ECRANS.fiche = {
  async avant(id) { if (!FICHE || FICHE.id !== id || !id) await chargerFiche(id); },
  html() {
    const f = FICHE, nouveau = !f.id, m = manquesLocaux(f);
    const tailles = GS.tailles, coloris = GS.coloris;
    return `<div class="adm-titre"><div><span class="mono"><a href="#admin-produits">Produits</a> / ${nouveau ? 'Nouveau' : esc(f.sku)}</span><h1>${nouveau ? 'Nouveau <span class="serif">produit</span>' : esc(f.nom)}</h1></div>
      <div class="actions-t">${f.id && f.statut === 'publie' ? `<a class="btn clair" href="#p-${attr(f.slug)}">Voir en boutique</a>` : ''}<a class="btn clair" href="#admin-produits">Retour</a></div></div>
    <div class="editeur">
      <div style="display:flex;flex-direction:column;gap:clamp(16px,2vw,24px)">
        <section class="panneau formulaire"><h2 style="font-size:20px;margin:0">L'essentiel</h2>
          <div class="champ"><input id="fp-nom" placeholder=" " value="${attr(f.nom)}"><label for="fp-nom">Nom commercial</label></div>
          <div class="rangee"><div class="champ"><input id="fp-prix" type="number" min="0" step="500" placeholder=" " value="${attr(f.prix)}"><label for="fp-prix">Prix (F CFA)</label></div><div class="champ"><input id="fp-barre" type="number" min="0" step="500" placeholder=" " value="${attr(f.prix_barre)}"><label for="fp-barre">Prix barré (facultatif)</label><span class="aide">Doit être plus élevé que le prix.</span></div></div>
          <div class="champ"><textarea id="fp-desc" placeholder=" ">${esc(f.description)}</textarea><label for="fp-desc">Description</label></div>
          <div class="rangee"><div class="champ"><input id="fp-sku" placeholder=" " value="${attr(f.sku)}"><label for="fp-sku">Référence interne</label><span class="aide">Proposée par le serveur à partir du nom.</span></div><div class="champ"><input id="fp-slug" placeholder=" " value="${attr(f.slug)}"><label for="fp-slug">Adresse en boutique</label><span class="aide" id="fp-slug-aide">/p/${esc(f.slug || '…')}</span></div></div>
        </section>
        <section class="panneau"><h2 style="font-size:20px;margin-bottom:16px">Photos <span class="mono" style="color:var(--taupe);font-size:12px">· la première est la couverture</span></h2>
          <div class="ph-fiche">${f.photos.map((ph, k) => `<figure style="${fondImg(ph.url)}">${k === 0 ? '<span class="couv">Couverture</span>' : ''}<span class="ops">${k ? `<button type="button" data-ph="gauche" data-k="${k}" aria-label="Avancer">←</button>` : ''}${k < f.photos.length - 1 ? `<button type="button" data-ph="droite" data-k="${k}" aria-label="Reculer">→</button>` : ''}<button type="button" data-ph="retirer" data-k="${k}" aria-label="Retirer">×</button></span></figure>`).join('')}</div>
          <label class="depot" id="fp-depot"><input type="file" id="fp-fichiers" accept="image/*" multiple hidden><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg><b style="color:var(--encre)">Glissez vos photos ici ou cliquez</b><span>Elles rejoignent la photothèque du serveur</span></label>
          <div style="margin-top:12px"><button class="lien" type="button" id="fp-biblio" style="font-size:14px;color:var(--rose-sombre)">Choisir dans la photothèque (${GS.photosTotal})</button></div>
        </section>
        <section class="panneau" style="display:flex;flex-direction:column;gap:18px"><h2 style="font-size:20px">Rangement</h2>
          <div><span class="etiquette-champ">Catégorie</span><select class="select-adm" id="fp-rayon">${optionsRayons(f.rayon)}</select></div>
          <div><span class="etiquette-champ">Matières</span><div class="puces-choix" id="fp-mat">${GS.matieres.map(x => `<button type="button" data-v="${x.id}" aria-pressed="${f.matieres.includes(x.id)}">${esc(x.nom)}</button>`).join('') || '<span class="aide">Aucune matière : ajoutez-en dans Tailles, coloris, photos.</span>'}</div></div>
        </section>
        <section class="panneau"><div class="tete"><h2 style="font-size:20px">Tailles et stock</h2><span class="mono" style="color:var(--taupe)">${f.variantes.reduce((s, v) => s + v.stock, 0) + f.nouvelles.reduce((s, v) => s + (+v.stock || 0), 0)} en stock</span></div>
          <p class="aide" style="font-size:13px;color:var(--taupe);margin:-6px 0 12px">Chaque taille (et coloris) est une variante qui se vend. Le stock d'une variante existante se corrige par un ajustement tracé.</p>
          <table class="var-tab"><thead><tr><th>Taille</th><th>Coloris</th><th>Stock</th><th></th></tr></thead><tbody>
          ${f.variantes.map(v => `<tr><td><b>${esc(v.taille_valeur)}</b> <small style="color:var(--taupe)">${esc(v.taille_repere || '')}</small></td><td>${v.coloris_nom ? `<span style="display:inline-flex;gap:6px;align-items:center"><i style="width:12px;height:12px;border-radius:50%;background:${attr(v.coloris_hexa)};box-shadow:inset 0 0 0 1px var(--filet)"></i>${esc(v.coloris_nom)}</span>` : '—'}</td>
            <td><b style="${v.stock <= 0 ? 'color:var(--rose-sombre)' : ''}">${v.stock}</b>${f.id ? `<div class="ajust" data-aj="${v.id}"><input type="number" placeholder="+/−" aria-label="Quantité"><select aria-label="Motif">${Object.entries(MOTIFS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select><button class="btn mini clair" type="button">Ajuster</button></div><div class="mouv" id="mv-${v.id}"></div>` : ''}</td>
            <td style="text-align:right">${v.stock === 0 ? `<button class="suppr-x" type="button" data-retv="${v.id}" title="Retirer cette taille">×</button>` : `<button class="lien" type="button" data-hist="${v.id}" style="font-size:12px">Historique</button>`}</td></tr>`).join('')}
          ${f.nouvelles.map((v, k) => `<tr data-nv="${k}"><td><select data-c="taille">${tailles.map(t => `<option value="${t.id}" ${+v.taille === t.id ? 'selected' : ''}>${esc(t.valeur)}${t.repere ? ' · ' + esc(t.repere) : ''}</option>`).join('')}</select></td><td><select data-c="coloris"><option value="">Sans coloris</option>${coloris.map(c => `<option value="${c.id}" ${+v.coloris === c.id ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></td><td><input type="number" min="0" data-c="stock" value="${attr(v.stock)}"></td><td style="text-align:right"><button class="suppr-x" type="button" data-retn="${k}">×</button></td></tr>`).join('')}
          </tbody></table>
          <div style="margin-top:14px"><button class="btn mini clair" type="button" id="fp-plus">+ Ajouter une taille</button></div>
        </section>
      </div>
      <aside class="apercu">
        <section class="panneau" style="display:flex;flex-direction:column;gap:16px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="mono">Statut</span><span class="puce-etat ${ST_PROD[f.statut][1]}">${ST_PROD[f.statut][0]}</span></div>
          <div class="manques"><span class="${f.nom.trim() ? 'ok' : ''}"><i>${f.nom.trim() ? '✓' : ''}</i>Un nom commercial</span><span class="${f.photos.length ? 'ok' : ''}"><i>${f.photos.length ? '✓' : ''}</i>Au moins une photo</span><span class="${+f.prix > 0 ? 'ok' : ''}"><i>${+f.prix > 0 ? '✓' : ''}</i>Un prix supérieur à zéro</span></div>
          ${m.length ? `<p style="font-size:13px;color:var(--taupe)">Il manque encore ${m.join(', ')} pour publier.</p>` : ''}
          <div id="fp-err"></div>
          <button class="btn" type="button" id="fp-publier" ${m.length ? 'disabled style="opacity:.45"' : ''}>${f.statut === 'publie' ? 'Enregistrer' : 'Enregistrer et publier'}</button>
          <button class="btn clair" type="button" id="fp-brouillon">${f.statut === 'publie' ? 'Retirer de la boutique' : 'Enregistrer le brouillon'}</button>
          ${f.id ? `<div class="acts" style="justify-content:flex-start"><button type="button" data-fa="dupliquer">Dupliquer</button>${f.statut !== 'archive' ? '<button type="button" data-fa="archiver" class="danger">Archiver</button>' : ''}<button type="button" data-fa="supprimer" class="danger">Supprimer</button></div>` : ''}
        </section>
        <div id="fp-apercu" style="pointer-events:none"></div>
      </aside>
    </div>`;
  },
  lier() {
    const f = FICHE, sale = () => { f.modifie = true; };
    const champ = (id, cle, apres) => { const i = $('#' + id); i.oninput = () => { f[cle] = i.value; sale(); apres && apres(); }; };
    let tDispo;
    champ('fp-nom', 'nom', () => { majCote(); clearTimeout(tDispo); if (!f.id || !f.sku) tDispo = setTimeout(proposerRef, 400); });
    champ('fp-prix', 'prix', majCote); champ('fp-barre', 'prix_barre'); champ('fp-desc', 'description');
    champ('fp-sku', 'sku'); champ('fp-slug', 'slug', () => { $('#fp-slug-aide').textContent = '/p/' + (f.slug || '…'); });
    $('#fp-rayon').onchange = e => { f.rayon = +e.target.value; sale(); };
    $$('#fp-mat button').forEach(b => b.onclick = () => { const id = +b.dataset.v, i = f.matieres.indexOf(id); i < 0 ? f.matieres.push(id) : f.matieres.splice(i, 1); b.setAttribute('aria-pressed', i < 0); sale(); });
    /* photos */
    $$('[data-ph]').forEach(b => b.onclick = () => { const k = +b.dataset.k, a = f.photos; if (b.dataset.ph === 'retirer') a.splice(k, 1); else { const j = b.dataset.ph === 'gauche' ? k - 1 : k + 1; [a[k], a[j]] = [a[j], a[k]]; } sale(); redessiner(); });
    const depot = $('#fp-depot'), inp = $('#fp-fichiers');
    inp.onchange = () => televerser([...inp.files]);
    depot.ondragover = e => { e.preventDefault(); depot.style.borderColor = 'var(--rose)'; };
    depot.ondragleave = () => depot.style.borderColor = '';
    depot.ondrop = e => { e.preventDefault(); depot.style.borderColor = ''; televerser([...e.dataTransfer.files].filter(x => x.type.startsWith('image/'))); };
    $('#fp-biblio').onclick = choisirPhotos;
    /* variantes */
    $('#fp-plus').onclick = () => { if (!GS.tailles.length) return notifier('Aucune taille dans la base : ajoutez-en dans Tailles, coloris, photos.'); const prises = new Set(f.variantes.map(v => v.taille + ':' + (v.coloris || ''))); const t = GS.tailles.find(x => !prises.has(x.id + ':')) || GS.tailles[0]; f.nouvelles.push({taille:t.id, coloris:'', stock:0}); sale(); redessiner(); };
    $$('tr[data-nv]').forEach(tr => $$('[data-c]', tr).forEach(i => i.oninput = i.onchange = () => { f.nouvelles[+tr.dataset.nv][i.dataset.c] = i.value; sale(); }));
    $$('[data-retn]').forEach(b => b.onclick = () => { f.nouvelles.splice(+b.dataset.retn, 1); redessiner(); });
    $$('[data-retv]').forEach(b => b.onclick = () => { const id = +b.dataset.retv; f.retirees.push(id); f.variantes = f.variantes.filter(v => v.id !== id); sale(); redessiner(); });
    $$('[data-aj]').forEach(z => $('button', z).onclick = async () => {
      const q = parseInt($('input', z).value, 10); if (!q) return notifier('Indiquez une quantité, par exemple 5 ou −2.');
      try { const v = await api(`/api/gestion/variantes/${z.dataset.aj}/ajuster/`, 'POST', {quantite:q, motif:$('select', z).value, reference:'Back-office'}); const x = f.variantes.find(y => y.id === v.id); x.stock = v.stock; notifier(`Stock ${v.taille_valeur} : ${v.stock}`); chargerGestion().then(rafraichirVitrine); redessiner(); historique(v.id); }
      catch (e) { notifier(e.message); }
    });
    $$('[data-hist]').forEach(b => b.onclick = () => historique(+b.dataset.hist));
    /* enregistrer */
    $('#fp-publier').onclick = () => enregistrerFiche(true);
    $('#fp-brouillon').onclick = () => enregistrerFiche(false);
    $$('[data-fa]').forEach(b => b.onclick = async () => { const act = b.dataset.fa, id = f.id; const r = await actionProduit(act, id); if (!r) return; if (act === 'dupliquer') { FICHE = null; location.hash = `admin-produit-${r.id}`; } else if (act === 'supprimer') { FICHE = null; location.hash = 'admin-produits'; } else { FICHE = null; rendreAdmin(); } });
    majCote();
    function majCote() {
      const ph = f.photos[0];
      $('#fp-apercu').innerHTML = `<article class="carte" style="max-width:240px"><div style="aspect-ratio:3/4;border-radius:16px;background:#F6E9F0 center/cover;${fondImg(ph && ph.url)}"></div><div style="padding:10px 2px"><b style="display:block">${esc(f.nom || 'Nom du produit')}</b><span>${+f.prix ? F(+f.prix) : '— F'}</span>${+f.prix_barre > +f.prix ? ` <s style="color:var(--taupe);font-size:13px">${F(+f.prix_barre)}</s>` : ''}</div></article><span class="mono">Aperçu en boutique</span>`;
    }
    async function proposerRef() {
      if (!f.nom.trim()) return;
      try { const d = await api(`/api/gestion/produits/disponibilite/?nom=${encodeURIComponent(f.nom)}${f.id ? '&exclure=' + f.id : ''}`);
        if (!f.id || !f.sku) { f.sku = d.reference; $('#fp-sku').value = d.reference; }
        if (!f.id) { f.slug = d.slug_pris ? d.slug + '-' + Math.random().toString(36).slice(2, 5) : d.slug; $('#fp-slug').value = f.slug; $('#fp-slug-aide').textContent = '/p/' + f.slug + (d.slug_pris ? ' (adresse déjà prise, suffixe ajouté)' : ''); }
      } catch (_) {}
    }
  },
};
function redessiner() { const y = scrollY; $('#adm-vue').innerHTML = ECRANS.fiche.html(); ECRANS.fiche.lier(); scrollTo(0, y); }
async function historique(id) {
  const z = $('#mv-' + id); if (!z) return;
  try { const d = await api(`/api/gestion/mouvements/?variante=${id}&page_size=6`); const l = d.results || d;
    z.innerHTML = l.length ? l.slice(0, 6).map(m => `<span>${new Date(m.date).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})} · ${m.quantite > 0 ? '+' : ''}${m.quantite} · ${esc(({vente:'Vente', reappro:'Réappro.', retour:'Retour', ajustement:'Ajustement', annulation:'Annulation'})[m.motif] || m.motif)}${m.reference ? ' · ' + esc(m.reference) : ''} → ${m.reste}</span>`).join('') : '<span>Aucun mouvement enregistré.</span>';
  } catch (e) { z.textContent = e.message; }
}
async function televerser(fichiers) {
  if (!fichiers.length) return;
  notifier(`Envoi de ${fichiers.length} photo${fichiers.length > 1 ? 's' : ''}…`);
  for (const fi of fichiers) {
    const d = new FormData(); d.append('fichier', fi); d.append('nom', fi.name.replace(/\.[^.]+$/, ''));
    try { const m = await envoyerFichier('/api/gestion/photheque/', d); FICHE.photos.push({media:m.id, url:m.url}); FICHE.modifie = true; }
    catch (e) { notifier(`${fi.name} : ${e.message}`); }
  }
  GS.photosTotal += fichiers.length; redessiner();
}
async function choisirPhotos() {
  $('#tiroir').innerHTML = `<div class="t-tete"><div><span class="mono" style="color:var(--taupe)">Photothèque</span><h2 style="margin-top:6px">Choisir des photos</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div><div class="t-corps"><p class="note-demo">Chargement…</p></div>`;
  ouvrirTiroir(); $('#fermer-tiroir').onclick = fermerTiroir;
  const tous = await toutesLesPages('/api/gestion/photheque/?page_size=200').catch(() => []);
  const deja = new Set(FICHE.photos.map(p => p.media)), choix = new Set();
  $('.t-corps', $('#tiroir')).innerHTML = tous.length ? `<div class="phototheque">${tous.map(m => `<figure data-m="${m.id}" style="cursor:pointer;${deja.has(m.id) ? 'opacity:.35;pointer-events:none' : ''}"><span style="background:#F6E9F0 center/cover;${fondImg(m.url)};box-shadow:inset 0 0 0 0 var(--rose);transition:box-shadow .2s"></span><figcaption>${esc(m.nom || '')}</figcaption></figure>`).join('')}</div>` : '<p class="note-demo">La photothèque est vide : déposez des photos sur la fiche.</p>';
  $('#tiroir').insertAdjacentHTML('beforeend', '<div class="t-pied"><button class="btn" type="button" id="ph-ok" style="flex:1">Ajouter la sélection</button></div>');
  $$('[data-m]').forEach(fg => fg.onclick = () => { const id = +fg.dataset.m; choix.has(id) ? choix.delete(id) : choix.add(id); $('span', fg).style.boxShadow = choix.has(id) ? 'inset 0 0 0 4px var(--rose)' : ''; });
  $('#ph-ok').onclick = () => { tous.filter(m => choix.has(m.id)).forEach(m => FICHE.photos.push({media:m.id, url:m.url})); FICHE.modifie = true; fermerTiroir(); redessiner(); };
}
async function enregistrerFiche(publier) {
  const f = FICHE, err = $('#fp-err'); err.innerHTML = '';
  const corps = {nom:f.nom.trim(), slug:f.slug.trim(), sku:f.sku.trim(), prix:+f.prix || 0, prix_barre:f.prix_barre === '' ? null : +f.prix_barre, description:f.description, rayon:+f.rayon, matieres:f.matieres};
  if (!corps.nom) return err.innerHTML = '<p class="erreur-bloc">Donnez un nom au produit.</p>';
  if (!corps.sku || !corps.slug) return err.innerHTML = '<p class="erreur-bloc">La référence et l’adresse sont obligatoires (elles se remplissent à partir du nom).</p>';
  const boutons = $$('#fp-publier,#fp-brouillon'); boutons.forEach(b => b.disabled = true);
  try {
    let id = f.id;
    if (!id) id = (await api('/api/gestion/produits/', 'POST', {...corps, statut:'brouillon'})).id;
    else await api(`/api/gestion/produits/${id}/`, 'PATCH', corps);
    /* photos : on aligne la fiche sur ce qui est affiché */
    const exist = (await toutesLesPages(`/api/gestion/photos/?produit=${id}&page_size=200`)).filter(p => p.produit === id);
    const voulues = f.photos.map(p => p.media);
    for (const p of exist) if (!voulues.includes(p.media)) await api(`/api/gestion/photos/${p.id}/`, 'DELETE');
    for (const [pos, media] of voulues.entries()) { const d = exist.find(p => p.media === media); if (d) { if (d.position !== pos) await api(`/api/gestion/photos/${d.id}/`, 'PATCH', {position:pos}); } else await api('/api/gestion/photos/', 'POST', {produit:id, media, position:pos}); }
    /* variantes */
    for (const vid of f.retirees) await api(`/api/gestion/variantes/${vid}/`, 'DELETE');
    const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toUpperCase();
    for (const v of f.nouvelles) {
      const t = GS.tailles.find(x => x.id === +v.taille), c = GS.coloris.find(x => x.id === +v.coloris);
      if (f.variantes.some(x => x.taille === +v.taille && (x.coloris || '') === (c ? c.id : ''))) continue;
      await api('/api/gestion/variantes/', 'POST', {produit:id, taille:+v.taille, coloris:c ? c.id : null, sku:`${corps.sku}-${norm(t.valeur)}${c ? '-' + norm(c.nom) : ''}`, stock:+v.stock || 0});
    }
    /* statut */
    if (publier) await api(`/api/gestion/produits/${id}/publier/`, 'POST');
    else if (f.statut === 'publie') await api(`/api/gestion/produits/${id}/`, 'PATCH', {statut:'brouillon'});
    await chargerGestion(); FICHE = null; rafraichirVitrine();
    notifier(publier ? `${corps.nom} est en ligne` : f.statut === 'publie' ? `${corps.nom} retiré de la boutique` : `${corps.nom} enregistré en brouillon`);
    if (location.hash !== `#admin-produit-${id}`) location.hash = `admin-produit-${id}`; else rendreAdmin();
  } catch (e) {
    boutons.forEach(b => b.disabled = false);
    err.innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; notifier(e.message);
    if (e.champs && !f.id) { /* la fiche a pu naître avant l'erreur : on se recale dessus */ }
  }
}

/* ------------------------------------------------------------ COMMANDES */
ECRANS.commandes = {
  html() {
    const h = VUES.commandes();
    return h.replace(/<div class="actions-t">[\s\S]*?<\/div><\/div>/, `<div class="actions-t"><span class="mono" style="color:var(--taupe);align-self:center">${GS.commandes.length} au total</span><a class="btn" href="#admin-commande-nouvelle">+ Saisir une vente</a></div></div>`);
  },
  lier() { kanban(); },
};
ouvrirCommande = function (ref) {
  const c = ADM.commandes.find(x => x.ref === ref); if (!c) return;
  const ordre = ['attente', 'preparer', 'expediee', 'livree'], i = ordre.indexOf(c.statut), suivant = c.statut === 'annulee' ? null : ordre[i + 1], b = c.brut;
  const n = c.statut === 'annulee' ? -1 : i;
  $('#tiroir').innerHTML = `
    <div class="t-tete"><div><span class="ref" style="font-family:var(--f-mono);font-size:12px;color:var(--taupe)">${esc(c.ref)} · ${new Date(c.creee).toLocaleString('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</span><h2 style="margin-top:6px">${F(c.total)}</h2><div style="margin-top:8px">${etatCmd(c.statut)}${b.encaissee ? ' <span class="puce-etat e-livree">Encaissée</span>' : ''}</div></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
    <div class="t-corps">
      <div class="chrono">${['En attente', 'En préparation', 'Expédiée', 'Livrée'].map((s, k) => `<div class="${k < n ? 'fait' : k === n ? 'cours' : ''}"><span>${s}<small>${k < n ? 'Fait' : k === n ? 'Étape en cours' : 'À venir'}</small></span></div>`).join('')}${c.statut === 'annulee' ? '<div class="cours"><span>Annulée<small>Le stock a été remis en rayon</small></span></div>' : ''}</div>
      <dl class="kv"><dt>Cliente</dt><dd>${esc(c.cliente)}${b.cliente ? ' <small style="color:var(--taupe)">· compte</small>' : ''}</dd><dt>Téléphone</dt><dd>${esc(c.telephone || '—')}</dd>${b.email ? `<dt>E-mail</dt><dd>${esc(b.email)}</dd>` : ''}<dt>Livraison</dt><dd>${esc(ZONES[c.zone] || c.zone || '')}${c.ville ? ' · ' + esc(c.ville) : ''}${c.adresse ? '<br><small>' + esc(c.adresse) + '</small>' : ''}</dd><dt>Paiement</dt><dd>${esc(c.pay)}</dd>
      <dt>Sous-total</dt><dd>${F(b.sous_total)}</dd><dt>Livraison</dt><dd>${b.frais_livraison ? F(b.frais_livraison) : 'Offerte'}</dd>${b.remise ? `<dt>Remise</dt><dd>− ${F(b.remise)}</dd>` : ''}</dl>
      ${b.notes ? `<p class="note-demo">« ${esc(b.notes)} »</p>` : ''}
      <div><span class="etiquette-champ">Articles</span><div class="lignes-cmd">${c.lignesApi.map(l => `<div><span class="v" style="${vignApi(l)}"></span><span>${esc(l.nom_produit)}<br><small style="color:var(--taupe)">${esc(l.libelle_option)} · × ${l.quantite}</small></span><b>${F(l.sous_total ?? l.prix_unitaire * l.quantite)}</b></div>`).join('')}</div></div>
      <div id="cmd-err"></div>
    </div>
    <div class="t-pied">${suivant ? `<button class="btn" type="button" id="avancer" style="flex:1">Passer en ${ADM.LIB[suivant].toLowerCase()} <span class="fl">→</span></button>` : ''}${c.statut === 'annulee' ? '<button class="btn" type="button" id="retablir" style="flex:1">Rétablir la commande</button>' : ''}${c.telephone ? `<a class="btn clair" href="https://wa.me/${c.telephone.replace(/\D/g, '').replace(/^(?!221)/, '221')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}${c.statut !== 'annulee' && c.statut !== 'livree' ? '<button class="btn clair" type="button" id="annuler-cmd">Annuler</button>' : ''}</div>`;
  ouvrirTiroir();
  $('#fermer-tiroir').onclick = fermerTiroir;
  const apres = async ok => { if (ok) { fermerTiroir(); await rendreAdmin(); rafraichirVitrine(); } };
  $('#avancer')?.addEventListener('click', async () => apres(await changerStatut(c, suivant)));
  $('#annuler-cmd')?.addEventListener('click', async () => { if (await confirmer(`Annuler ${esc(c.ref)} ?`, 'Les articles reviennent en stock. Vous pourrez la rétablir si le stock le permet encore.', 'Annuler la commande')) apres(await changerStatut(c, 'annulee')); else ouvrirCommande(ref); });
  $('#retablir')?.addEventListener('click', async () => { try { await api(`/api/gestion/commandes/${c.ref}/retablir/`, 'POST'); await chargerGestion(); notifier(`${c.ref} rétablie, en attente`); apres(true); } catch (e) { $('#cmd-err').innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; } });
};

/* Saisie d'une vente faite hors du site (WhatsApp, téléphone, boutique) */
const saisieVide = () => ({lignes:[], nom_client:'', telephone:'', email:'', zone:'dakar', ville:'', adresse:'', notes:'', moyen_paiement:'wave', remise:0, devis:null, produit:'', variantes:[], variante:'', quantite:1});
ECRANS['commande-nouvelle'] = {
  avant() { if (!G2.saisie) G2.saisie = saisieVide(); },
  html() {
    const s = G2.saisie, vendables = GS.produits.filter(p => p.statut !== 'archive' && p.stock_total > 0);
    const champ = (id, lab, t = 'text', aide = '') => `<div class="champ"><input id="sv-${id}" data-k="${id}" type="${t}" placeholder=" " value="${attr(s[id])}"><label for="sv-${id}">${lab}</label>${aide ? `<span class="aide">${aide}</span>` : ''}</div>`;
    const d = s.devis;
    return `<div class="adm-titre"><div><span class="mono"><a href="#admin-commandes">Commandes</a> / Saisie</span><h1>Saisir une <span class="serif">vente</span></h1></div><div class="actions-t"><a class="btn clair" href="#admin-commandes">Annuler</a></div></div>
    <p class="note-demo">Pour une commande prise sur WhatsApp, au téléphone ou en boutique. Le serveur refait les prix, applique les promotions, retire le stock et rattache la commande au compte de la cliente si son numéro en désigne un.</p>
    <div class="editeur">
      <div style="display:flex;flex-direction:column;gap:clamp(16px,2vw,24px)">
        <section class="panneau formulaire"><h2 style="font-size:20px;margin:0">Articles</h2>
          <div class="choix-ligne">
            <div><span class="etiquette-champ">Produit</span><select class="select-adm" id="sv-produit"><option value="">Choisir…</option>${vendables.map(p => `<option value="${p.id}" ${+s.produit === p.id ? 'selected' : ''}>${esc(p.nom)} · ${F(p.prix)}${p.statut !== 'publie' ? ' (brouillon)' : ''}</option>`).join('')}</select></div>
            <div><span class="etiquette-champ">Taille</span><select class="select-adm" id="sv-variante" ${s.variantes.length ? '' : 'disabled'}>${s.variantes.map(v => `<option value="${v.id}" ${+s.variante === v.id ? 'selected' : ''} ${v.stock <= 0 ? 'disabled' : ''}>${esc(v.taille_valeur)}${v.coloris_nom ? ' · ' + esc(v.coloris_nom) : ''} — ${v.stock} en stock</option>`).join('')}</select></div>
            <div><span class="etiquette-champ">Qté</span><input class="select-adm" style="background-image:none;padding-right:12px" id="sv-qte" type="number" min="1" max="20" value="${s.quantite}"></div>
            <button class="btn" type="button" id="sv-ajouter" style="height:54px">Ajouter</button>
          </div>
          <div class="saisie-l">${s.lignes.map((l, k) => `<div><span class="v" style="${fondImg(l.image)}"></span><span><b>${esc(l.nom)}</b><br><small style="color:var(--taupe)">${esc(l.option)} · × ${l.quantite}</small></span><b>${F(l.prix * l.quantite)}</b><button class="suppr-x" type="button" data-retl="${k}">×</button></div>`).join('') || '<p style="color:var(--taupe);font-size:14px">Aucun article pour l’instant.</p>'}</div>
        </section>
        <section class="panneau formulaire"><h2 style="font-size:20px;margin:0">Cliente</h2>
          <div class="rangee">${champ('nom_client', 'Nom et prénom')}${champ('telephone', 'Téléphone', 'tel', d && d.cliente_nom ? '✓ Compte trouvé : ' + esc(d.cliente_nom) : 'Rattache la commande au compte s’il existe')}</div>${champ('email', 'E-mail (facultatif)', 'email')}
        </section>
        <section class="panneau formulaire"><h2 style="font-size:20px;margin:0">Livraison et paiement</h2>
          <div class="rangee"><div><span class="etiquette-champ">Zone</span><select class="select-adm" id="sv-zone">${Object.entries(ZONES).map(([k, v]) => `<option value="${k}" ${s.zone === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div><span class="etiquette-champ">Paiement</span><select class="select-adm" id="sv-paiement">${Object.entries(PAIE).map(([k, v]) => `<option value="${k}" ${s.moyen_paiement === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
          ${s.zone !== 'retrait' ? `<div class="rangee">${champ('ville', 'Quartier ou ville')}${champ('adresse', 'Point de repère pour le livreur')}</div>` : ''}
          <div class="rangee">${champ('remise', 'Remise accordée (F)', 'number')}${champ('notes', 'Note interne')}</div>
        </section>
      </div>
      <aside class="apercu"><section class="panneau" style="display:flex;flex-direction:column;gap:14px"><span class="mono">Récapitulatif · chiffré par le serveur</span>
        ${d ? `<div class="recap-s"><span>Sous-total</span><b>${F(d.sous_total)}</b><span>Livraison</span><b>${d.frais_livraison ? F(d.frais_livraison) : 'Offerte'}</b>${d.remise ? `<span>Remise${d.remise_libelle ? ' · ' + esc(d.remise_libelle) : ''}</span><b>− ${F(d.remise)}</b>` : ''}<span class="t">Total</span><b class="t">${F(d.total)}</b></div>` : '<p style="color:var(--taupe);font-size:14px">Ajoutez un article pour voir le total.</p>'}
        <div id="sv-err"></div>
        <button class="btn" type="button" id="sv-valider" ${s.lignes.length ? '' : 'disabled style="opacity:.45"'}>Enregistrer la commande</button></section></aside>
    </div>`;
  },
  lier() {
    const s = G2.saisie; let tD;
    const devis = () => { clearTimeout(tD); tD = setTimeout(async () => {
      if (!s.lignes.length) { s.devis = null; return; }
      try { s.devis = await api('/api/gestion/commandes/devis/', 'POST', {lignes:s.lignes.map(l => ({variante:l.variante, quantite:l.quantite})), zone:s.zone, remise:+s.remise || 0, telephone:s.telephone}); $('#sv-err').innerHTML = ''; }
      catch (e) { s.devis = null; $('#sv-err').innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; return; }
      const y = scrollY, foc = document.activeElement && document.activeElement.id, pos = document.activeElement && document.activeElement.selectionStart;
      $('#adm-vue').innerHTML = this.html(); this.lier(); scrollTo(0, y);
      if (foc && $('#' + foc)) { const n = $('#' + foc); n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} }
    }, 350); };
    this.devis = devis;
    $$('[data-k]').forEach(i => i.oninput = () => { s[i.dataset.k] = i.value; if (['telephone', 'remise'].includes(i.dataset.k)) devis(); });
    $('#sv-zone').onchange = e => { s.zone = e.target.value; if (s.zone === 'retrait') s.moyen_paiement = 'esp'; else if (s.moyen_paiement === 'esp') s.moyen_paiement = 'wave'; devis(); if (!s.lignes.length) rendreAdmin(); };
    $('#sv-paiement').onchange = e => { s.moyen_paiement = e.target.value; };
    $('#sv-produit').onchange = async e => { s.produit = e.target.value; s.variantes = []; s.variante = ''; if (s.produit) { const d = await api(`/api/gestion/variantes/?produit=${s.produit}&page_size=100`); s.variantes = d.results || d; s.variante = (s.variantes.find(v => v.stock > 0) || {}).id || ''; } const y = scrollY; await rendreAdmin(); scrollTo(0, y); };
    $('#sv-variante').onchange = e => { s.variante = e.target.value; };
    $('#sv-qte').oninput = e => { s.quantite = Math.max(1, +e.target.value || 1); };
    $('#sv-ajouter').onclick = () => {
      const v = s.variantes.find(x => x.id === +s.variante), p = GS.produits.find(x => x.id === +s.produit);
      if (!v || !p) return notifier('Choisissez un produit et une taille.');
      const deja = s.lignes.find(l => l.variante === v.id);
      if (deja) deja.quantite += s.quantite; else s.lignes.push({variante:v.id, quantite:s.quantite, nom:p.nom, option:[v.taille_valeur, v.coloris_nom].filter(Boolean).join(' · '), prix:p.prix, image:p.image});
      s.quantite = 1; devis();
    };
    $$('[data-retl]').forEach(b => b.onclick = () => { s.lignes.splice(+b.dataset.retl, 1); devis(); if (!s.lignes.length) rendreAdmin(); });
    $('#sv-valider').onclick = async () => {
      const b = $('#sv-valider'); b.disabled = true;
      try {
        const c = await api('/api/gestion/commandes/', 'POST', {lignes:s.lignes.map(l => ({variante:l.variante, quantite:l.quantite})), nom_client:s.nom_client, telephone:s.telephone, email:s.email, zone:s.zone, ville:s.ville, adresse:s.adresse, notes:s.notes, moyen_paiement:s.moyen_paiement, remise:+s.remise || 0});
        G2.saisie = null; derniereCloche = c.reference; await chargerGestion(); rafraichirVitrine(); notifier(`${c.reference} enregistrée · ${F(c.total)}`);
        location.hash = 'admin-commandes'; setTimeout(() => ouvrirCommande(c.reference), 800);
      } catch (e) { b.disabled = false; $('#sv-err').innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; }
    };
  },
};

/* ------------------------------------------------------------ CLIENTES */
ECRANS.clientes = {
  html() {
    const q = G2.rechCli.toLowerCase(), l = GS.clientes.filter(c => !q || [c.nom, c.email, c.telephone, c.ville].join(' ').toLowerCase().includes(q));
    const depense = id => GS.commandes.filter(c => c.cliente === id && c.statut !== 'annulee');
    return `<div class="adm-titre"><div><span class="mono">Ventes</span><h1>Clien<span class="serif">tes</span></h1></div><span class="mono" style="color:var(--taupe)">${GS.clientes.length} comptes</span></div>
    <div class="barre-outils"><span></span><label class="champ-recherche"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="rech-cli" placeholder="Nom, e-mail, téléphone…" value="${attr(G2.rechCli)}"></label></div>
    <section class="panneau">${l.length ? `<div class="tableau-zone"><table class="tab"><thead><tr><th>Cliente</th><th>Contact</th><th>Ville</th><th class="num">Commandes</th><th class="num">Dépensé</th><th>Inscrite le</th></tr></thead><tbody>
      ${l.map(c => { const d = depense(c.id); return `<tr data-cli="${c.id}" style="cursor:pointer"><td><div class="cell-prod"><span class="avatar petit">${esc((c.nom || c.email).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase())}</span><b>${esc(c.nom || '—')}</b></div></td><td>${esc(c.email)}<br><small style="color:var(--taupe)">${esc(c.telephone || '')}</small></td><td>${esc(c.ville || '—')}</td><td class="num">${d.length}</td><td class="num">${F(d.reduce((s, x) => s + x.total, 0))}</td><td>${new Date(c.date_creation).toLocaleDateString('fr-FR')}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="note-demo">Aucune cliente ne correspond.</p>'}</section>`;
  },
  lier() {
    const ri = $('#rech-cli'); ri.oninput = () => { G2.rechCli = ri.value; const p = ri.selectionStart; rendreAdmin().then(() => { const n = $('#rech-cli'); n.focus(); n.setSelectionRange(p, p); }); };
    $$('[data-cli]').forEach(tr => tr.onclick = () => {
      const c = GS.clientes.find(x => x.id === +tr.dataset.cli), cmds = ADM.commandes.filter(x => x.brut.cliente === c.id);
      $('#tiroir').innerHTML = `<div class="t-tete"><div><span class="mono" style="color:var(--taupe)">Cliente depuis le ${new Date(c.date_creation).toLocaleDateString('fr-FR')}</span><h2 style="margin-top:6px">${esc(c.nom || c.email)}</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
        <div class="t-corps"><dl class="kv"><dt>E-mail</dt><dd>${esc(c.email)}</dd><dt>Téléphone</dt><dd>${esc(c.telephone || '—')}</dd><dt>Ville</dt><dd>${esc(c.ville || '—')}</dd>${(c.adresses || []).map(a => `<dt>Adresse</dt><dd>${esc([a.libelle, a.ville, a.adresse || a.ligne].filter(Boolean).join(' · '))}</dd>`).join('')}</dl>
        <div><span class="etiquette-champ">Commandes (${cmds.length})</span>${cmds.length ? tableCommandes(cmds) : '<p style="color:var(--taupe);font-size:14px">Aucune commande avec ce compte.</p>'}</div></div>`;
      ouvrirTiroir(); $('#fermer-tiroir').onclick = fermerTiroir;
    });
  },
};

/* ------------------------------------------------------------ CATÉGORIES */
ECRANS.categories = {
  html() {
    const rac = GS.rayons.filter(r => !(r.parents || []).length).sort((a, b) => (a.ordre - b.ordre) || a.nom.localeCompare(b.nom)), fonds = ['var(--rose)', 'var(--encre)', 'linear-gradient(135deg,#C22F6E,#F1CC53)', '#7A7275'];
    const enfants = r => GS.rayons.filter(e => (e.parents || []).includes(r.id));
    return `<div class="adm-titre"><div><span class="mono">Catalogue</span><h1>Caté<span class="serif">gories</span></h1></div><div class="actions-t"><button class="btn clair" type="button" data-cat-new="sous">+ Sous-catégorie</button><button class="btn" type="button" data-cat-new="racine">+ Catégorie</button></div></div>
    <p class="note-demo">Deux niveaux : une catégorie (Enfants, Coin Maman…) et ses sous-catégories. Une catégorie masquée disparaît de la boutique sans rien perdre.</p>
    ${rac.length ? `<div class="g3">${rac.map((c, k) => `<section class="panneau cat-carte"><div class="bandeau-cat" style="background:${c.image_url ? `url(${urlCss(absolu(c.image_url))}) center/cover` : fonds[k % 4]}"><span class="n">${c.nombre_produits ?? 0} en ligne · ${c.fiches ?? 0} fiche${(c.fiches ?? 0) > 1 ? 's' : ''}</span><b>${esc(c.nom)}</b></div>
      <div style="font-size:13px;color:var(--taupe)">${esc(c.description || '')} <span class="puce-etat ${c.univers === 'maman' ? 'e-preparer' : 'e-expediee'}" style="margin-left:4px">${c.univers === 'maman' ? 'Maman' : 'Enfant'}</span></div>
      <div class="sous-cats">${enfants(c).map(e => `<span data-cat="${e.id}" style="cursor:pointer" title="Modifier">${esc(e.nom)} <small>${e.fiches ?? 0}</small>${e.visible ? '' : ' · masquée'}</span>`).join('') || '<span>Aucune sous-catégorie</span>'}</div>
      <div style="display:flex;gap:10px;margin-top:auto;align-items:center;flex-wrap:wrap"><div class="acts" style="justify-content:flex-start"><button type="button" data-cat="${c.id}">Modifier</button><button type="button" data-cat-vis="${c.id}">${c.visible ? 'Masquer' : 'Afficher'}</button><button type="button" data-cat-sup="${c.id}" class="danger">Supprimer</button></div><span style="font-size:12px;color:var(--taupe);margin-left:auto">${c.visible ? 'Visible' : 'Masquée'}</span></div></section>`).join('')}</div>`
      : '<section class="panneau vide"><span class="grand-vide">Aucune catégorie.</span><p>Créez la première pour pouvoir ranger des produits.</p></section>'}`;
  },
  lier() {
    $$('[data-cat]').forEach(b => b.onclick = () => formRayon(GS.rayons.find(r => r.id === +b.dataset.cat)));
    $$('[data-cat-new]').forEach(b => b.onclick = () => formRayon(null, b.dataset.catNew === 'sous'));
    $$('[data-cat-vis]').forEach(b => b.onclick = async () => { const r = GS.rayons.find(x => x.id === +b.dataset.catVis); if (await ecrire(() => api(`/api/gestion/rayons/${r.id}/`, 'PATCH', {visible:!r.visible}), `${r.nom} ${r.visible ? 'masquée' : 'affichée'}`)) { rendreAdmin(); rafraichirVitrine(); } });
    $$('[data-cat-sup]').forEach(b => b.onclick = () => supprimerRayon(GS.rayons.find(x => x.id === +b.dataset.catSup)));
  },
};
function formRayon(r, sous) {
  const rac = GS.rayons.filter(x => !(x.parents || []).length && (!r || x.id !== r.id)), estSous = r ? (r.parents || []).length > 0 : sous;
  const v = r || {nom:'', description:'', univers:'enfant', visible:true, ordre:99, parents:sous && rac[0] ? [rac[0].id] : [], image:null};
  $('#tiroir').innerHTML = `<div class="t-tete"><div><span class="mono" style="color:var(--taupe)">${estSous ? 'Sous-catégorie' : 'Catégorie'}</span><h2 style="margin-top:6px">${r ? esc(r.nom) : 'Nouvelle'}</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
    <div class="t-corps"><form class="formulaire" id="f-rayon">
      <div class="champ"><input id="ry-nom" placeholder=" " value="${attr(v.nom)}" required><label for="ry-nom">Nom</label></div>
      <div class="champ"><textarea id="ry-desc" placeholder=" ">${esc(v.description || '')}</textarea><label for="ry-desc">Description</label></div>
      ${estSous ? `<div><span class="etiquette-champ">Rangée dans</span><div class="puces-choix" id="ry-par">${rac.map(x => `<button type="button" data-v="${x.id}" aria-pressed="${(v.parents || []).includes(x.id)}">${esc(x.nom)}</button>`).join('')}</div><span class="aide" style="font-size:13px;color:var(--taupe)">Elle peut appartenir à plusieurs catégories.</span></div>`
        : `<div><span class="etiquette-champ">Univers</span><div class="puces-choix" id="ry-uni">${[['enfant', 'Enfant'], ['maman', 'Maman']].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${v.univers === k}">${l}</button>`).join('')}</div></div>`}
      <div class="rangee"><div class="champ"><input id="ry-ordre" type="number" placeholder=" " value="${attr(v.ordre)}"><label for="ry-ordre">Ordre d'affichage</label></div><div class="ligne-reglage" style="border:0;padding:0"><span><b>Visible en boutique</b></span><input class="interrupteur" type="checkbox" id="ry-vis" ${v.visible ? 'checked' : ''}></div></div>
      <div id="ry-err"></div></form></div>
    <div class="t-pied"><button class="btn" type="button" id="ry-ok" style="flex:1">${r ? 'Enregistrer' : 'Créer'}</button><button class="btn clair" type="button" id="ry-non">Annuler</button>${r ? '<button class="btn clair" type="button" id="ry-sup" style="color:var(--rose-sombre)">Supprimer</button>' : ''}</div>`;
  ouvrirTiroir(); $('#fermer-tiroir').onclick = $('#ry-non').onclick = fermerTiroir;
  if (r) $('#ry-sup').onclick = () => supprimerRayon(r);
  let univers = v.univers, parents = [...(v.parents || [])];
  $$('#ry-uni button').forEach(b => b.onclick = () => { univers = b.dataset.v; $$('#ry-uni button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  $$('#ry-par button').forEach(b => b.onclick = () => { const id = +b.dataset.v, i = parents.indexOf(id); i < 0 ? parents.push(id) : parents.splice(i, 1); b.setAttribute('aria-pressed', i < 0); });
  $('#ry-ok').onclick = async () => {
    const corps = {nom:$('#ry-nom').value.trim(), description:$('#ry-desc').value, ordre:+$('#ry-ordre').value || 0, visible:$('#ry-vis').checked, parents:estSous ? parents : []};
    if (!estSous) corps.univers = univers;
    if (!corps.nom) return $('#ry-err').innerHTML = '<p class="erreur-bloc">Le nom est obligatoire.</p>';
    if (estSous && !parents.length) return $('#ry-err').innerHTML = '<p class="erreur-bloc">Choisissez au moins une catégorie.</p>';
    try { await (r ? api(`/api/gestion/rayons/${r.id}/`, 'PATCH', corps) : api('/api/gestion/rayons/', 'POST', corps)); await chargerGestion(); fermerTiroir(); notifier(`${corps.nom} ${r ? 'enregistrée' : 'créée'}`); rendreAdmin(); rafraichirVitrine(); }
    catch (e) { $('#ry-err').innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; }
  };
}
async function supprimerRayon(r) {
  const brouillons = r.fiches_brouillons || 0, autres = GS.rayons.filter(x => x.id !== r.id);
  $('#tiroir').innerHTML = `<div class="t-tete"><div><h2>Supprimer ${esc(r.nom)} ?</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
    <div class="t-corps"><p>Une catégorie qui contient des sous-catégories ou un produit publié ne peut pas être supprimée : le serveur le refusera.</p>
    ${brouillons ? `<div><span class="etiquette-champ">Ses ${brouillons} brouillon${brouillons > 1 ? 's' : ''}</span><div class="puces-choix" id="sr-mode"><button type="button" data-v="deplacer" aria-pressed="true">Les déplacer</button><button type="button" data-v="supprimer" aria-pressed="false">Les supprimer</button></div>
      <div style="margin-top:12px" id="sr-dest-z"><select class="select-adm" id="sr-dest">${autres.map(x => `<option value="${x.id}">${esc(x.nom)}</option>`).join('')}</select></div></div>` : ''}
    <div id="sr-err"></div></div><div class="t-pied"><button class="btn rouge" type="button" id="sr-ok" style="flex:1">Supprimer</button><button class="btn clair" type="button" id="sr-non">Annuler</button></div>`;
  ouvrirTiroir(); $('#fermer-tiroir').onclick = $('#sr-non').onclick = fermerTiroir;
  let mode = 'deplacer';
  $$('#sr-mode button').forEach(b => b.onclick = () => { mode = b.dataset.v; $$('#sr-mode button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#sr-dest-z').hidden = mode !== 'deplacer'; });
  $('#sr-ok').onclick = async () => {
    const q = brouillons ? `?brouillons=${mode}${mode === 'deplacer' ? '&destination=' + $('#sr-dest').value : ''}` : '';
    try { await api(`/api/gestion/rayons/${r.id}/${q}`, 'DELETE'); await chargerGestion(); fermerTiroir(); notifier(`${r.nom} supprimée`); rendreAdmin(); rafraichirVitrine(); }
    catch (e) { $('#sr-err').innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; }
  };
}

/* ------------------------------------------------------------ PROMOTIONS */
const PORTEES = {boutique:'Toute la boutique', rayon:'Un rayon', produit:'Un produit', commande:'Sur la commande'};
ECRANS.promotions = {
  html() {
    const l = [...GS.campagnes].sort((a, b) => b.date_effet.localeCompare(a.date_effet));
    return `<div class="adm-titre"><div><span class="mono">Marketing</span><h1>Promo<span class="serif">tions</span></h1></div><div class="actions-t"><button class="btn" type="button" id="nouvelle-promo">+ Nouvelle promotion</button></div></div>
    <p class="note-demo">Une campagne s'applique d'elle-même pendant sa période : les prix barrés apparaissent en boutique et la remise est recalculée par le serveur au moment de la commande.</p>
    ${l.length ? l.map(c => { const d = new Date(c.date_effet), f = new Date(c.date_fin), now = new Date(), pct = Math.max(0, Math.min(100, (now - d) / Math.max(1, f - d) * 100));
      const e = !c.active ? ['Suspendue', 'e-annulee'] : c.en_cours ? ['En cours', 'e-livree'] : now < d ? ['Programmée', 'e-attente'] : ['Terminée', 'e-annulee'];
      return `<section class="panneau promo"><span class="remise ${c.type === 'montant' ? 'montant' : ''}">${c.type === 'montant' ? '−' + F(c.valeur) : '−' + c.valeur + ' %'}</span><div><h3>${esc(c.libelle)}</h3><div class="periode"><span>${esc(c.portee === 'rayon' ? 'Rayon ' + ((GS.rayons.find(r => r.id === c.rayon) || {}).nom || '') : c.portee === 'produit' ? c.produit_nom || 'Un produit' : c.portee === 'commande' ? (c.condition === 'premiere' ? 'Première commande' : 'Dès ' + F(c.montant_minimum)) : 'Toute la boutique')} · ${d.toLocaleDateString('fr-FR')} → ${f.toLocaleDateString('fr-FR')}</span><span class="frise"><i style="--w:${pct}%"></i></span></div></div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end"><span class="puce-etat ${e[1]}">${e[0]}</span><div class="acts"><button type="button" data-pr="${c.id}">Modifier</button><button type="button" data-pr-on="${c.id}">${c.active ? 'Suspendre' : 'Activer'}</button><button type="button" data-pr-sup="${c.id}" class="danger">Supprimer</button></div></div></section>`; }).join('')
      : '<section class="panneau vide" style="border:1px dashed var(--filet);background:none;box-shadow:none"><span class="grand-vide">Aucune campagne.</span><p>Programmez la prochaine : elle s’applique d’elle-même.</p></section>'}`;
  },
  lier() {
    $('#nouvelle-promo').onclick = () => formPromoServeur(null);
    $$('[data-pr]').forEach(b => b.onclick = () => formPromoServeur(GS.campagnes.find(c => c.id === +b.dataset.pr)));
    $$('[data-pr-on]').forEach(b => b.onclick = async () => { const c = GS.campagnes.find(x => x.id === +b.dataset.prOn); if (await ecrire(() => api(`/api/gestion/campagnes/${c.id}/`, 'PATCH', {active:!c.active}), `${c.libelle} ${c.active ? 'suspendue' : 'activée'}`)) { rendreAdmin(); rafraichirVitrine(); } });
    $$('[data-pr-sup]').forEach(b => b.onclick = async () => { const c = GS.campagnes.find(x => x.id === +b.dataset.prSup); if (await confirmer('Supprimer cette promotion ?', `« ${esc(c.libelle)} » ne s'appliquera plus. Les commandes passées gardent leur remise.`, 'Supprimer') && await ecrire(() => api(`/api/gestion/campagnes/${c.id}/`, 'DELETE'), 'Promotion supprimée')) { rendreAdmin(); rafraichirVitrine(); } });
  },
};
function formPromoServeur(c) {
  const v = c || {libelle:'', type:'pourcentage', valeur:10, date_effet:new Date().toISOString().slice(0, 10), duree_jours:14, portee:'boutique', rayon:null, produit:null, condition:'montant_minimum', montant_minimum:0, active:true, note:''};
  const ch = (id, lab, val, t = 'text') => `<div class="champ"><input id="pm-${id}" type="${t}" placeholder=" " value="${attr(val)}"><label for="pm-${id}">${lab}</label></div>`;
  $('#tiroir').innerHTML = `<div class="t-tete"><div><span class="mono" style="color:var(--taupe)">Promotion</span><h2 style="margin-top:6px">${c ? esc(c.libelle) : 'Nouvelle campagne'}</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
    <div class="t-corps"><div class="formulaire">${ch('libelle', 'Nom de la campagne (affiché au récapitulatif)', v.libelle)}
      <div class="rangee"><div><span class="etiquette-champ">Type</span><select class="select-adm" id="pm-type"><option value="pourcentage" ${v.type === 'pourcentage' ? 'selected' : ''}>Pourcentage</option><option value="montant" ${v.type === 'montant' ? 'selected' : ''}>Montant fixe (F)</option></select></div>${ch('valeur', 'Valeur', v.valeur, 'number')}</div>
      <div class="rangee">${ch('date', 'Début', v.date_effet, 'date')}${ch('duree', 'Durée (jours)', v.duree_jours, 'number')}</div>
      <div><span class="etiquette-champ">S'applique à</span><select class="select-adm" id="pm-portee">${Object.entries(PORTEES).map(([k, l]) => `<option value="${k}" ${v.portee === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div id="pm-cible"></div>
      <div class="ligne-reglage" style="border:0;padding:0"><span><b>Active</b><small>Décochez pour la suspendre sans la supprimer</small></span><input class="interrupteur" type="checkbox" id="pm-active" ${v.active ? 'checked' : ''}></div>
      <div class="champ"><textarea id="pm-note" placeholder=" ">${esc(v.note || '')}</textarea><label for="pm-note">Note interne</label></div><div id="pm-err"></div></div></div>
    <div class="t-pied"><button class="btn" type="button" id="pm-ok" style="flex:1">${c ? 'Enregistrer' : 'Programmer'}</button><button class="btn clair" type="button" id="pm-non">Annuler</button></div>`;
  ouvrirTiroir(); $('#fermer-tiroir').onclick = $('#pm-non').onclick = fermerTiroir;
  const cible = () => { const p = $('#pm-portee').value; $('#pm-cible').innerHTML =
    p === 'rayon' ? `<span class="etiquette-champ">Rayon</span><select class="select-adm" id="pm-rayon">${optionsRayons(v.rayon)}</select>`
    : p === 'produit' ? `<span class="etiquette-champ">Produit</span><select class="select-adm" id="pm-produit">${GS.produits.filter(x => x.statut !== 'archive').map(x => `<option value="${x.id}" ${v.produit === x.id ? 'selected' : ''}>${esc(x.nom)} · ${F(x.prix)}</option>`).join('')}</select>`
    : p === 'commande' ? `<div class="rangee"><div><span class="etiquette-champ">Condition</span><select class="select-adm" id="pm-cond"><option value="montant_minimum" ${v.condition === 'montant_minimum' ? 'selected' : ''}>À partir d'un montant</option><option value="premiere" ${v.condition === 'premiere' ? 'selected' : ''}>Première commande</option></select></div><div class="champ" style="align-self:end"><input id="pm-min" type="number" placeholder=" " value="${attr(v.montant_minimum)}"><label for="pm-min">Montant minimum (F)</label></div></div>` : ''; };
  $('#pm-portee').onchange = cible; cible();
  $('#pm-ok').onclick = async () => {
    const p = $('#pm-portee').value, corps = {libelle:$('#pm-libelle').value.trim(), type:$('#pm-type').value, valeur:+$('#pm-valeur').value, date_effet:$('#pm-date').value, duree_jours:+$('#pm-duree').value, portee:p, rayon:p === 'rayon' ? +$('#pm-rayon').value : null, produit:p === 'produit' ? +$('#pm-produit').value : null, condition:p === 'commande' ? $('#pm-cond').value : v.condition || 'montant_minimum', montant_minimum:p === 'commande' ? +$('#pm-min').value || 0 : 0, active:$('#pm-active').checked, note:$('#pm-note').value};
    try { await (c ? api(`/api/gestion/campagnes/${c.id}/`, 'PATCH', corps) : api('/api/gestion/campagnes/', 'POST', corps)); await chargerGestion(); fermerTiroir(); notifier(`${corps.libelle} ${c ? 'enregistrée' : 'programmée'}`); rendreAdmin(); rafraichirVitrine(); }
    catch (e) { $('#pm-err').innerHTML = `<p class="erreur-bloc">${esc(e.message)}</p>`; }
  };
}
formPromo = () => formPromoServeur(null);

/* ------------------------------------------------- TAILLES, COLORIS, PHOTOS */
ECRANS.configuration = {
  async avant() { GS.photosToutes = await toutesLesPages('/api/gestion/photheque/?page_size=200').catch(() => GS.photos); },
  html() {
    const ph = GS.photosToutes || GS.photos;
    return `<div class="adm-titre"><div><span class="mono">Catalogue</span><h1>Tailles, coloris <span class="serif">& photos</span></h1></div></div>
    <div class="g3">
      <section class="panneau"><div class="tete"><h2>Tailles</h2><span class="mono" style="color:var(--taupe)">${GS.tailles.length}</span></div><div class="liste-tailles">${GS.tailles.map(t => `<div><b>${esc(t.valeur)}</b><span>${esc(t.repere || '')}</span><small>${t.nombre_produits || 0} produit${(t.nombre_produits || 0) > 1 ? 's' : ''} ${t.nombre_produits ? '' : `<button class="suppr-x" type="button" data-sup="tailles" data-id="${t.id}" title="Supprimer">×</button>`}</small></div>`).join('')}</div>
        <form class="mini-in" data-aj="tailles"><input name="valeur" placeholder="Taille (ex. 6A)" required><input name="repere" placeholder="Repère (ex. 6 ans)"><button class="btn mini">Ajouter</button></form></section>
      <section class="panneau"><div class="tete"><h2>Coloris</h2><span class="mono" style="color:var(--taupe)">${GS.coloris.length}</span></div><div class="coloris">${GS.coloris.map(c => `<div><i style="background:${attr(c.hexa)}"></i><p><b>${esc(c.nom)}</b><small>${esc(c.hexa)} · ${c.nombre_produits || 0} produit(s) ${c.nombre_produits ? '' : `<button class="suppr-x" type="button" data-sup="coloris" data-id="${c.id}" title="Supprimer">×</button>`}</small></p></div>`).join('')}</div>
        <form class="mini-in" data-aj="coloris"><input name="nom" placeholder="Nom (ex. Rose poudré)" required><input name="hexa" type="color" value="#E0468A"><button class="btn mini">Ajouter</button></form></section>
      <section class="panneau"><div class="tete"><h2>Matières</h2><span class="mono" style="color:var(--taupe)">${GS.matieres.length}</span></div><div class="sous-cats">${GS.matieres.map(m => `<span>${esc(m.nom)} <button class="suppr-x" type="button" data-sup="matieres" data-id="${m.id}" title="Supprimer">×</button></span>`).join('')}</div>
        <form class="mini-in" data-aj="matieres"><input name="nom" placeholder="Matière (ex. Lin)" required><button class="btn mini">Ajouter</button></form></section>
    </div>
    <section class="panneau"><div class="tete"><h2>Photothèque</h2><span class="mono" style="color:var(--taupe)">${ph.length} images</span></div>
      <label class="depot" style="margin-bottom:16px"><input type="file" id="cfg-fichiers" accept="image/*" multiple hidden><svg viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg><b style="color:var(--encre)">Ajouter des photos</b><span>Elles seront disponibles pour toutes les fiches</span></label>
      <div class="phototheque">${ph.map(m => `<figure><span style="background:#F6E9F0 center/cover;${fondImg(m.url)}"></span><figcaption>${esc(m.nom || (m.url || '').split('/').pop())}</figcaption><small style="display:flex;justify-content:space-between">${m.usages ? `utilisée ×${m.usages}` : 'libre'}${m.usages ? '' : `<button class="suppr-x" type="button" data-sup="photheque" data-id="${m.id}" title="Supprimer">×</button>`}</small></figure>`).join('')}</div></section>`;
  },
  lier() {
    $$('[data-aj]').forEach(fm => fm.onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(fm)); if (fm.dataset.aj === 'tailles') d.ordre = GS.tailles.length;
      if (await ecrire(() => api(`/api/gestion/${fm.dataset.aj}/`, 'POST', d), 'Ajouté')) rendreAdmin();
    });
    $$('[data-sup]').forEach(b => b.onclick = async () => { if (await ecrire(() => api(`/api/gestion/${b.dataset.sup}/${b.dataset.id}/`, 'DELETE'), 'Supprimé')) rendreAdmin(); });
    $('#cfg-fichiers').onchange = async e => {
      const fs = [...e.target.files]; notifier(`Envoi de ${fs.length} photo(s)…`);
      for (const fi of fs) { const d = new FormData(); d.append('fichier', fi); d.append('nom', fi.name.replace(/\.[^.]+$/, '')); try { await envoyerFichier('/api/gestion/photheque/', d); } catch (er) { notifier(`${fi.name} : ${er.message}`); } }
      await chargerGestion(); rendreAdmin();
    };
  },
};

/* ------------------------------------------------------------ AVIS */
ECRANS.avis = {
  async avant() { G2.avis = await toutesLesPages(`/api/gestion/avis/?etat=${G2.filtreAvis}&page_size=100`).catch(() => []); },
  html() {
    return `<div class="adm-titre"><div><span class="mono">Ventes</span><h1>A<span class="serif">vis</span></h1></div></div>
    <p class="note-demo">Un avis laissé par une cliente après livraison n'apparaît sur la fiche qu'une fois approuvé ici.</p>
    <div class="barre-outils"><div class="onglets-adm" role="group">${[['en_attente', 'À modérer'], ['publie', 'Publiés'], ['refuse', 'Refusés']].map(([k, l]) => `<button type="button" data-fa="${k}" aria-pressed="${G2.filtreAvis === k}">${l}</button>`).join('')}</div></div>
    <section class="panneau avis-l">${G2.avis.length ? G2.avis.map(a => `<article><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><span><b>${esc(a.auteur_nom || 'Cliente')}</b> sur <a class="lien" href="#p-${attr(a.produit_slug)}" style="font-size:14px;color:var(--rose-sombre)">${esc(a.produit_nom)}</a></span><span class="etoiles">${'★'.repeat(a.note)}<span style="color:var(--filet)">${'★'.repeat(5 - a.note)}</span></span></div>
      <p>${esc(a.commentaire || '')}</p><div style="display:flex;justify-content:space-between;align-items:center"><small style="color:var(--taupe)">${new Date(a.ecrit_le).toLocaleDateString('fr-FR')}</small><div class="acts">${a.etat !== 'publie' ? `<button type="button" data-av="publier" data-id="${a.id}">Approuver</button>` : ''}${a.etat !== 'refuse' ? `<button type="button" data-av="refuser" data-id="${a.id}" class="danger">Refuser</button>` : ''}</div></div></article>`).join('')
      : `<div class="vide" style="border:0"><span class="grand-vide">Rien ici.</span><p>${G2.filtreAvis === 'en_attente' ? 'Aucun avis en attente de modération.' : 'Aucun avis dans cette liste.'}</p></div>`}</section>`;
  },
  lier() {
    $$('[data-fa]').forEach(b => b.onclick = () => { G2.filtreAvis = b.dataset.fa; rendreAdmin(); });
    $$('[data-av]').forEach(b => b.onclick = async () => { try { await api(`/api/gestion/avis/${b.dataset.id}/${b.dataset.av}/`, 'POST'); notifier(b.dataset.av === 'publier' ? 'Avis publié sur la fiche' : 'Avis refusé'); rendreAdmin(); } catch (e) { notifier(e.message); } });
  },
};

/* ------------------------------------------------------------ CLOCHE */
function installerChrome() {
  if (!$('#nav-avis')) {
    const cl = $('#adm-nav a[data-v="clientes"]');
    cl && cl.insertAdjacentHTML('afterend', `<a href="#admin-avis" data-v="avis" id="nav-avis"><svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>Avis</a>`);
    const top = $('.adm-top > div:last-child');
    top && top.insertAdjacentHTML('afterbegin', `<button class="cloche" type="button" id="cloche" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg><b id="cloche-n"></b></button>`);
    $('#cloche') && ($('#cloche').onclick = ouvrirCloche);
    const sortir = $$('#adm-nav .bas-nav a')[1];
    if (sortir) sortir.onclick = async e => { e.preventDefault(); try { await api('/api/compte/deconnexion/', 'POST'); } catch (_) {} Object.assign(GS, {pret:false, connecte:false}); etatServeur.moi = null; majCompte(); notifier('Déconnectée'); rendreAdmin(); };
  }
  const pn = $$('#adm-nav .compte-nav')[1]; if (pn && GS.compteurs) { pn.textContent = GS.compteurs.brouillon || ''; pn.title = 'Brouillons à finir'; }
  const moi = etatServeur.moi; const av = $('.adm-top .avatar'); if (av && moi) { av.textContent = (moi.nom || moi.email).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(); av.title = moi.nom || moi.email; }
  const d = $('.adm-top .date'); if (d) d.textContent = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).replace(/^./, x => x.toUpperCase());
}
let derniereCloche = null;
async function tourCloche() {
  if (route.page !== 'admin' || !GS.connecte) return;
  try {
    const c = await api('/api/gestion/notifications/'); G2.cloche = c;
    const n = $('#cloche-n'); if (n) n.textContent = c.non_lues || '';
    const tete = c.notifications[0];
    if (derniereCloche !== null && tete && tete.reference !== derniereCloche) {
      notifier(`Nouvelle commande ${tete.reference} · ${tete.nom_client} · ${F(tete.total)}`);
      await chargerGestion(); if (['tableau', 'commandes'].includes(route.vue || 'tableau')) rendreAdmin();
    }
    derniereCloche = tete ? tete.reference : '';
  } catch (_) {}
}
async function ouvrirCloche() {
  const c = G2.cloche;
  $('#tiroir').innerHTML = `<div class="t-tete"><div><span class="mono" style="color:var(--taupe)">${c.non_lues || 0} non lue${c.non_lues > 1 ? 's' : ''}</span><h2 style="margin-top:6px">Notifications</h2></div><button class="fermer-x" type="button" id="fermer-tiroir" aria-label="Fermer">×</button></div>
    <div class="t-corps"><div class="notif-l">${c.notifications.map(x => `<a href="#" data-ref="${attr(x.reference)}" class="${x.lue ? '' : 'neuve'}"><b>${esc(x.reference)} · ${esc(x.nom_client)}</b><span>${F(x.total)}</span><small>${esc(x.ville || '')} · ${new Date(x.creee_le).toLocaleString('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</small><small>${ADM.LIB[ST_VERS[x.statut]] || x.statut}</small></a>`).join('') || '<p style="color:var(--taupe)">Aucune commande pour l’instant.</p>'}</div></div>`;
  ouvrirTiroir(); $('#fermer-tiroir').onclick = fermerTiroir;
  $$('[data-ref]', $('#tiroir')).forEach(a => a.onclick = e => { e.preventDefault(); fermerTiroir(); if (route.vue !== 'commandes') location.hash = 'admin-commandes'; setTimeout(() => ouvrirCommande(a.dataset.ref), route.vue === 'commandes' ? 0 : 800); });
  try { G2.cloche = await api('/api/gestion/notifications/', 'POST'); $('#cloche-n').textContent = ''; } catch (_) {}
}
setInterval(tourCloche, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tourCloche(); });

/* ------------------------------------------------------------ AIGUILLAGE */
const rendreAdminAvantGestion = rendreAdmin;
rendreAdmin = async function () {
  if (!etatServeur.ok) return rendreAdminAvantGestion();
  let v = route.vue || 'tableau';
  if (v === 'produits-ruptures') { G2.filtreP = 'ruptures'; v = 'produits'; }
  const mFiche = v.match(/^produit-(\d+)$/), cle = mFiche || v === 'produit-nouveau' ? 'fiche' : v;
  if (!GS.pret && ECRANS[cle]) {
    $('#adm-vue').innerHTML = '<p class="note-demo">Lecture du back-office…</p>';
    try { await chargerGestion(); GS.connecte = true; }
    catch (er) { if (er.statut === 401 || er.statut === 403) { GS.connecte = false; $$('#adm-nav a[data-v]').forEach(a => a.classList.remove('actif')); return ecranConnexionAdmin(); } $('#adm-vue').innerHTML = `<p class="note-demo">${esc(er.message)}</p>`; return; }
  }
  if (!ECRANS[cle]) {
    await rendreAdminAvantGestion();
    if (GS.connecte) { installerChrome(); if (derniereCloche === null) tourCloche(); }
    if (v === 'tableau' && GS.pret && GS.connecte) ajouterJournal();
    return;
  }
  installerChrome(); if (derniereCloche === null) tourCloche();
  const e = ECRANS[cle], vue = $('#adm-vue'), jeton2 = ++G2.vues;
  $$('#adm-nav a[data-v]').forEach(a => a.classList.toggle('actif', a.dataset.v === v || (cle === 'fiche' && a.dataset.v === 'produits') || (v === 'commande-nouvelle' && a.dataset.v === 'commandes')));
  $('#adm-nav').classList.remove('ouvert'); $('#barre-enr').classList.remove('on');
  $('#nav-cmd').textContent = ADM.commandes.filter(c => c.statut === 'preparer' || c.statut === 'attente').length;
  try { if (e.avant) await e.avant(mFiche ? +mFiche[1] : null); }
  catch (er) { vue.innerHTML = `<p class="note-demo">${esc(er.message)}</p>`; return; }
  if (jeton2 !== G2.vues) return;
  vue.innerHTML = e.html(); vue.style.animation = 'none'; void vue.offsetWidth; vue.style.animation = '';
  e.lier();
};
async function ajouterJournal() {
  try { const d = await api('/api/gestion/journal/?page_size=8'); const l = d.results || d; if (!l.length || route.vue && route.vue !== 'tableau') return;
    $('#adm-vue').insertAdjacentHTML('beforeend', `<section class="panneau"><div class="tete"><h2>Activité de l'équipe</h2></div><div class="journal-l">${l.slice(0, 8).map(j => `<div><span><b>${esc(j.nom_auteur)}</b> ${esc(j.action)} <b>${esc(j.cible)}</b></span><small>${new Date(j.date).toLocaleString('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</small></div>`).join('')}</div></section>`);
  } catch (_) {}
}
/* GESTION>> */
