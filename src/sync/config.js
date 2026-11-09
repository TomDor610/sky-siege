// Firebase web config (Console -> Project settings -> Your apps -> SDK setup and configuration).
// These are public identifiers, not secrets: they ship to every browser anyway. Access is
// protected by firestore.rules and by restricting the API key to the game's domains.
// null = cloud save off (the game works exactly as before, local only).
export const firebaseConfig = {
  apiKey: 'AIzaSyD8EbIqYtG21GhAhOYLwvVuCUEaUlEL7Ms',
  authDomain: 'sky-siege-a4cf4.firebaseapp.com',
  projectId: 'sky-siege-a4cf4',
  databaseURL: 'https://sky-siege-a4cf4-default-rtdb.europe-west1.firebasedatabase.app',
  storageBucket: 'sky-siege-a4cf4.firebasestorage.app',
  messagingSenderId: '148673355155',
  appId: '1:148673355155:web:b258df55ed653d47d11c66',
  measurementId: 'G-7EEJV8P1F8',
};
