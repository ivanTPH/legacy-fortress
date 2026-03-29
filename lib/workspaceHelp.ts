export function getWorkspaceHelpMessage(sectionKey: string, categoryKey: string) {
  const section = sectionKey.trim().toLowerCase();
  const category = categoryKey.trim().toLowerCase();

  if (section === "finances" && category === "bank") {
    return "Add your banks and savings accounts here.";
  }
  if (section === "finances") {
    return "Add and review your financial records here.";
  }
  if (section === "legal") {
    return "Store legal records here and keep the right contacts linked to them.";
  }
  if (section === "property") {
    return "Keep property records, documents, and supporting notes together here.";
  }
  if (section === "business" || section === "employment") {
    return "Capture business and employment records here so responsibilities are clear.";
  }
  if (section === "personal") {
    return "Save personal records, possessions, and wishes here.";
  }
  if (section === "cars-transport") {
    return "Add vehicles, ownership details, and supporting transport documents here.";
  }
  return "";
}
