"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "../../../../components/ui/Icon";
import { waitForActiveUser } from "../../../../lib/auth/session";
import { supabase } from "../../../../lib/supabaseClient";
import { useVaultPreferences } from "../../../../components/vault/VaultPreferencesContext";
import {
  VAULT_CATEGORY_DEFINITIONS,
  getVaultSubsectionsForGroup,
  loadVaultPreferences,
  saveVaultPreferences,
  type VaultCategoryGroupKey,
  type VaultSubsectionKey,
} from "../../../../lib/vaultPreferences";
import {
  SettingsCard,
  SettingsPageShell,
  StatusNote,
  cardStyle,
  ghostBtn,
  primaryBtn,
} from "../../components/settings/SettingsPrimitives";

export default function MyVaultPage() {
  const { preferences, setPreferences } = useVaultPreferences();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState(preferences);

  useEffect(() => {
    setDraft(preferences);
  }, [preferences]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      try {
        const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
        if (!mounted || !user) return;
        const next = await loadVaultPreferences(supabase, user.id);
        if (!mounted) return;
        setPreferences(next);
        setDraft(next);
      } catch (error) {
        if (!mounted) return;
        setStatus(`Could not load My Vault preferences: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [setPreferences]);

  const enabledCount = useMemo(
    () => VAULT_CATEGORY_DEFINITIONS.filter((item) => draft.groups[item.key]).length,
    [draft],
  );

  async function persist() {
    setSaving(true);
    setStatus("");
    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
      if (!user) return;
      const saved = await saveVaultPreferences(supabase, user.id, draft);
      setDraft(saved);
      setPreferences(saved);
      setStatus("My Vault preferences saved.");
    } catch (error) {
      setStatus(`Could not save My Vault preferences: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleCategory(key: VaultCategoryGroupKey) {
    setDraft((current) => ({
      ...current,
      groups: {
        ...current.groups,
        [key]: !current.groups[key],
      },
    }));
  }

  function toggleSubsection(key: VaultSubsectionKey) {
    setDraft((current) => ({
      ...current,
      subsections: {
        ...current.subsections,
        [key]: !current.subsections[key],
      },
    }));
  }

  return (
    <SettingsPageShell
      title="My Vault"
      subtitle="Choose which record groups and subsections stay visible across navigation, the dashboard, onboarding follow-up, and shared empty-state guidance."
    >
      <SettingsCard
        title="Visible vault categories"
        description="Hide the sections you do not use today, then refine subsection visibility and turn them back on later without losing any saved records."
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {enabledCount} of {VAULT_CATEGORY_DEFINITIONS.length} category groups visible
          </div>
        </div>

        <div className="lf-content-grid">
          {VAULT_CATEGORY_DEFINITIONS.map((category) => (
            <label key={category.key} style={toggleCardStyle}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={draft.groups[category.key]}
                  onChange={() => toggleCategory(category.key)}
                  style={{ marginTop: 3 }}
                />
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={toggleIconStyle}>
                      <Icon name={category.icon} size={16} />
                    </span>
                    <strong style={{ fontSize: 14 }}>{category.label}</strong>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{category.description}</div>
                  {getVaultSubsectionsForGroup(category.key).length ? (
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {getVaultSubsectionsForGroup(category.key).map((subsection) => (
                        <label key={subsection.key} style={subToggleRowStyle}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={draft.subsections[subsection.key]}
                              disabled={!draft.groups[category.key]}
                              onChange={() => toggleSubsection(subsection.key)}
                            />
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{subsection.label}</span>
                          </span>
                          <span style={{ color: "#64748b", fontSize: 12 }}>{subsection.description}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={primaryBtn} disabled={saving || loading} onClick={() => void persist()}>
            {saving ? "Saving..." : "Save My Vault"}
          </button>
          <button
            type="button"
            style={ghostBtn}
            disabled={saving || loading}
            onClick={() => setDraft(preferences)}
          >
            Reset changes
          </button>
        </div>

        <StatusNote message={status} />
      </SettingsCard>
    </SettingsPageShell>
  );
}

const toggleCardStyle = {
  ...cardStyle,
  padding: 14,
  cursor: "pointer",
} as const;

const toggleIconStyle = {
  width: 28,
  height: 28,
  borderRadius: 10,
  border: "1px solid #dbe3eb",
  background: "#f8fafc",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;

const subToggleRowStyle = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: 8,
  display: "grid",
  gap: 4,
} as const;
