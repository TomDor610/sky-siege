# Sky Siege – דו-קרב הממציאים

משחק דפדפן לטלפון ולמחשב, בעברית (RTL) ובאנגלית (LTR). ימי ביניים בסגנון מחברות של דה וינצ'י: בונים מכונה מעופפת, מטיסים אותה בעצמך ומפילים טירות.

## עמודי התווך של העיצוב (לא לשבור)
1. **בנה ואז תטיס.** כל סיבוב בנוי משלב תכנון (חלקים, סגנון, הגנות) ומשלב ביצוע (הטסה ידנית).
2. **הדילמה של התקציב המשותף.** בדו-קרב, אותן נקודות בנייה מתחלקות בין המכונה לבין הגנות הטירה.
3. **קל להתחיל, קשה לשלוט.** רמת קושי לבחירה, קרבות קצרים (2:30 בדו-קרב), התקדמות ארוכת טווח.
4. **מבט צד, דו-ממדי.** שליטה במגע חייבת להישאר פשוטה: ▲ ▼ ⟲ 💣 🏹.
5. **סגנון אחד לכל המשחק:** נייר ישן, קווי דיו מצוירים ביד, צבעי מים, גיר אדום, כתב ראי באיטלקית ברקע.

## מצב נוכחי
- פרויקט Vite (JavaScript נקי, בלי framework), Canvas 2D, בלי תלויות ריצה (חוץ מגופן Frank Ruhl Libre מ-Google Fonts). Git מאותחל.
- `npm run build` מייצר את `dist/index.html`: קובץ יחיד ועצמאי (vite-plugin-singlefile), JS ו-CSS בפנים.
- מפורסם כרגע כ-artifact ציבורי ב-claude.ai (דורש HTML יחיד ועצמאי, בלי fetch לשרתים חיצוניים). מפרסמים את `dist/index.html`.

