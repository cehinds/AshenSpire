import { bringProfileForward, retiredStoredSettingKeys } from '../model/advancedConfig.js';
import { seedSettingsDefaults } from '../model/settingsDefaults.js';

/** Prepares stored settings in place and saves each applied migration. */
export function CreateProfileBoot({ contentBundle, saveMeta, warn, getPromotion })
{
    return {
        BringStoredProfileForward(meta)
        {
            const warnings = [];
            const settings = bringProfileForward(meta, contentBundle, saveMeta, warnings);
            for (const line of warnings)
            {
                warn(line);
            }
            return settings;
        },

        SeedPromotedDefaults(meta, settings)
        {
            const seeded = seedSettingsDefaults(settings, getPromotion());
            if (!Object.keys(seeded).length)
            {
                return;
            }
            for (const [key, value] of Object.entries(seeded))
            {
                if (value === undefined)
                {
                    delete settings[key];
                }
                else
                {
                    settings[key] = value;
                }
            }
            meta.settings = settings;
            saveMeta(meta);
        },

        DropRetiredStoredSettings(meta, settings)
        {
            const stale = retiredStoredSettingKeys(settings);
            if (!stale.length)
            {
                return;
            }
            for (const key of stale)
            {
                delete settings[key];
            }
            meta.settings = settings;
            saveMeta(meta);
        },
    };
}
