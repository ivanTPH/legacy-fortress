"use client";

import Icon from "../../../../components/ui/Icon";
import type { ActionCentrePreviewItem } from "./ActionQueuePanel";

type ActionCentreEntryPromptProps = {
  item: ActionCentrePreviewItem;
  onAction: (actionKey: string) => void;
  onDismiss: () => void;
};

export default function ActionCentreEntryPrompt({ item, onAction, onDismiss }: ActionCentreEntryPromptProps) {
  return (
    <section className="lf-action-entry-prompt" aria-label="A small step for your Fortress" role="status">
      <div className="lf-action-entry-prompt-icon" aria-hidden="true"><Icon name="lightbulb" size={20} /></div>
      <div className="lf-action-entry-prompt-copy">
        <p className="lf-action-entry-prompt-eyebrow">A small step for your Fortress</p>
        <h2>{item.title}</h2>
        <p>{item.blockerLabel}</p>
      </div>
      <div className="lf-action-entry-prompt-actions">
        <button type="button" className="lf-action-entry-prompt-primary" onClick={() => onAction(item.actionKey)}>{item.title}</button>
        <button type="button" className="lf-action-entry-prompt-secondary" onClick={onDismiss}>Not now</button>
      </div>
    </section>
  );
}
