import { accountSourceLabel, type AccountOrigin } from "@/lib/admin/accountOrigins";

/** Tags beside a customer account: how it was created, and Test for synthetic accounts. Same on laptop and phone. */
export default function AdminAccountTags({ origin, isTest }: { origin?: AccountOrigin | null; isTest?: boolean }) {
  const source = origin?.source ?? "direct";
  return (
    <span className="lf-admin-account-tags">
      <span className={`lf-admin-account-tag is-${source}`}>{accountSourceLabel(origin)}</span>
      {isTest ? <span className="lf-admin-account-tag is-test">Test</span> : null}
    </span>
  );
}
