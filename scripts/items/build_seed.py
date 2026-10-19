"""
Builds scripts/items/items.seed.json: the item catalogue that seeds a fresh environment.

Sources (paths as arguments, nothing fetched):
  1. AUDITORIA_COMPLETA_1014_DETALHADA.csv  (audit Work, 1.014 individual opinions)
  2. 03_MAPA_1014_ITENS_POLITICAS_CANONICAS.csv  (canon v1.0: policies per item)
  3. front scripts/generators/data folder  (sf-item-info.json: AoN summaries; item-curation.json: Motávia names)

Usage:
  python scripts/items/build_seed.py <audit.csv> <mapa.csv> <front/scripts/generators/data>

Canon v1.0 (19/10/2026) is applied here, item by item where it names items:
  - access comes from the audit's comercializavel_2284; relics from viabilidade era_maravilhas;
  - P_MATES: Monomate common at technical pharmacies, Dimate rare (order), Trimate institutional;
  - P_VARIANTES: family lines without a model are suspended (access none);
  - P_HOMEBREW_LOCAL: Star Dew stays legendary (relic, no sale);
  - P_REGIONAL: Dezolis and Kolian goods keep their own region;
  - P_ARMADURA: a proposed artisan armour line (homebrew, not homologated) is added.
Players see, on day one, public items sold freely or to order in Motávia (published);
everything else starts as a proposal for the GM.
"""
import csv, io, json, os, re, sys, urllib.parse

audit_csv, mapa_csv, front_data = sys.argv[1:4]
# Output stays out of git (gitignored): it carries GM-only notes and the audit; the repo is public.
OUT = os.environ.get('SEED_OUT') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'items.seed.json')


def read(p):
    with io.open(p, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f, delimiter=';'))


audit = read(audit_csv)
policies = {r['id_item']: r['politicas_canonicas_referenciadas'] for r in read(mapa_csv)}
info = json.load(io.open(os.path.join(front_data, 'sf-item-info.json'), encoding='utf8'))
curation = json.load(io.open(os.path.join(front_data, 'item-curation.json'), encoding='utf8'))
assert len(audit) == 1014

ACCESS = {
    'sim': 'free',
    'sob encomenda': 'order',
    'oferta pontual / mercado usado': 'spot',
    'apenas institucional': 'institutional',
}
VARIANT_SUSPENDED = {'0421', '0422', '0459', '0460', '0461', '0486', '0527', '0529'}
ENERGY = {'Laser', 'Plasma', 'Shock', 'Sonic', 'Cryo', 'Flame', 'Acid', 'Projectile'} - {'Projectile'}
SERVICE_GROUPS = {'Professional Services', 'Lodgings', 'Food and Drinks', 'Transportation'}
CAVE_GEAR = re.compile(
    r'Rope|Canteen|Bedroll|Blanket|Sleeping Bag|Tent|Lighter|Mess Kit|Tool, Manual|Backpack|Ladder|Map, |Binoculars|'
    r'Cable Line|Medpatch|Medkit|Sprayflesh|Enviro Mask|Fire Extinguisher|Portable Light|Zipstick|Emergency Beacon|'
    r'Clothing, (Travel|Environmental|Everyday)|Chemical (cold|heat) pack|Warming Balm|Hygiene Kit|Waymarker|Hammock|'
    r'Scuba Gear|Riding Saddle|Restraints|Shock Stick|Oxygen Candle|Magnetic Jack|Gear Clamp|Bug Snare|Xenobiologist|'
    r'Radiation Badge|Field Ration|Grappler|Climbing',
)
BIG_GEAR = re.compile(r'Emplacement|Turret|Treadmill|Miniature Sun|Drone|Raft|Habitat|Vehicle|Aquarium|Plantera')
LOCAL_NO_LOOT = {'meal', 'lodging', 'mount', 'animal', 'seal', 'krupp'}


def access_of(r):
    a = ACCESS.get(r['comercializavel_2284'])
    if a:
        return a
    if r['viabilidade_tecnologica'] == 'era_maravilhas':
        return 'relic'
    if 'dezolis' in r['tags'].split():
        return 'free'  # sold in Dezolis (regional catalogue)
    return 'none'


