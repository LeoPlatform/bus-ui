import { describe, it, expect } from 'vitest';
import { systemSaveBlockedReason } from '$comps/features/dashboard/types';

/**
 * When the System Settings form must refuse to save (ES-4286).
 *
 * Settings are deliberately not cleared when the dashboard id changes, so a failed load left
 * the previously viewed node's values in the form; Save then wrote them onto this system's
 * record, blanking its label, icon and type. The load error is now the gate.
 *
 * The second gate is legacy parity: legacy blocked a save when the type was Elastic Search or
 * MongoDB and host/database were empty. This tab has no such inputs, so it cannot produce a
 * usable record for those types at all.
 */

const ok = { settingsError: null, systemType: 'Custom', originalType: 'Custom' };

describe('systemSaveBlockedReason', () => {
  it('allows a save when the record loaded and the type is unchanged', () => {
    expect(systemSaveBlockedReason(ok)).toBeNull();
  });

  it('blocks every save while the settings load is in error', () => {
    const reason = systemSaveBlockedReason({ ...ok, settingsError: 'System system:hubspot not found' });
    expect(reason).toContain('could not be loaded');
    expect(reason).toContain('System system:hubspot not found');
  });

  it('blocks a change into a type whose connection settings this tab cannot supply', () => {
    expect(systemSaveBlockedReason({ ...ok, systemType: 'Elastic Search' })).toContain('connection settings');
    expect(systemSaveBlockedReason({ ...ok, systemType: 'MongoDB' })).toContain('connection settings');
  });

  it('still allows editing a system already set to such a type', () => {
    // The operator is changing the label or icon, not the backend — legacy only validated on
    // the type's own fields, so there is nothing to block here.
    expect(
      systemSaveBlockedReason({ settingsError: null, systemType: 'MongoDB', originalType: 'MongoDB' })
    ).toBeNull();
  });

  it('allows changing away from such a type', () => {
    expect(
      systemSaveBlockedReason({ settingsError: null, systemType: 'Custom', originalType: 'Elastic Search' })
    ).toBeNull();
  });

  it('allows the types that need no connection settings', () => {
    for (const systemType of ['CSV', 'LeoDW', 'Custom']) {
      expect(systemSaveBlockedReason({ ...ok, systemType })).toBeNull();
    }
  });

  it('reports the load error ahead of a type problem when both apply', () => {
    const reason = systemSaveBlockedReason({
      settingsError: 'boom',
      systemType: 'MongoDB',
      originalType: 'Custom'
    });
    expect(reason).toContain('could not be loaded');
  });
});
