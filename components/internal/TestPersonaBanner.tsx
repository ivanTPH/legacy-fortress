"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getTestPersona,
  isTestPersonaAccessEnabled,
  TEST_PERSONA_QUERY_PARAM,
  TEST_PERSONA_STORAGE_KEY,
  type TestPersona,
} from "../../lib/testPersonas";

export default function TestPersonaBanner() {
  const [persona, setPersona] = useState<TestPersona | null>(null);

  useEffect(() => {
    if (!isTestPersonaAccessEnabled()) return;

    function refreshPersona() {
      const urlPersona = getTestPersona(new URL(window.location.href).searchParams.get(TEST_PERSONA_QUERY_PARAM));
      if (urlPersona) {
        window.localStorage.setItem(TEST_PERSONA_STORAGE_KEY, urlPersona.id);
        setPersona(urlPersona);
        return;
      }

      setPersona(getTestPersona(window.localStorage.getItem(TEST_PERSONA_STORAGE_KEY)));
    }

    refreshPersona();
    window.addEventListener("storage", refreshPersona);
    window.addEventListener("lf-test-persona-change", refreshPersona);
    return () => {
      window.removeEventListener("storage", refreshPersona);
      window.removeEventListener("lf-test-persona-change", refreshPersona);
    };
  }, []);

  if (!persona) return null;

  function clearPersona() {
    window.localStorage.removeItem(TEST_PERSONA_STORAGE_KEY);
    window.dispatchEvent(new Event("lf-test-persona-change"));
    setPersona(null);
  }

  return (
    <aside className="lf-test-persona-banner" role="status" aria-live="polite">
      <div>
        <strong>Test persona mode</strong>
        <span>
          {persona.label} — mock role preview only. Real authentication and production permissions are unchanged.
        </span>
      </div>
      <div>
        <Link href="/internal/test-login">Switch role</Link>
        <button type="button" onClick={clearPersona}>
          Clear preview
        </button>
      </div>
    </aside>
  );
}
