import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("people's photos: only their own photo, and only once they have accepted and linked their account", () => {
  const photos = read("lib/people/photos.ts");
  assert.match(photos, /\.eq\("owner_user_id", ownerUserId\)\.not\("linked_user_id", "is", null\)/);
  assert.match(photos, /createSignedUrl|getProfileAvatarPreview/);
  assert.doesNotMatch(photos, /avatar_path[^\n]*return \{ ok: true[^\n]*path\b[^\n]*photos/, "storage paths never sent to the browser");
  const route = read("app/api/people/photos/route.ts");
  assert.match(route, /getContactPhotos\(admin, requestUser\.user\.id\)/);
});

test("Google sign-in photo is copied in once, never replacing a chosen photo; Apple gives none", () => {
  const photos = read("lib/people/photos.ts");
  assert.match(photos, /if \(String\(currentAvatarPath \?\? ""\)\.trim\(\)\) return null;/);
  assert.match(photos, /if \(!providers\.has\("google"\)\) return null;/);
  assert.match(photos, /googleusercontent\\\.com/);
  assert.match(read("app/api/profile/identity-chip/route.ts"), /importGooglePhotoIfMissing\(admin, requestUser\.user, profile\?\.avatar_path\)/);
});

test("photo upload: own account, photos only, 5 MB limit", () => {
  const photos = read("lib/people/photos.ts");
  assert.match(photos, /MAX_PHOTO_BYTES = 5 \* 1024 \* 1024/);
  assert.match(photos, /PHOTO_TYPES = new Set\(\["image\/jpeg", "image\/png", "image\/webp", "image\/heic", "image\/heif"\]\)/);
  assert.match(read("app/api/profile/avatar/route.ts"), /saveOwnPhoto\(admin, requestUser\.user\.id,/);
});

test("social media: offer a selfie or a photo from the library when there is no profile photo", () => {
  const prompt = read("components/profile/AddPhotoPrompt.tsx");
  assert.match(prompt, /capture="user"/);
  assert.match(prompt, /Take a selfie/);
  assert.match(prompt, /Choose from photos/);
  assert.match(prompt, /Not now/);
  assert.match(prompt, /json && !json\.avatarUrl \? "ask" : "hidden"/);
  assert.match(read("components/records/UniversalRecordWorkspace.tsx"), /<AddPhotoPrompt show=\{viewer\.mode !== "linked" && \(isSocialMedia \|\| isCanonicalDigital\)/);
});

test("photos show on People and Vault access, initials otherwise", () => {
  assert.match(read("components/contacts/ContactsNetworkWorkspace.tsx"), /<PersonAvatar className="lf-contact-avatar lf-v3-person-avatar" name=\{contact\.full_name \|\| "LF"\} photoUrl=\{peoplePhotos\[contact\.id\]\} \/>/);
  const access = read("components/people-access/VaultAccessWorkspace.tsx");
  assert.match(access, /<Avatar name=\{row\.person\?\.name \?\? "\?"\} personId=\{row\.person\?\.id\} \/>/);
  assert.match(read("components/ui/PersonAvatar.tsx"), /onError=\{\(\) => setFailed\(true\)\}/);
});
