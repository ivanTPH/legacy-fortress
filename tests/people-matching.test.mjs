import test from "node:test";
import assert from "node:assert/strict";
import { findPotentialPeopleMatches } from "../lib/contacts/peopleMatching.ts";

test("matching keeps similar people distinct and offers explicit existing-person choices", () => {
  const people = [
    { id: "bob-brother", full_name: "Bob Smith", email: "bob@example.test", phone: "+441111" },
    { id: "bob-neighbour", full_name: "Bob Smith", email: null, phone: "+442222" },
    { id: "jane", full_name: "Jane Doe", email: "jane@example.test" },
  ];
  assert.deepEqual(findPotentialPeopleMatches(people, " BOB SMITH ", "").map((person) => person.id), ["bob-brother", "bob-neighbour"]);
  assert.deepEqual(findPotentialPeopleMatches(people, "Different Name", " BOB@EXAMPLE.TEST ").map((person) => person.id), ["bob-brother"]);
  assert.deepEqual(findPotentialPeopleMatches(people, "Bo", ""), []);
});
