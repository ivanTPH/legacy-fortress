"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import InfoTip from "../ui/InfoTip";
import { SettingsCard, SettingsPageShell, StatusNote, ghostBtn, gridStyle, inputStyle, primaryBtn, textAreaStyle } from "../../app/(app)/components/settings/SettingsPrimitives";
import { supabase } from "../../lib/supabaseClient";
import { waitForActiveUser } from "../../lib/auth/session";
import { useAccessibilityPreferences } from "../accessibility/AccessibilityPreferencesContext";

type SupportMessage = {
  role: "assistant" | "user";
  text: string;
};

const HELP_TOPICS = [
  {
    id: "documents",
    label: "How do I add documents?",
    answer: "Open the relevant category, add or open the record, then attach files in the shared documents panel. Images and PDFs can be previewed inside the app.",
  },
  {
    id: "invite",
    label: "How do I invite people?",
    answer: "Go to Contacts, choose the person, then decide which categories they can review and whether any specific records should be editable before sending the email invite.",
  },
  {
    id: "security",
    label: "How secure is the application?",
    answer: "Legacy Fortress keeps profile and sensitive data in the secured workspace model, uses signed URLs for files, and separates owner access from linked-account visibility.",
  },
  {
    id: "permissions",
    label: "How do permissions work?",
    answer: "Start by choosing categories in Contacts, then review the linked records listed beneath them. Each record begins as view only and can be switched to editable only where needed.",
  },
  {
    id: "vault",
    label: "How do I use My Vault?",
    answer: "Open Profile or Account and choose My Vault to hide categories or subsections you do not want in navigation, dashboard summaries, and follow-up prompts.",
  },
];

export default function SupportWorkspace() {
  const { preferences } = useAccessibilityPreferences();
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      role: "assistant",
      text: "Hello. I can help with documents, invitations, permissions, security, and My Vault. Choose a prompt below or describe what you need.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [requestType, setRequestType] = useState("problem");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const readAloudAvailable = useMemo(
    () => typeof window !== "undefined" && "speechSynthesis" in window && preferences.readAloudEnabled,
    [preferences.readAloudEnabled],
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function askQuestion(question: string) {
    const matched = HELP_TOPICS.find((item) => item.label === question || item.id === question);
    const answer = matched?.answer ?? "I can help with documents, invites, permissions, security, My Vault, and support requests. Try one of the suggested prompts for a faster answer.";
    setMessages((current) => [
      ...current,
      { role: "user", text: matched?.label ?? question },
      { role: "assistant", text: answer },
    ]);
    setPrompt("");
  }

  function readLatestAnswer() {
    if (!readAloudAvailable || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const latestAssistant = [...messages].reverse().find((item) => item.role === "assistant");
    if (!latestAssistant) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(latestAssistant.text));
  }

  async function submitSupportRequest() {
    setSaving(true);
    setStatus("");
    try {
      const user = await waitForActiveUser(supabase, { attempts: 4, delayMs: 100 });
      if (!user) return;
      const payload = {
        user_id: user.id,
        section_key: "support",
        category_key: "help_requests",
        title: requestTitle.trim() || `${requestType} request`,
        summary: requestBody.trim() || null,
        estimated_value: 0,
        details: {
          request_type: requestType,
          prompt_context: prompt.trim() || null,
          source: "support_workspace",
        },
        updated_at: new Date().toISOString(),
      };
      const res = await supabase.from("section_entries").insert(payload);
      if (res.error) throw res.error;
      setRequestTitle("");
      setRequestBody("");
      setStatus("Support request saved. We have kept it in your support workspace.");
    } catch (error) {
      setStatus(`Could not save support request: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPageShell
      title="Support"
      subtitle="Ask for guidance, report issues, request follow-up, or get a quick walkthrough of the key tasks in the application."
    >
      <SettingsCard
        title="Help assistant"
        description="Start with the guided assistant for quick application help, then send a support request if you still need a person to follow up."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Interactive help</strong>
          <InfoTip
            label="Explain the support assistant"
            message="Use the help assistant for common questions about documents, invitations, permissions, security, and My Vault. It behaves like a guided support chat."
          />
        </div>
        {preferences.helpWizardEnabled ? (
          <div style={wizardNoteStyle}>
            <Icon name="tips_and_updates" size={16} />
            Guided help is enabled, so suggested prompts stay visible to make common tasks easier to complete.
          </div>
        ) : null}
        <div style={chatPanelStyle} className="lf-support-card">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} style={message.role === "assistant" ? assistantMessageStyle : userMessageStyle}>
              {message.text}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {HELP_TOPICS.map((topic) => (
            <button key={topic.id} type="button" style={ghostBtn} onClick={() => askQuestion(topic.id)}>
              {topic.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            style={{ ...inputStyle, minWidth: 260, flex: 1 }}
            placeholder="Ask a support question"
            aria-label="Ask a support question"
          />
          <button type="button" style={primaryBtn} onClick={() => askQuestion(prompt || "general help")}>
            <Icon name="send" size={16} />
            Ask
          </button>
          {readAloudAvailable ? (
            <button type="button" style={ghostBtn} onClick={readLatestAnswer}>
              <Icon name="volume_up" size={16} />
              Read aloud
            </button>
          ) : null}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Contact support"
        description="Choose the type of help you need, then send it into your support workspace so it can be tracked clearly."
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 14 }}>Support options</strong>
          <InfoTip
            label="Explain support options"
            message="Use these forms to report a problem, request a callback, send feedback, or email support. Saved requests stay in your support workspace for review."
          />
        </div>
        <div style={gridStyle}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Request type</span>
            <select value={requestType} onChange={(event) => setRequestType(event.target.value)} style={inputStyle}>
              <option value="problem">Report a problem</option>
              <option value="callback">Request a callback</option>
              <option value="feedback">Send feedback / suggestion</option>
              <option value="email">Contact support by email</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#374151" }}>Subject</span>
            <input
              value={requestTitle}
              onChange={(event) => setRequestTitle(event.target.value)}
              style={inputStyle}
              placeholder="Short summary"
            />
          </label>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#374151" }}>Message</span>
          <textarea
            value={requestBody}
            onChange={(event) => setRequestBody(event.target.value)}
            style={textAreaStyle}
            placeholder="Describe the problem, callback request, feedback, or support email here"
          />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={primaryBtn} disabled={saving} onClick={() => void submitSupportRequest()}>
            <Icon name="save" size={16} />
            {saving ? "Saving..." : "Save support request"}
          </button>
          <button type="button" style={ghostBtn} onClick={() => { setRequestTitle(""); setRequestBody(""); }}>
            <Icon name="restart_alt" size={16} />
            Clear
          </button>
        </div>
        <StatusNote message={status} />
      </SettingsCard>
    </SettingsPageShell>
  );
}

const chatPanelStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#f8fafc",
  padding: 14,
  display: "grid",
  gap: 10,
} as const;

const assistantMessageStyle = {
  justifySelf: "start",
  maxWidth: "80%",
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #dbe3eb",
  padding: "10px 12px",
  color: "#0f172a",
} as const;

const userMessageStyle = {
  justifySelf: "end",
  maxWidth: "80%",
  borderRadius: 14,
  background: "#111827",
  padding: "10px 12px",
  color: "#ffffff",
} as const;

const wizardNoteStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  padding: "7px 10px",
  fontSize: 13,
} as const;
