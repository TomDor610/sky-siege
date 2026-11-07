// Firebase web config (Console -> Project settings -> Your apps -> SDK setup and configuration).
// These are public identifiers, not secrets: they ship to every browser anyway. Access is
// protected by firestore.rules and by restricting the API key to the game's domains.
// null = cloud save off (the game works exactly as before, local only).
export const firebaseConfig = null;
