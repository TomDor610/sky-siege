// Static game data and tuning constants.
export const STYLES={
  classic:{name:'קלאסי',tag:'מאוזן',cost:0,desc:'הדגם המקורי מהמחברת: מאוזן בכל תחום, בלי חולשות בולטות.',drag:1,mass:1,hp:1,stall:1,agi:1,bombs:0},
  falcon:{name:'בז',tag:'מהיר',cost:150,desc:'גוף חד וכנפיים משוכות: מהירות גבוהה ושיוט חלק, אבל פחות עמיד.',drag:.75,mass:.9,hp:.8,stall:1.08,agi:1.1,bombs:0},
  galleon:{name:'גליון',tag:'משוריין',cost:150,desc:'ספינת מלחמה מעופפת: עמידה מאוד וסוחבת 2 פצצות נוספות, אבל כבדה ואיטית.',drag:1.2,mass:1.25,hp:1.55,stall:1.05,agi:.8,bombs:2},
  bat:{name:'עטלף',tag:'זריז',cost:250,desc:'כנפי עור ענקיות: הכי זריז, כמעט לא נופל, אבל איטי בטיסה ישרה.',drag:1.15,mass:.95,hp:.9,stall:.68,agi:1.45,bombs:0},
  airship:{name:'ספינת אוויר',tag:'מבצר',cost:400,desc:'בלון אוויר חם: לא מזדקר כמעט אף פעם, הכי עמידה וסוחבת 3 פצצות נוספות, אבל הכי איטית.',drag:1.6,mass:1.1,hp:1.8,stall:.35,agi:.75,bombs:3}
};
export const PARTS={
  wings:{name:'כנפיים',desc:'עילוי וזריזות. יותר כנפיים = אפשר לטוס לאט בלי ליפול',cost:15,min:1,max:4},
  props:{name:'בורגי אוויר',desc:'דחף ומהירות מרבית (בורג האוויר של דה וינצ\'י)',cost:20,min:1,max:4},
  armor:{name:'לוחות שריון',desc:'כל לוח סופג עוד חיצים, אבל מכביד',cost:10,min:0,max:5},
  bombs:{name:'פצצות',desc:'כמות הפצצות בכל גיחה. כבדות!',cost:5,min:1,max:12},
  crossbows:{name:'קשתות חוזרות',desc:'יורות קדימה: משמידות הגנות ופוגעות במכונת היריב',cost:15,min:0,max:2,req:'crossbow'}
};
export const BOMBTYPE={stone:{name:'פצצת אבן',plural:'פצצות אבן',cost:5,w:1.5,dmg:30,radius:70},greek:{name:'אש יוונית',plural:'סירי אש יוונית',cost:8,w:2.2,dmg:22,radius:105,burn:7}};
export const UPG={
  frame:{name:'שלד מחוזק',base:60,eff:l=>`+${l*10}% עמידות, −${l*4}% משקל`},
  wings:{name:'כנפיים משופרות',base:60,eff:l=>`−${l*6}% מהירות הזדקרות, +${l*6}% זריזות`},
  props:{name:'בורגי אוויר משופרים',base:70,eff:l=>`+${l*8}% דחף ומהירות`},
  armor:{name:'שריון פלדה',base:50,eff:l=>`כל לוח שריון: ${25+l*6} עמידות`},
  weapons:{name:'אבק שריפה',base:70,eff:l=>`+${l*15}% נזק לכל הפצצות והחיצים`},
  workshop:{name:'סדנה גדולה',base:90,max:8,eff:l=>`+${l*10} נקודות בנייה`}
};
export const UPG_CASTLE={
  stone:{name:'אבן מחוזקת',base:60,eff:l=>`+${l*10}% חוזק לטירה שלך`},
  ballista:{name:'בליסטראות משופרות',base:60,eff:l=>`+${l*12}% נזק, ${l*6}% טעינה מהירה יותר`},
  archers:{name:'קשתים מאומנים',base:50,eff:l=>`+${l*10}% טווח, ${l*6}% מטחים תכופים יותר`},
  mangonel:{name:"מנג'ניק כבד",base:70,eff:l=>`+${l*15}% נזק ורדיוס פיצוץ`}
};
export const ALLUPG=Object.assign({},UPG,UPG_CASTLE);
export const RANKS=[[1,'שוליה'],[2,'חניך'],[4,'אומן'],[7,'מהנדס'],[10,'ממציא'],[15,'מאסטר המחברות']];
export const RANK_MAX=20;
export const UPG_MAX=5;
export const UNLOCKS={
  crossbow:{name:'קשת חוזרת 🏹',cost:120,desc:'חלק חדש: קשת שיורה קדימה. משמידה הגנות ופוגעת במכונת היריב.'},
  greek:{name:'אש יוונית 🔥',cost:200,desc:'סוג פצצה חדש: פיצוץ רחב שממשיך לשרוף את הטירה 3 שניות.'},
  slot5:{name:'עמדה חמישית 🏰',cost:250,desc:'עמדת הגנה נוספת על החומה האחורית של הטירה שלך (דו-קרב).'}
};
export const DEF={ballista:{name:'בליסטרה',plural:'בליסטראות',hp:2,cost:25,short:'טווח ארוך, חץ חזק'},archers:{name:'מגדל קשתים',plural:'מגדלי קשתים',hp:1,cost:20,short:'מטחים, טווח קצר'},mangonel:{name:"מנג'ניק",plural:"מנג'ניקים",hp:2,cost:35,short:'פגזים מתפוצצים'}};
export const DEF_ORDER=[null,'ballista','archers','mangonel'];
export const WALL_COST=15,WALL_MAX=3,DUEL_EXTRA=80,DUEL_TIME=150,DUEL_CASTLE_HP=200;
export const SLOT_NAMES=['מגדל קדמי','חומה','מצודה','מגדל אחורי','חומה אחורית'];
export const SLOT_COLS={L:[10,7,5,0,2],R:[0,3,5,10,8]};
export const DIFF={
  easy:{name:'קל',castleHP:120,fire:3.0,lead:0,spread:.15,ballistae:[5],mult:1,desc:'בליסטרה אחת, יורה לאט.'},
  medium:{name:'בינוני',castleHP:180,fire:1.7,lead:.6,spread:.07,ballistae:[5],mult:1.5,desc:'בליסטרה מדויקת וטירה חזקה יותר.'},
  hard:{name:'קשה',castleHP:240,fire:1.2,lead:1,spread:.03,ballistae:[5,0],mult:2.2,desc:'שתי בליסטראות שמכוונות לאן שאתה טס.'}
};
export const BOT={
  easy:{name:'קל',pool:150,alt:240,err:140,perPass:1,upg:0,ai:{lead:.3,spread:.12,fire:2.4},mult:1,desc:'טייס מתחיל: טס גבוה ומפספס הרבה.'},
  medium:{name:'בינוני',pool:180,alt:170,err:60,perPass:2,upg:1,ai:{lead:.6,spread:.07,fire:1.9},mult:1.5,desc:'טייס סביר עם טירה מוגנת היטב.'},
  hard:{name:'קשה',pool:210,alt:130,err:30,perPass:2,upg:2,ai:{lead:.9,spread:.04,fire:1.6},mult:2.2,desc:'טייס מדויק, מכונה משודרגת וטירה מבוצרת.'}
};
export const PLAYER_DEF_AI={lead:.7,spread:.06,fire:1.8};
export const LEVEL_ADDS=[null,null,'archers','ballista','mangonel','archers','ballista','mangonel'];
export const FREE_COLS=[0,10,1,9,2,8];
export const THRUST_K=4050,DRAG=0.09,STALL_K=36,G_ALONG=220,GRAV=330;
export const WORLD={width:4000,ground:1000,ceiling:60};
export const HOME={x0:170,x1:270,top:WORLD.ground-200};
export const COL=40,BASE_HEIGHTS=[5,5,3,3,7,7,7,3,3,5,5],CW=BASE_HEIGHTS.length*COL;
export const BOLT_SPEED=640,BOLT_G=140,BOMB_G=430,POT_G=300;
export const INK='#3b2a1a';