def num(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def loot_sites(r, access, tags):
    """Where an item can turn up as loot. Common sense, per canon: wonders and orbital
    gear stay in wonder-age sites; caves and old cellars hold what people carried or kept."""
    kind, group, cat = r['tipo'], r['grupo'], r['categoria']
    lvl = num(r['nivel'])
    sites = set()
    if r['origem'] == 'Algol':
        if 'dezolis' in tags or 'kolian' in tags or tags & LOCAL_NO_LOOT:
            return []
        if 'relic' in tags or 'scrap' in tags:
            sites |= {'cave', 'cellar'}
        if tags & {'travel', 'kit', 'fuel', 'chitin', 'silk', 'parts', 'water', 'ammo', 'herb', 'medicine', 'mate', 'map'}:
            sites.add('cave')
        if tags & {'book', 'map', 'drink', 'parts', 'fuel', 'medicine', 'mate', 'ammo', 'relic', 'scrap', 'silk'}:
            sites.add('cellar')
        if r['id_item'] in ('0946', '0947', '0971'):  # opaque component, satellite board, crystal
            sites |= {'seed', 'orbital'} if r['id_item'] != '0971' else {'seed'}
        if r['id_item'] == '1010':  # Star Dew: legendary, only in wonder-age sites
            sites = {'seed'}
        return sorted(sites)
    if group in SERVICE_GROUPS:
        return []
    name = r['nome']
    wonder = access in ('relic', 'institutional', 'none')
    organic = cat == 'Organic'
    if wonder and kind in ('tech', 'cybernetic', 'biotech', 'armor', 'armorUpgrade', 'hybrid', 'personalUpgrade'):
        sites.add('seed')
    if wonder and kind == 'weapon' and cat in ENERGY:
        sites.add('seed')
    if wonder and kind in ('tech', 'armor', 'armorUpgrade') and access != 'none' and not organic:
        sites.add('orbital')
    if kind == 'other' and access in ('institutional', 'relic') and lvl <= 6:
        sites.add('seed')
        if not organic:
            sites.add('orbital')
    if access in ('free', 'order', 'spot'):
        # Caves: what explorers and caravans carried (survival gear, blades, ammo, medicine).
        if kind == 'weapon' and (cat in ('', '—') or group == 'Ammo'):
            sites.add('cave')
        if group == 'Medicinals' or CAVE_GEAR.search(name):
            sites.add('cave')
        # Old cellars: whatever people stored, except big machines and living things.
        if kind == 'weapon' or (kind in ('other', 'tech') and lvl <= 6 and not organic and not BIG_GEAR.search(name)):
            sites.add('cellar')
    return sorted(sites)


def gm_notes(r):
    parts = [
        ('Parecer', r['justificativa_individual']),
        ('Efeito', r['efeito_original_resumido']),
        ('Equilíbrio', r['equilibrio_1e']),
        ('Cadeia', r['infraestrutura_necessaria']),
        ('Pendência', r['pendencia']),
    ]
    return '\n'.join(f'{k}: {v}' for k, v in parts if v)


AUDIT_KEYS = [
    'manter', 'comercializavel_2284', 'canal_recomendado', 'viabilidade_tecnologica', 'situacao_existencia',
    'mercados_e_locais', 'teste_100_usuarios', 'teste_reparo_30dias', 'teste_universidade_1_100',
    'situacao_fonte', 'efeito_verificado_fonte', 'grau_confianca', 'estado_homologacao', 'observacao',
]

items = []
for r in audit:
    code = r['id_item']
    name = r['nome']
    tags = set(r['tags'].split())
    access = access_of(r)
    region = 'dezolis' if 'dezolis' in tags else 'kolian' if 'kolian' in tags else 'motavia'
    if code in VARIANT_SUSPENDED:
        access = 'none'
    if code == '1006':
        access = 'free'
    elif code == '1007':
        access = 'order'
    elif code == '1008':
        access = 'institutional'
    elif code == '1010':
        access = 'relic'
    algol = r['origem'] == 'Algol'
    sf = info.get(name, {})
    cur = curation.get(name)
    rules = (r['nota'] or None) if algol else (sf.get('s') or None)
    if code in ('1006', '1007', '1008') and rules:
        rules += ' (provisório: adaptação do sérum SF1e ainda não homologada, P_MATES)'
    description = (r['descricao'] or r['nota'] or None) if algol else (sf.get('d') or None)
    visibility = 'public' if r['sigilo'] == 'publico' else 'gm'
    published = visibility == 'public' and access in ('free', 'order') and region == 'motavia'
    items.append({
        'code': code,
        'name': name,
        'localName': (cur[2] or None) if cur else None,
        'origin': 'algol' if algol else 'starfinder',
        'kind': r['tipo'],
        'group': r['grupo'] or None,
        'category': r['categoria'] or None,
        'level': num(r['nivel']),
        'damage': r['dano'] or None,
        'unit': r['unidade'] or None,
        'region': region,
        'description': description[:4000] if description else None,
        'rules': rules[:4000] if rules else None,
        'sourceUrl': None if algol else 'https://www.aonsrd.com/Search.aspx?Query=' + urllib.parse.quote(name),
        'localPrice': None,
        'availabilityNote': None,
        'refPrice': num(r['preco']) or None,
        'access': access,
        'channel': r['canal_recomendado'] or None,
        'tags': sorted(tags),
        'shops': [],
        'loot': loot_sites(r, access, tags),
        'policies': policies.get(code) or None,
        'flags': r['flags_pendencia'] or None,
        'gmNotes': gm_notes(r)[:8000],
        'audit': {k: r[k][:8000] for k in AUDIT_KEYS if r.get(k)},
        'visibility': visibility,
        'status': 'published' if published else 'proposal',
    })

# ── P_ARMADURA: artisan armour line (homebrew proposal; numbers to be tested at the table)
ARMOR = [
    # code, name, group, level, EAC, KAC, maxDex, ACP, speed, slots, bulk, ref price, material, description
    ('HB-ARM-01', 'Gibão de couro de Krupp', 'Light', 1, 1, 2, 5, 0, 0, 0, '1', 150, 'couro', 'Gibão de couro curtido com reforços de quitina nos ombros. A proteção mais comum de caravaneiros.'),
    ('HB-ARM-02', 'Couraça leve de quitina', 'Light', 3, 3, 4, 4, -1, 0, 0, '1', 1000, 'quitina', 'Placas finas de carapaça de Krupp costuradas sobre couro. Leve e fácil de remendar na estrada.'),
    ('HB-ARM-03', 'Malha de seda estrutural', 'Light', 5, 5, 6, 4, -1, 0, 1, '1', 3000, 'seda', 'Tecido denso de seda de Sila-Weaver em várias camadas, com placas pequenas nos pontos vitais.'),
    ('HB-ARM-04', 'Couraça laminada de caçador', 'Light', 8, 8, 9, 4, -1, 0, 1, '1', 9000, 'quitina e seda', 'Lâminas de quitina tratada sobre seda estrutural, feitas sob medida por armadureiros de prestígio.'),
    ('HB-ARM-05', 'Armadura de seda e placas de Aerodyn', 'Light', 11, 11, 12, 4, -1, 0, 1, 'L', 25000, 'liga e seda', 'Placas de liga leve de Aerodyn sobre seda estrutural. Rara; só oficinas de alto nível conseguem montar.'),
    ('HB-ARM-06', 'Placas de quitina de Krupp', 'Heavy', 2, 3, 5, 2, -3, -10, 0, '2', 600, 'quitina', 'Carapaça de Krupp adulta recortada em placas grossas. Pesada, barulhenta e confiável.'),
    ('HB-ARM-07', 'Cota de malha forjada', 'Heavy', 4, 5, 7, 2, -3, -10, 1, '3', 2000, 'aço', 'Malha de anéis de aço com gibão acolchoado. Trabalho de ferreiro experiente.'),
    ('HB-ARM-08', 'Armadura de placas de caçador', 'Heavy', 7, 8, 11, 2, -3, -10, 1, '3', 7000, 'aço e quitina', 'Placas de aço forjado com juntas de quitina. Exige ajuste anatômico por espécie.'),
    ('HB-ARM-09', 'Placas reforçadas da Guilda', 'Heavy', 10, 11, 14, 2, -3, -10, 2, '3', 18000, 'aço temperado', 'Modelo de escolta pesada encomendado pela Guilda. Fabricado em lotes pequenos em Aiedo.'),
    ('HB-ARM-10', 'Couraça de Aerodyn', 'Heavy', 13, 14, 17, 2, -3, -5, 2, '3', 40000, 'liga de Aerodyn', 'Placas de liga e articulações de precisão de Aerodyn. Peça de encomenda longa e cara.'),
]
for code, name, grp, lvl, eac, kac, dex, acp, spd, slots, bulk, price, material, desc in ARMOR:
    items.append({
        'code': code, 'name': name, 'localName': None, 'origin': 'homebrew', 'kind': 'armor',
        'group': grp, 'category': grp, 'level': lvl, 'damage': None, 'unit': None, 'region': 'motavia',
        'description': desc,
        'rules': (f'Level {lvl}; Category {grp} · EAC Bonus +{eac}; KAC Bonus +{kac}; Max. Dex Bonus +{dex} · '
                  f'Armor Check Penalty {acp}; Speed Adjustment {spd} ft. · Upgrade Slots {slots}; Bulk {bulk}. '
                  'Sem suporte ambiental (A1).'),
        'sourceUrl': None, 'localPrice': None, 'availabilityNote': None,
        'refPrice': price, 'access': 'order', 'channel': 'Armadureiro, ferreiro ou curtidor (Aiedo, Piata, cidades de rota)',
        'tags': [material.split()[0]], 'shops': [], 'loot': ['cave', 'cellar'] if lvl <= 8 else ['cellar'],
        'policies': 'P_ARMADURA',
        'flags': 'MATERIAL_PROCESSO',
        'gmNotes': ('Proposta homebrew P_ARMADURA: linha artesanal sem A1, escalonada um pouco abaixo das armaduras SF1e '
                    'do mesmo nível. Testar EAC/KAC contra encontros antes de homologar; preço é referência.'),
        'audit': None, 'visibility': 'gm', 'status': 'proposal',
    })

codes = [i['code'] for i in items]
assert len(codes) == len(set(codes))
json.dump({'version': 'canon-v1.0+audit-1014', 'items': items}, io.open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=0)

from collections import Counter
print(len(items), 'items ->', OUT)
print('access', Counter(i['access'] for i in items))
print('status', Counter((i['visibility'], i['status']) for i in items))
print('loot', Counter(s for i in items for s in i['loot']))
