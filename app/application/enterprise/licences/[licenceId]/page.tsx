import { redirect } from "next/navigation";

export default async function EnterpriseLicenceDetailPage({ params }: { params: Promise<{ licenceId: string }> }) {
  const { licenceId } = await params;
  redirect(`/enterprise/licences/${encodeURIComponent(licenceId)}`);
}
