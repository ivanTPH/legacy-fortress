"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Icon from "../ui/Icon";

/**
 * Share a sign-up link (UX review 2, Partner growth): a QR code for posters and a ready-made email for
 * newsletters. The link only starts registration; it never gives access to anyone's Vault.
 */
export default function ShareSignupLink({ name, organisationName, path }: { name: string; organisationName: string; path: string }) {
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState<"" | "link" | "email">("");
  const url = typeof window !== "undefined" && path.startsWith("/") ? `${window.location.origin}${path}` : path;
  const email = `Subject: Your free Legacy Fortress Vault from ${organisationName}

${organisationName} has arranged Legacy Fortress Premium for you, at no cost.

Legacy Fortress is a secure place to keep the things your family would need one day: your Will, accounts, pensions, insurance and who to contact. You decide who can see what, and when.

Join here: ${url}

The link is for ${organisationName} members only. Your Vault is private: ${organisationName} never sees what you keep in it.`;
  useEffect(() => {
    let active = true;
    void QRCode.toString(url, { type: "svg", margin: 1, width: 168, errorCorrectionLevel: "M" }).then((value) => { if (active) setSvg(value); }).catch(() => null);
    return () => { active = false; };
  }, [url]);
  async function copy(kind: "link" | "email") {
    try { await navigator.clipboard.writeText(kind === "link" ? url : email); setCopied(kind); window.setTimeout(() => setCopied(""), 2500); } catch { /* the text is shown to select by hand */ }
  }
  function downloadQr() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href; a.download = `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "sign-up"}-qr.svg`; a.click();
    URL.revokeObjectURL(href);
  }
  return (
    <section className="lf-share-link" aria-label={`Share ${name}`}>
      <div className="lf-share-link-qr" aria-label="QR code for this sign-up link" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="lf-share-link-copy">
        <strong>{name}</strong>
        <code>{url}</code>
        <div className="lf-share-link-actions">
          <button type="button" onClick={() => void copy("link")}><Icon name="link" size={18} />{copied === "link" ? "Copied" : "Copy link"}</button>
          <button type="button" onClick={() => void copy("email")}><Icon name="mail" size={18} />{copied === "email" ? "Copied" : "Copy email"}</button>
          <button type="button" disabled={!svg} onClick={downloadQr}><Icon name="qr_code_2" size={18} />Download QR code</button>
        </div>
        <details><summary>See the email</summary><pre>{email}</pre></details>
      </div>
    </section>
  );
}