### פקודות
- `npm run dev`: שרת פיתוח בכתובת http://localhost:5173
- `npm run build`: בנייה ל-`dist/index.html`
- `npm test`: כל בדיקות Playwright, גם מול שרת הפיתוח וגם מול הקובץ הבנוי
- פרסום: `.github/workflows/deploy.yml` מריץ את הבדיקות בכל push ל-main, ורק אם הן עוברות מפרסם את `dist` ל-GitHub Pages. בדיקה שנכשלת = אין פרסום.
- (ב-Windows, אם `node` לא נמצא ב-Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`)

### מבנה הקוד (`src/`)
| קובץ | תוכן |
|---|---|
| `i18n/` | ‏`he.js`, `en.js` ו-`index.js` עם `t('key',{vars})`: משתנים `{name}` ורבים (`{one,two,other}` לפי `Intl.PluralRules`, לפי `vars.n`). `applyStatic()` מתרגם `data-i18n`/`data-i18n-title` ב-HTML ומחליף `dir`/`lang`. `textDir()` ל-`ctx.direction` |
| `data.js` | כל הנתונים והקבועים (מספרים בלבד; השמות והתיאורים ב-`i18n/`): `STYLES`, `PARTS`, `BOMBTYPE`, `UPG`, `DEF`, `DIFF`, `BOT`, קבועי פיזיקה ועולם |
| `state.js` | מצב משותף שמשתנה: `G`, `prog`, `build`, `fort`, `gameMode`, `difficulty`. **הצבה רק דרך `setX()`** (ייבוא ב-ES modules הוא לקריאה בלבד) |
| `progress.js` | ‏`freshProg`, ‏`loadSaved` (טעינה מ-localStorage), שמירה, `budget`, `sanitize`, דרגות |
| `physics.js` | ‏`stats`, `updatePlane`, יצירת מכונות, פגיעות, `explode` |
| `castle.js` | ‏`castleSpec`, `makeCastle`, `updateDefenses`, `damageCastle` |
| `bot.js` | ‏`botLoadout`, `botThink` |
| `game.js` | ‏`newGame` ו-`update` (צעד סימולציה: קליעים, תוצאה, מצלמה) |
| `effects.js` | ‏`spark`, `floater` |
| `input.js` | מקלדת ומגע, `input`, `pressed`, `isTouch` |
| `view.js` | ה-canvas הראשי, `scale/viewW/viewH`, `resize` |
| `draw/` | ‏`sketch` (קווי דיו), `paper`, `world` (שמיים, קרקע, מגדל בית), `machine`, `castle`, `render` |
| `ui/build.js`, `ui/hud.js` | מסך הסדנה וה-HUD |
| `ui/tutorial.js` | הדרכת הקרב הראשון: בועות לפי פעולות השחקן (טיפוס, ירידה, סיבוב, פצצה, חימוש) וכפתור דילוג. קוראת את מצב המשחק בלבד ולא משתמשת ב-`Math.random` |
| `sound.js` | צלילים ב-Web Audio בלי קבצים: `sfx(name,{x,...})` לאפקטים (עוצמה ו-pan לפי מרחק מהמצלמה, הגבלת קצב וקולות), מוזיקת לאוטה בסולם דורי (`setMusicMode`). **אסור לו לגעת במצב המשחק או ב-`Math.random`** (יש לו PRNG משלו) |
| `ui/sound-ui.js` | כפתור 🔊/🔇 בקרב (וגם מקש M) ומתגי אפקטים/מוזיקה בסדנה |
| `sync/` | שמירה בענן, offline-first. `index.js`: התחברות (אנונימית/Google), בכל סנכרון קריאה, `mergeSave`, החלה מקומית וכתיבה בחזרה ל-`users/{uid}`; ניסיון חוזר כשהרשת חוזרת; מיזוג מוחל רק מחוץ לקרב. `merge.js`: כללי המיזוג (פונקציות טהורות). `firebase.js`: ה-backend האמיתי (Auth + `firestore/lite`), נטען רק כשיש config. `config.js`: ה-firebaseConfig (`null` = כבוי) |
| `leaderboard/` | טבלת שיאים. `rows.js` (טהור): בניית השורה מההתקדמות (`buildRow`), ציון מיון בשדה אחד (`campaignScore`), בדיקת כינוי, קוד חבר (`codeOf` = 8 תווים ראשונים של ה-uid). `index.js`: פרסום השורה אחרי כל סנכרון מוצלח (רק כשהשתנתה, לכל היותר פעם ב-25 שניות), טעינת חברים/כולם עם מטמון של דקה, הוספת חבר, קישור הזמנה `?friend=CODE` |
| `ui/leaderboard-ui.js` | מסך "🏆 שיאים": לשוניות חברים/כולם, בורר קמפיין קל/בינוני/קשה/דו-קרב, כינוי, קוד חבר והזמנה |
| `ui/title.js`, `draw/title-scene.js` | מסך הפתיחה (המסך הראשון, `mode='title'`): "שחק" נכנס ישר לקרב (שחקן חדש: קמפיין קל והדרכה, אלא אם בחר מצב; שחקן חוזר: הבחירה האחרונה), "המשך" פותח את הסדנה, כרטיסי מצב, שורת חשבון, הגדרות. הרקע החי משתמש בפונקציות הציור של המשחק, בלי סימולציה |
| `analytics.js`, `sync/analytics-firebase.js` | `track(name,params)`: אירועי מסך הפתיחה ל-Firebase Analytics, נטען ברקע, במצב בלי עוגיות (`analytics_storage: denied`). כיבוי בהגדרות נשמר ב-`skysiege_analytics` |
| `ui/cloud-ui.js` | שורת מצב הענן וכפתור Google/התנתק בסדנה |
| `flow.js` | ‏`start`, `pause`, `finish` (מסך תוצאה ומטבעות), `loop` |
| `main.js` | אתחול לפי סדר קבוע ו-`window.__sky` |
| `style.css` | כל ה-CSS |

### מצבי משחק
- **דו-קרב מול בוט (`gameMode='duel'`):** שתי טירות (שחקן משמאל, side `'L'`; בוט מימין, side `'R'`), שתי מכונות, תחייה אחרי 4 שניות, מגבלת זמן `DUEL_TIME=150`. ניצחון כשטירת היריב נופלת, או לפי אחוז חוזק בסוף הזמן.
- **קמפיין מצור (`gameMode='campaign'`):** מכונה אחת מול טירה שמתחזקת בכל ניצחון (`castleSpec`): גובה, חוזק, והגנות חדשות לפי `LEVEL_ADDS`.

### מערכות עיקריות (שמות בקוד)
- **פיזיקת טיסה:** `updatePlane`. זווית `p`, כיוון `facing` (±1), מהירות `s`, הזדקרות לפי `vstall`, חצי לופ (`flip`) לסיבוב לאחור. הקבועים: `THRUST_K, DRAG, STALL_K, G_ALONG, GRAV`.
- **בניית מכונה:** `PARTS`, `STYLES` (קלאסי, בז, גליון, עטלף, ספינת אוויר), `BOMBTYPE` (אבן, אש יוונית), `stats(build, upg)`.
- **טירות והגנות:** `makeCastle`, `DEF` (בליסטרה, מגדל קשתים, מנג'ניק), `updateDefenses`, משבצות `SLOT_COLS` (5 עמדות, החמישית נפתחת ב-`unl.slot5`), חומות `fort.walls`.
- **בוט:** `botLoadout` מגריל מכונה והגנות בתוך תקציב, ו-`botThink` מטיס: גובה, סיבובים, חיזוי נפילת פצצה, חימוש.
- **התקדמות:** מטבעות, `UPG` (שדרוגי מכונה), `UPG_CASTLE` (שדרוגי טירה), `UNLOCKS`, דרגת ממציא לפי XP (`rankOf`, `xpFor`), נקודות בנייה = `budget()`.
- **ציור:** `drawMachine`, `drawCastle`, `drawSky`, `drawGround`, `paperOverlay` (מרקם נייר ב-multiply ו-vignette), ופונקציות קו "ביד": `sk`, `skRect`, `hsh`.

### שמירה (localStorage)
מפתחות: `skysiege_prog`, `skysiege_build2`, `skysiege_fort`, `skysiege_diff`, `skysiege_mode`, `skysiege_tutorial` (`done`/`skipped`; ההדרכה מופיעה רק לשחקן בלי XP ובלי ניצחונות, ורק עד שהמפתח קיים), `skysiege_sound` (`{muted,sfx,music}`, ברירת מחדל: הכול פועל), `skysiege_sync` (`{buildAt,dirty}`, רישום מקומי של הסנכרון), `skysiege_lb` (השורה האחרונה שפורסמה) ו-`skysiege_lbcache_*` (תוצאות אחרונות להצגה בלי רשת), `skysiege_analytics` (`0` = כבוי), `skysiege_lang` (`he`/`en`; אם לא נבחר: עברית למי שיש לו `skysiege_prog`, אחרת לפי שפת הדפדפן).
**מטבעות:** כל שינוי עובר דרך `earnCoins(n)`/`spendCoins(n)`, שמעדכנים גם את `coinsEarned`/`coinsSpent` (רק עולים; `coins = earned − spent`). `epoch` עולה ב"איפוס התקדמות". `nick` (כינוי בטבלה, ריק = לא בטבלה) ו-`friends` (uid-ים) נשמרים ב-`prog` ומתמזגים בענן (כינוי לא הולך לאיבוד, חברים באיחוד). כך מיזוג "תמיד הגבוה" לא מחזיר כסף על קניות ואיפוס לא נדרס.
**חובה לשמור תאימות לאחור.** שחקנים אמיתיים כבר משחקים. כל שדה חדש נכנס דרך `freshProg()` ו-`Object.assign` בזמן הטעינה, ואסור לאפס להם התקדמות.

### ממשק לבדיקות
`window.__sky` חושף `G`, `prog`, `input`, `press('bomb'|'flip')`, `step(n)`, `setMode`, `refresh`, `tutorial()` (מצב ההדרכה), `sound()` (מצב השמע: `state`, `settings`, `music`, `played`), `lang()` (השפה הנוכחית), `cloud()` (מצב השמירה בענן: `status`, `uid`, `isAnonymous`).
הבדיקות ב-`tests/` (Playwright):
- `helpers/autopilot.js`: טייס אוטומטי (`runBattle`) שמריץ קרב שלם ב-`step()` ומחזיר תוצאה. `Math.random` מקבל seed, והקרב רץ בקריאה סינכרונית אחת, כך שהתוצאה דטרמיניסטית.
- `autopilot.spec.js`: דו-קרב וקמפיין × 3 רמות × 3 seeds. בודק שאין שגיאות ושהקרב מסתיים, וגם השוואה מדויקת ל-`tests/baseline.json`.
- `tutorial.spec.js`: ההדרכה לא משנה את תוצאות הטייס האוטומטי (מושווה ל-baseline), מגיבה לפעולות, נשמרת, הדילוג עובד, ושחקנים ותיקים לא רואים אותה.
- `sound.spec.js`: עם שמע פעיל הטייס האוטומטי עדיין זהה ל-baseline, המוזיקה עוברת בין המסכים, וההשתקה והמתגים נשמרים.
- `i18n.spec.js`: אותם מפתחות ואותם משתנים בשתי השפות, כל מפתח בשימוש וכל שימוש קיים; קרבות באנגלית זהים ל-baseline ובלי אף אות עברית (מסכים, הודעות צפות, טקסט שיתוף); בחירת שפה ושמירתה.
- `cloud.spec.js`: שמירה בענן מול backend מדומה (`helpers/fake-cloud.js`): העלאה ראשונה בלי איבוד, מיזוג עם ענן קיים, עבודה בלי רשת והעלאה כשחוזרת, Google, מיזוג שמגיע באמצע קרב. `unit/merge.spec.js`: כללי המיזוג (כולל בדיקת תכונות על 500 מקרים).
- `leaderboard.spec.js`: מסך השיאים מול ה-backend המדומה (כינוי, כולם, דו-קרב, חברים לפי קוד ומי שהוסיף אותי, קישור הזמנה, יציאה מהטבלה, בלי רשת, אנגלית). `unit/leaderboard.spec.js`: השורה, הציונים והכינוי.
- `rules/firestore.rules.spec.js`: ה-Security Rules מול Firebase Emulator. מריצים `npm run test:rules` (דורש Java; ב-CI רץ אוטומטית).
- `title.spec.js`: מסך הפתיחה כמו שחקן אמיתי: שחק/המשך, מצבים, חשבון, הגדרות, אנליטיקה, טעינה כש-Firebase תקוע, ובטלפון לרוחב ולאורך בשתי השפות שהכול נכנס בלי גלילה וחפיפות. שאר הבדיקות מדלגות על המסך: `openGame(page)` מגדיר `window.__skySkipTitle`; `openGame(page,{title:true})` מתחיל ממנו.
- `screens.spec.js`: צילומי מסך בטלפון 844x390 ו-390x844, בעברית ובאנגלית, שנשמרים ל-`tests/screenshots/`. בודק גם שכפתורי ה-HUD לא מסתירים צגים.
- **`baseline.json`** נרשם מהגרסה המקורית (commit `a8bd6f9`). שינוי מכוון במשחקיות או באיזון ישבור את בדיקת ה-baseline, וזה צפוי. אחרי שמוודאים שהשינוי רצוי, מייצרים מחדש: `node tests/tools/make-baseline.mjs http://localhost:5173/` (כששרת הפיתוח רץ).

## כללי עבודה
- **כל טקסט שמוצג למשתמש עובר דרך `t()`** ונכנס לשני הקבצים, `he.js` ו-`en.js` (הבדיקות נכשלות אם מפתח חסר באחד מהם). באנגלית מתרגמים טבעי ומשחקי, לא מילולי. ב-Canvas: `ctx.direction=textDir()`. ההערות באיטלקית ברקע (`NOTE_TXT`) לא מתורגמות.
- **עולם המשחק לא מתהפך עם השפה:** השחקן תמיד משמאל והיריב מימין; כפתורי המגע וציור הטירה בסדנה נשארים במקומם. רק סדר הקריאה (HUD, מסכים) מתהפך, ב-CSS דרך `html[dir=ltr]`.
- בלי `alert`, `confirm` או `prompt`. דיאלוגים נבנים בתוך הדף.
- יעד ביצועים: 60fps בטלפון בינוני. כל עדכון נבדק גם בתצוגת טלפון לרוחב (למשל 844x390) וגם לאורך (390x844).
- כל שינוי באיזון נבדק בקרבות אוטומטיים בשלוש רמות הקושי, בשני המצבים.
- לפני שינוי גדול: לשאול את בעל הפרויקט. הוא מעדיף לראות תוכנית קצרה ואז תוצאה שאפשר לשחק בה.
