export type PeopleMatchCandidate = { id: string; full_name: string; email?: string | null; phone?: string | null };

export function findPotentialPeopleMatches(people: PeopleMatchCandidate[], fullName: string, email: string) {
  const normalizedName = fullName.trim().toLocaleLowerCase();
  const normalizedEmail = email.trim().toLocaleLowerCase();
  return people.filter((person) =>
    (normalizedEmail.length > 0 && person.email?.trim().toLocaleLowerCase() === normalizedEmail)
    || (normalizedName.length >= 3 && person.full_name.trim().toLocaleLowerCase() === normalizedName),
  );
}
