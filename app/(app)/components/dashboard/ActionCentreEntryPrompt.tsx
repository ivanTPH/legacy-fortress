"use client";

import Icon from "../../../../components/ui/Icon";
import type { ActionCentrePreviewItem } from "./ActionQueuePanel";
import type { VaultApplicabilityState } from "../../../../lib/vaultPreferences";

type ActionCentreEntryPromptProps = {
  item: ActionCentrePreviewItem;
  onAction: (actionKey: string, href: string) => void;
  onGuidanceApplicability?: (state: Extract<VaultApplicabilityState, "yes" | "no" | "unsure">) => void;
  onDismiss: () => void;
};

export default function ActionCentreEntryPrompt({ item, onAction, onDismiss, onGuidanceApplicability }: ActionCentreEntryPromptProps) {
  const asksAboutWill = item.guidanceKey === "will" && item.guidanceState === "unknown" && onGuidanceApplicability;
  return (
    <section className="lf-action-entry-prompt" aria-label="A small step for your Fortress" role="status">
      <div className="lf-action-entry-prompt-icon" aria-hidden="true"><Icon name="lightbulb" size={20} /></div>
      <div className="lf-action-entry-prompt-copy">
        <p className="lf-action-entry-prompt-eyebrow">A small step for your Fortress</p>
        <h2>{item.title}</h2>
        <p>{item.blockerLabel}</p>
      </div>
      <div className="lf-action-entry-prompt-actions">
        {asksAboutWill ? (
          <>
            <button type="button" className="lf-action-entry-prompt-primary" onClick={() => onGuidanceApplicability("yes")}>Yes, I have a Will</button>
            <button type="button" className="lf-action-entry-prompt-secondary" onClick={() => onGuidanceApplicability("no")}>No, I don&apos;t have one</button>
            <button type="button" className="lf-action-entry-prompt-secondary" onClick={() => onGuidanceApplicability("unsure")}>I&apos;m not sure</button>
          </>
        ) : (
          <button type="button" className="lf-action-entry-prompt-primary" onClick={() => onAction(item.actionKey, item.href)}>{item.title}</button>
        )}
        <button type="button" className="lf-action-entry-prompt-secondary" onClick={onDismiss}>Remind me later</button>
      </div>
    </section>
  );
}
