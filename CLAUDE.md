# Sky Siege – דו-קרב הממציאים

משחק דפדפן לטלפון ולמחשב, בעברית (RTL). ימי ביניים בסגנון מחברות של דה וינצ'י: בונים מכונה מעופפת, מטיסים אותה בעצמך ומפילים טירות.

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
| `data.js` | כל הנתונים והקבועים: `STYLES`, `PARTS`, `BOMBTYPE`, `UPG`, `DEF`, `DIFF`, `BOT`, קבועי פיזיקה ועולם |
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
מפתחות: `skysiege_prog`, `skysiege_build2`, `skysiege_fort`, `skysiege_diff`, `skysiege_mode`.
**חובה לשמור תאימות לאחור.** שחקנים אמיתיים כבר משחקים. כל שדה חדש נכנס דרך `freshProg()` ו-`Object.assign` בזמן הטעינה, ואסור לאפס להם התקדמות.

### ממשק לבדיקות
`window.__sky` חושף `G`, `prog`, `input`, `press('bomb'|'flip')`, `step(n)`, `setMode`, `refresh`.
הבדיקות ב-`tests/` (Playwright):
- `helpers/autopilot.js`: טייס אוטומטי (`runBattle`) שמריץ קרב שלם ב-`step()` ומחזיר תוצאה. `Math.random` מקבל seed, והקרב רץ בקריאה סינכרונית אחת, כך שהתוצאה דטרמיניסטית.
- `autopilot.spec.js`: דו-קרב וקמפיין × 3 רמות × 3 seeds. בודק שאין שגיאות ושהקרב מסתיים, וגם השוואה מדויקת ל-`tests/baseline.json`.
- `screens.spec.js`: צילומי מסך בטלפון 844x390 ו-390x844, שנשמרים ל-`tests/screenshots/`.
- **`baseline.json`** נרשם מהגרסה המקורית (commit `a8bd6f9`). שינוי מכוון במשחקיות או באיזון ישבור את בדיקת ה-baseline, וזה צפוי. אחרי שמוודאים שהשינוי רצוי, מייצרים מחדש: `node tests/tools/make-baseline.mjs http://localhost:5173/` (כששרת הפיתוח רץ).

## כללי עבודה
- כל הטקסט למשתמש בעברית. ב-Canvas משתמשים ב-`ctx.direction='rtl'`.
- בלי `alert`, `confirm` או `prompt`. דיאלוגים נבנים בתוך הדף.
- יעד ביצועים: 60fps בטלפון בינוני. כל עדכון נבדק גם בתצוגת טלפון לרוחב (למשל 844x390) וגם לאורך (390x844).
- כל שינוי באיזון נבדק בקרבות אוטומטיים בשלוש רמות הקושי, בשני המצבים.
- לפני שינוי גדול: לשאול את בעל הפרויקט. הוא מעדיף לראות תוכנית קצרה ואז תוצאה שאפשר לשחק בה.
