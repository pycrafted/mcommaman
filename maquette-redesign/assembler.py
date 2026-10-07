"""Insère pont-gestion.js dans une page de la maquette, juste avant le lancement du pont."""
import re, sys
couche = open(sys.argv[1], encoding='utf-8').read().strip()
for page in sys.argv[2:]:
    s = open(page, encoding='utf-8').read()
    s = re.sub(r'/\* <<GESTION \*/.*?/\* GESTION>> \*/\n?', '', s, flags=re.S)
    i = s.rfind('\nchargerServeur();')
    assert i > 0, page
    s = s[:i] + '\n' + couche + '\n' + s[i:]
    # bandeau : préciser qu'il s'agit des pièces publiées
    s = s.replace("`Connecté au serveur local · ${C.length} pièces, ${etatServeur.racines.length} catégories`", "`Connecté au serveur local · ${C.length} pièce${C.length > 1 ? 's' : ''} en ligne, ${etatServeur.racines.length} catégories`")
    open(page, 'w', encoding='utf-8').write(s)
    print('ok', page)
