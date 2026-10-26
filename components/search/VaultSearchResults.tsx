"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../ui/Icon";
import type { DashboardDiscoveryResult } from "../../lib/records/discovery";

const GROUPS = [
  { title: "Records", kinds: ["asset"] },
  { title: "Documents", kinds: ["document", "attachment"] },
  { title: "People", kinds: ["contact"] },
  { title: "To do", kinds: ["task"] },
  { title: "Pages", kinds: ["navigation"] },
] as const;

const PROMPTS = [
  { label: "Barclays", icon: "account_balance" },
  { label: "Will", icon: "history_edu" },
  { label: "Sarah Smith", icon: "person" },
  { label: "Invite", icon: "task_alt" },
] as const;

type VaultSearchResultsProps = {
  query: string;
  results: DashboardDiscoveryResult[];
  loading: boolean;
  canAddRecords: boolean;
  onSearch: (value: string) => void;
};

export default function VaultSearchResults(props: VaultSearchResultsProps) {
  return <VaultSearchContent key={props.query} {...props} />;
}

function VaultSearchContent({
  query,
  results,
  loading,
  canAddRecords,
  onSearch,
}: VaultSearchResultsProps) {
  const [draft, setDraft] = useState(query);

  return <section className="lf-v52-search-page" aria-label="Vault search results">
    <form className="lf-v52-search-mobile-field" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(draft); }}>
      <Icon name="search" size={20} />
      <input type="search" enterKeyHint="search" aria-label="Search your vault" placeholder="Search your vault" value={draft} onChange={(event) => setDraft(event.target.value)} />
      {draft ? <button type="button" aria-label="Clear search" onClick={() => { setDraft(""); onSearch(""); }}><Icon name="cancel" size={20} /></button> : null}
      <button type="submit" className="lf-v52-search-submit" aria-label="Submit Vault search">Search</button>
    </form>
    {!query ? <div className="lf-v52-search-intro">
      <h1>Try searching for</h1>
      <div className="lf-v52-search-prompts">{PROMPTS.map((prompt) => <button type="button" key={prompt.label} onClick={() => onSearch(prompt.label)}><Icon name={prompt.icon} size={18} />{prompt.label}</button>)}</div>
      <p>Searches record names, people, document titles and To do. Account numbers and values are never searched. Recent searches aren&apos;t saved.</p>
    </div> : loading ? <div className="lf-v52-search-intro" role="status">Searching your authorised Vault…</div> : results.length ? <div className="lf-v52-search-groups">
      {GROUPS.map((group) => {
        const entries = results.filter((result) => (group.kinds as readonly string[]).includes(result.kind));
        return entries.length ? <section key={group.title} aria-label={group.title}>
          <h2>{group.title}</h2>
          <div className="lf-v52-search-result-list">{entries.map((entry) => <Link key={entry.id} href={entry.href}>
            <span className="lf-v52-search-result-icon"><Icon name={entry.icon} size={20} /></span>
            <span><strong>{entry.label}</strong><small>{entry.description}</small></span>
            <Icon name="chevron_right" size={20} />
          </Link>)}</div>
        </section> : null;
      })}
    </div> : <div className="lf-v52-search-empty">
      <span className="lf-v52-search-empty-icon"><Icon name="search_off" size={28} /></span>
      <h1>Nothing matches “{query}”</h1>
      <p>Check the spelling, or add it to your Vault.</p>
      {canAddRecords ? <Link href="/add" className="lf-v52-search-add"><Icon name="add" size={20} />Add to my Vault</Link> : null}
      <button type="button" className="lf-v52-search-clear" onClick={() => onSearch("")}>Clear search</button>
    </div>}
  </section>;
}
