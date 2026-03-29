"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type WizardFlow = {
  id: string;
  label: string;
  route: string;
  steps: string[];
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

const HELP_WIZARD_FLOWS: WizardFlow[] = [
  {
    id: "documents",
    label: "Add documents",
    route: "/legal",
    steps: [
      "Open the category where the document belongs.",
      "Create or open the record first so the attachment has the right parent context.",
      "Upload the supporting file in the shared documents area and confirm the preview.",
    ],
  },
  {
    id: "invites",
    label: "Invite people",
    route: "/contacts",
    steps: [
      "Open Contacts and select the person you want to manage.",
      "Choose the categories they can review and then refine exact record permissions where needed.",
      "Send the invite email and watch the queue for Sent, Pending, or Verified state.",
    ],
  },
  {
    id: "permissions",
    label: "Change permissions",
    route: "/contacts",
    steps: [
      "Open the selected contact in Contacts.",
      "Start with the category access that matches their role.",
      "Switch individual records from View to Edit only where that access is genuinely needed.",
    ],
  },
  {
    id: "vault",
    label: "Use My Vault",
    route: "/account/my-vault",
    steps: [
      "Open My Vault from your account settings.",
      "Hide any groups or subsections you do not want across the workspace.",
      "Save and confirm the dashboard, nav, and contact access views now match those choices.",
    ],
  },
];

export default function SupportWorkspace() {
  const router = useRouter();
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
  const [activeWizardId, setActiveWizardId] = useState("");
  const [activeWizardStep, setActiveWizardStep] = useState(0);

  const speechSupported = useMemo(
    () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    [],
  );
  const readAloudAvailable = useMemo(
    () => speechSupported && preferences.readAloudEnabled,
    [preferences.readAloudEnabled, speechSupported],
  );
  const activeWizard = useMemo(
    () => HELP_WIZARD_FLOWS.find((flow) => flow.id === activeWizardId) ?? null,
    [activeWizardId],
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

  function startWizard(flowId: string) {
    const flow = HELP_WIZARD_FLOWS.find((item) => item.id === flowId);
    if (!flow) return;
    setActiveWizardId(flow.id);
    setActiveWizardStep(0);
    setMessages((current) => [
      ...current,
      { role: "user", text: `Start help wizard: ${flow.label}` },
      { role: "assistant", text: `${flow.steps[0]} Use Next to continue or open the related page directly.` },
    ]);
  }

  function moveWizard(delta: 1 | -1) {
    if (!activeWizard) return;
    const nextStep = Math.min(Math.max(activeWizardStep + delta, 0), activeWizard.steps.length - 1);
    setActiveWizardStep(nextStep);
    setMessages((current) => [...current, { role: "assistant", text: activeWizard.steps[nextStep] }]);
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
            Guided help is enabled. Start a step-by-step help flow below whenever you want a clearer walkthrough.
          </div>
        ) : null}
        {preferences.helpWizardEnabled ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {HELP_WIZARD_FLOWS.map((flow) => (
                <button key={flow.id} type="button" style={ghostBtn} onClick={() => startWizard(flow.id)}>
                  <Icon name="tips_and_updates" size={16} />
                  {flow.label}
                </button>
              ))}
            </div>
            {activeWizard ? (
              <div style={wizardPanelStyle} className="lf-support-card">
                <div style={{ display: "grid", gap: 4 }}>
                  <strong>{activeWizard.label}</strong>
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    Step {activeWizardStep + 1} of {activeWizard.steps.length}
                  </span>
                  <span>{activeWizard.steps[activeWizardStep]}</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={ghostBtn} disabled={activeWizardStep === 0} onClick={() => moveWizard(-1)}>
                    <Icon name="arrow_back" size={16} />
                    Back
                  </button>
                  <button type="button" style={ghostBtn} disabled={activeWizardStep >= activeWizard.steps.length - 1} onClick={() => moveWizard(1)}>
                    <Icon name="arrow_forward" size={16} />
                    Next
                  </button>
                  <button type="button" style={primaryBtn} onClick={() => router.push(activeWizard.route)}>
                    <Icon name="open_in_new" size={16} />
                    Open related page
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div style={chatPanelStyle} className="lf-support-card">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} style={message.role === "assistant" ? assistantMessageStyle : userMessageStyle}>
              {message.text}
            </div>
          ))}
        </div>
        {preferences.helpWizardEnabled ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {HELP_TOPICS.map((topic) => (
              <button key={topic.id} type="button" style={ghostBtn} onClick={() => askQuestion(topic.id)}>
                {topic.label}
              </button>
            ))}
          </div>
        ) : null}
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
          {preferences.readAloudEnabled && !speechSupported ? (
            <div style={{ color: "#92400e", fontSize: 12 }}>
              Read aloud is unavailable in this browser, so the control stays hidden here.
            </div>
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

const wizardPanelStyle = {
  border: "1px solid #dbe3eb",
  borderRadius: 16,
  background: "#ffffff",
  padding: 14,
  display: "grid",
  gap: 12,
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
