"""Vyra economy: coin packages, store catalogue, match payouts."""
from typing import List, Dict


COIN_PACKAGES: List[Dict] = [
    {
        "id": "starter",
        "label": "Starter",
        "usd": 1.0,
        "coins": 100,
        "bonus": 0,
        "tagline": "First strike",
    },
    {
        "id": "hunter",
        "label": "Hunter",
        "usd": 5.0,
        "coins": 550,
        "bonus": 50,
        "tagline": "+10% bonus",
    },
    {
        "id": "warlord",
        "label": "Warlord",
        "usd": 10.0,
        "coins": 1200,
        "bonus": 200,
        "tagline": "+20% bonus",
        "popular": True,
    },
    {
        "id": "kingmaker",
        "label": "Kingmaker",
        "usd": 20.0,
        "coins": 2600,
        "bonus": 600,
        "tagline": "+30% bonus",
    },
]


def get_package(package_id: str):
    for p in COIN_PACKAGES:
        if p["id"] == package_id:
            return p
    return None


# Store: skins + maps. Either coin price or USD price (or both).
STORE_ITEMS: List[Dict] = [
    {
        "id": "skin_tiger_obsidian",
        "kind": "skin",
        "side": "tiger",
        "name": "Obsidian Tiger",
        "description": "Matte-black coat with crimson veins.",
        "color": "#ff3366",
        "coins": 800,
        "usd": 2.99,
    },
    {
        "id": "skin_tiger_voltage",
        "kind": "skin",
        "side": "tiger",
        "name": "Voltage Tiger",
        "description": "Electric-blue stripes that crackle on pounce.",
        "color": "#00e5ff",
        "coins": 1500,
        "usd": 4.99,
    },
    {
        "id": "skin_goat_jade",
        "kind": "skin",
        "side": "goat",
        "name": "Jade Sentinel",
        "description": "Carved-jade horns, glows on fortify.",
        "color": "#39ff14",
        "coins": 800,
        "usd": 2.99,
    },
    {
        "id": "skin_goat_solar",
        "kind": "skin",
        "side": "goat",
        "name": "Solar Sentinel",
        "description": "Gold-leaf armour, leaves a sun trail on decoy.",
        "color": "#ffd700",
        "coins": 1500,
        "usd": 4.99,
    },
    {
        "id": "map_neon_grid",
        "kind": "map",
        "side": None,
        "name": "Neon Grid",
        "description": "Cyberpunk arena with reactive cyan ley-lines.",
        "color": "#00e5ff",
        "coins": 2000,
        "usd": 5.99,
    },
    {
        "id": "map_temple",
        "kind": "map",
        "side": None,
        "name": "Hidden Temple",
        "description": "Stone-cut shrine, torchlight ambience.",
        "color": "#ffd700",
        "coins": 2500,
        "usd": 6.99,
    },
]


def get_store_item(item_id: str):
    for i in STORE_ITEMS:
        if i["id"] == item_id:
            return i
    return None


# Match economy
MIN_ENTRY_FEE = 0
MAX_ENTRY_FEE = 1000
ALLOWED_ENTRY_FEES = [0, 10, 25, 50, 100, 250]
PLATFORM_FEE_BPS = 1000  # 10% of pot, in basis points


def payout_for_pot(pot: int) -> Dict[str, int]:
    """Given a pot (sum of both entries), return winner_take and platform_fee."""
    if pot <= 0:
        return {"winner": 0, "platform": 0}
    platform = (pot * PLATFORM_FEE_BPS) // 10000
    winner = pot - platform
    return {"winner": winner, "platform": platform}
