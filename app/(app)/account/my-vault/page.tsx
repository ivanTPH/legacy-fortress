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
      subtitle="Choose what appears in your Vault. You can turn areas back on at any time without losing your information."
    >
      <SettingsCard
        title="Visible vault categories"
        description="Hide the sections you do not use today, then refine subsection visibility and turn them back on later without losing any saved records."
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {enabledCount} of {VAULT_CATEGORY_DEFINITIONS.length} areas shown
          </div>
        </div>

        <div className="lf-content-grid lf-my-vault-settings-grid">
          {VAULT_CATEGORY_DEFINITIONS.map((category) => (
            <section key={category.key} className="lf-settings-toggle-card">
              <div className="lf-settings-toggle-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={toggleIconStyle}><Icon name={category.icon} size={16} /></span>
                  <strong style={{ fontSize: 15 }}>{category.label}</strong>
                </div>
                <label className="lf-settings-toggle" aria-label={`Show ${category.label} in My Vault`}>
                  <input
                    type="checkbox"
                    checked={draft.groups[category.key]}
                    onChange={() => toggleCategory(category.key)}
                  />
                  <span className="lf-settings-toggle-track" aria-hidden="true" />
                </label>
              </div>
              <div style={{ color: "#6B5F5A", fontSize: 13, lineHeight: "18px" }}>{category.description}</div>
              {getVaultSubsectionsForGroup(category.key).length ? (
                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  {getVaultSubsectionsForGroup(category.key).map((subsection) => (
                    <label key={subsection.key} style={subToggleRowStyle}>
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{subsection.label}</span>
                        <span className="lf-settings-toggle" style={{ transform: "scale(.82)", transformOrigin: "right center" }} aria-label={`Show ${subsection.label}`}>
                          <input
                            type="checkbox"
                            checked={draft.subsections[subsection.key]}
                            disabled={!draft.groups[category.key]}
                            onChange={() => toggleSubsection(subsection.key)}
                          />
                          <span className="lf-settings-toggle-track" aria-hidden="true" />
                        </span>
                      </span>
                      <span style={{ color: "#6B5F5A", fontSize: 12 }}>{subsection.description}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </section>
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
