# Firebase – הגדרה ותחזוקה

תוכנית Spark (חינמית). שמירת ענן: `users/{uid}` ב-Firestore, התחברות אנונימית אוטומטית וקישור ל-Google.

## הגדרה ראשונית ב-Firebase Console
1. **פרויקט:** [console.firebase.google.com](https://console.firebase.google.com) ← Create a project (`sky-siege`). את Google Analytics אפשר לכבות.
2. **אפליקציית Web:** אייקון `</>` ← כינוי `sky-siege-web`, בלי Firebase Hosting ← Register. מעתיקים את `firebaseConfig` ל-`src/sync/config.js`.
3. **Authentication ← Get started ← Sign-in method:** מפעילים **Anonymous** ו-**Google** (עם Support email).
4. **Authentication ← Settings ← Authorized domains:** מוסיפים `tomdor610.github.io`. ‏`localhost` כבר קיים.
5. **Firestore Database ← Create database:** מיקום קרוב לישראל (`me-west1` אם קיים, אחרת `europe-west1`; **אי אפשר לשנות אחר כך**). ‏**Start in production mode**.
6. **Firestore ← Rules:** מדביקים את התוכן של `firestore.rules` מהריפו ← **Publish**. בכל שינוי בכללים מפרסמים שוב.
7. **(מומלץ) הגבלת המפתח:** ב-[Google Cloud Console ← Credentials](https://console.cloud.google.com/apis/credentials), ב-Browser key: ‏Application restrictions ← HTTP referrers: `https://tomdor610.github.io/*`, `http://localhost:*/*`.

## מה ציבורי ומה לא
`firebaseConfig` (apiKey, projectId וכו') הוא **ציבורי** ונשלח לכל דפדפן, ולכן מותר לשמור אותו בריפו. האבטחה באה מ-`firestore.rules` ומהגבלת המפתח. **לא** שומרים בריפו Service Account או מפתחות פרטיים.

## מגבלות שכדאי לזכור
- הכללים מגינים על כל שחקן מאחרים, אבל לא מונעים משחקן לערוך את השמירה **שלו**. אין שרת מאמת בתוכנית Spark (Cloud Functions דורש Blaze). לפני טבלת שיאים צריך לחשוב על זה.
- מכסות Spark: כ-50K קריאות ו-20K כתיבות ביום. כל סנכרון = קריאה אחת + כתיבה אחת לכל היותר, עם השהיה של 2 שניות אחרי שמירה.
- ב-artifact של claude.ai אין גישה לשרתים חיצוניים: המשחק עובד שם רק מקומית.
- שינוי במבנה השמירה (שדה חדש ב-`prog`) מחייב עדכון של `firestore.rules` (רשימת `hasOnly`) ושל `mergeProg` ב-`src/sync/merge.js`.

## אנליטיקה
- Firebase Analytics נטען ברקע, במצב בלי עוגיות (`gcs=G100`), ורק אם השחקן לא כיבה אותו בהגדרות. אירועים: `title_view` ו-`title_click` עם הפרמטר `target` (play, continue, mode_duel, mode_campaign, mode_ghost_soon, google, leaderboard, settings, lang, settings_*).
- **רואים אותם** ב-Console ← Analytics ← Events, עם השהיה של עד יום. בזמן אמת: Realtime, או DebugView אחרי פתיחת האתר עם תוסף Google Analytics Debugger.
- כדי לראות פילוח לפי `target` בדוחות, מגדירים אותו פעם אחת ב-Analytics ← Custom definitions כ-Custom dimension ברמת Event.
- אם הוגבל מפתח ה-API, הוא חייב לאפשר גם את Firebase Installations API ואת Firebase Management API.

## טבלת שיאים
- `leaderboard/{uid}`: ציבורי לקריאה, כל שחקן כותב רק את השורה שלו. הכללים בודקים סבירות (כינוי 2–16 תווים מותרים, דרגה 1–20, רמה 0–500, זמן 0 או 3–10,000 שניות, ציון שתואם לרמה ולזמן, עד 200 חברים) ומגבילים לכתיבה אחת ב-20 שניות. אין מחיקה: יציאה מהטבלה כותבת שורה בלי כינוי עם ציונים -1.
- המיון לפי שדה אחד (`score.easy` וכו'), כך שלא צריך אינדקסים מורכבים ב-Console.
- **סדר פרסום:** כשמשנים את `firestore.rules`, קודם מפרסמים את הכללים ב-Console ורק אחר כך דוחפים את הקוד. הכללים החדשים מקבלים גם את הגרסה הקודמת של המשחק, אבל הקוד החדש נדחה בכללים הישנים.

## בדיקות
- `npm test`: כולל `cloud.spec.js` מול backend מדומה ו-`unit/merge.spec.js`. לא נוגע בשרת האמיתי.
- `npm run test:rules`: ה-Security Rules מול Firebase Emulator (דורש Java 11+; ב-GitHub Actions רץ אוטומטית).
