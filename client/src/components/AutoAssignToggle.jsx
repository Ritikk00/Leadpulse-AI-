import { useState } from 'react';
import { api } from '../api';
import { useToast } from './useToast';

export function AutoAssignToggle({ enabled, onChange, disabled = false }) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function toggle() {
    if (saving || disabled) return;
    const previousValue = enabled;
    const nextValue = !previousValue;
    onChange(nextValue);
    setSaving(true);
    try {
      await api.put('/settings', { autoAssign: nextValue });
      toast.success(nextValue ? 'Auto-assignment enabled (Round-Robin)' : 'Manual assignment mode enabled');
    } catch {
      onChange(previousValue);
      toast.error('Could not update auto-assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="auto-assign-row" aria-busy={saving}>
    <span className="auto-assign-copy">
      <strong>Auto-Assign Leads</strong>
      <small>Distribute new public inquiries among active employees in order.</small>
      <span className={`auto-assign-status${enabled ? ' is-active' : ''}`}>{enabled ? 'Round-Robin Active' : 'Manual Mode'}</span>
    </span>
    <button
      type="button"
      className={`auto-assign-switch${enabled ? ' is-active' : ''}`}
      role="switch"
      aria-label="Auto-Assign Leads (Round-Robin)"
      aria-checked={enabled}
      disabled={disabled || saving}
      onClick={toggle}
    >
      <span />
    </button>
  </div>;
}
