type SupabaseErrorLike = { message?: string } | null | undefined;

export function isMissingRelationError(error: SupabaseErrorLike, relationName: string) {
  const message = error?.message?.toLowerCase() ?? "";
  const relation = relationName.toLowerCase();
  if (!message.includes(relation)) return false;
  return (
    message.includes("does not exist")
    || message.includes("schema cache")
    || message.includes("could not find the table")
    || message.includes("relation")
  );
}

export function isMissingColumnError(error: SupabaseErrorLike, columnName: string) {
  const message = error?.message?.toLowerCase() ?? "";
  const column = columnName.toLowerCase();
  if (!message.includes(column)) return false;
  return message.includes("schema cache") || message.includes("column");
}

export function toSafeSupabaseMessage(error: SupabaseErrorLike, fallback: string) {
  if (!error?.message) return fallback;
  return error.message;
}
