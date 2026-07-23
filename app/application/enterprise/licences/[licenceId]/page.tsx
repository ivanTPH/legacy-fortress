import EnterpriseLicenceDetailWorkspace from "@/components/enterprise/EnterpriseLicenceDetailWorkspace";

export default async function EnterpriseLicenceDetailPage({ params }: { params: Promise<{ licenceId: string }> }) {
  const { licenceId } = await params;
  return <EnterpriseLicenceDetailWorkspace licenceId={licenceId} />;
}
