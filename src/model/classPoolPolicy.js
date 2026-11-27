// JSON-driven class pool filtering for rewards, shops, and Blacksmith stock.
import { gameContent } from './gameProfile.js';
import { ItemIsThemed } from './itemThemePick.js';
import { GEAR_TYPES } from '../content/gearTypes.js';

const CLASS_DECK_LIST_MODE = 'classDeckList';
const SHOP_SOURCES = new Set(['shop', 'blacksmith']);

function isShopSource(source)
{
    return SHOP_SOURCES.has(source);
}

function classCardFilterActive(run, source)
{
    const rewardConfig = gameContent(run, 'rewards')?.classPools;
    if (!rewardConfig || rewardConfig.enabled !== true)
    {
        return false;
    }
    if (!isShopSource(source))
    {
        return true;
    }
    const shopFilter = gameContent(run, 'shops')?.classFilter;
    if (!shopFilter)
    {
        return true;
    }
    return shopFilter.enabled !== false && shopFilter.combatCards !== false;
}

function classWeaponFilterActive(run, source)
{
    const rewardConfig = gameContent(run, 'rewards')?.classPools;
    if (isShopSource(source))
    {
        const shopFilter = gameContent(run, 'shops')?.classFilter;
        if (shopFilter)
        {
            return shopFilter.enabled === true && shopFilter.weapons === true;
        }
    }
    return rewardConfig?.enabled === true
        && rewardConfig?.restrictWeaponsToClassTheme === true;
}

/**
 * ClassCardPoolAllowed(run, card, options) -> true when the card may appear in
 * combat rewards or shop shelves for the run's class under rewards.json / shops.json.
 */
export function ClassCardPoolAllowed(
    run,
    card,
    { source = 'combat' } = {},
)
{
    if (!card || !run?.class)
    {
        return false;
    }
    if (Array.isArray(card.allowedClasses) && card.allowedClasses.length > 0)
    {
        return card.allowedClasses.includes(run.class);
    }
    if (!classCardFilterActive(run, source))
    {
        return card.class === 'colorless' || card.class === run.class;
    }
    const rewardConfig = gameContent(run, 'rewards')?.classPools;
    if (rewardConfig?.mode === CLASS_DECK_LIST_MODE)
    {
        const classCards = rewardConfig.cardLists?.[run.class];
        if (Array.isArray(classCards) && classCards.length > 0)
        {
            if (classCards.includes(card.id))
            {
                return true;
            }
            return rewardConfig.includeColorlessFallback === true
                && card.class === 'colorless';
        }
    }
    return card.class === run.class || card.class === 'colorless';
}

/**
 * ClassWeaponPoolAllowed(run, weaponRow, options) -> true when the weapon matches
 * the run's class theme (or explicit allowedClasses) when class filtering is active.
 */
export function ClassWeaponPoolAllowed(
    run,
    weaponRow,
    { source = 'combat' } = {},
)
{
    if (!weaponRow || !run?.class)
    {
        return false;
    }
    if (!classWeaponFilterActive(run, source))
    {
        return true;
    }
    if (Array.isArray(weaponRow.allowedClasses) && weaponRow.allowedClasses.length > 0)
    {
        return weaponRow.allowedClasses.includes(run.class);
    }
    if (!GEAR_TYPES?.themes?.[run.class])
    {
        return true;
    }
    return ItemIsThemed(
        weaponRow,
        run.class,
        'weapons',
    );
}
