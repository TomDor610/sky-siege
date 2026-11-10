// Static game data and tuning constants.
// User-facing names and descriptions live in src/i18n/ (e.g. t('style.falcon.name')).
export const STYLES={
  classic:{cost:0,drag:1,mass:1,hp:1,stall:1,agi:1,bombs:0},
  falcon:{cost:150,drag:.75,mass:.9,hp:.8,stall:1.08,agi:1.1,bombs:0},
  galleon:{cost:150,drag:1.2,mass:1.25,hp:1.55,stall:1.05,agi:.8,bombs:2},
  bat:{cost:250,drag:1.15,mass:.95,hp:.9,stall:.68,agi:1.45,bombs:0},
  airship:{cost:400,drag:1.6,mass:1.1,hp:1.8,stall:.35,agi:.75,bombs:3}
};
export const PARTS={
  wings:{cost:15,min:1,max:4},
  props:{cost:20,min:1,max:4},
  armor:{cost:10,min:0,max:5},
  bombs:{cost:5,min:1,max:12},
  crossbows:{cost:15,min:0,max:2,req:'crossbow'}
};
export const BOMBTYPE={stone:{cost:5,w:1.5,dmg:30,radius:70},greek:{cost:8,w:2.2,dmg:22,radius:105,burn:7}};
// eff(level) -> numbers shown in the upgrade text ({a}, {b} in upg.<key>.eff)
export const UPG={
  frame:{base:60,eff:l=>({a:l*10,b:l*4})},
  wings:{base:60,eff:l=>({a:l*6,b:l*6})},
  props:{base:70,eff:l=>({a:l*8})},
  armor:{base:50,eff:l=>({a:25+l*6})},
  weapons:{base:70,eff:l=>({a:l*15})},
  workshop:{base:90,max:8,eff:l=>({a:l*10})}
};
export const UPG_CASTLE={
  stone:{base:60,eff:l=>({a:l*10})},
  ballista:{base:60,eff:l=>({a:l*12,b:l*6})},
  archers:{base:50,eff:l=>({a:l*10,b:l*6})},
  mangonel:{base:70,eff:l=>({a:l*15})}
};
export const ALLUPG=Object.assign({},UPG,UPG_CASTLE);
export const RANKS=[[1,'apprentice'],[2,'journeyman'],[4,'craftsman'],[7,'engineer'],[10,'inventor'],[15,'master']];
export const RANK_MAX=20;
export const UPG_MAX=5;
export const UNLOCKS={
  crossbow:{cost:120},
  greek:{cost:200},
  slot5:{cost:250}
};
export const DEF={ballista:{hp:2,cost:25},archers:{hp:1,cost:20},mangonel:{hp:2,cost:35}};
export const DEF_ORDER=[null,'ballista','archers','mangonel'];
export const WALL_COST=15,WALL_MAX=3,DUEL_EXTRA=80,DUEL_TIME=150,DUEL_CASTLE_HP=200;
// 1v1: the same budget for both players (= a new player's duel budget); see database.rules.json
export const VS_POOL=180;
export const SLOT_COLS={L:[10,7,5,0,2],R:[0,3,5,10,8]};
export const DIFF={
  easy:{castleHP:120,fire:3.0,lead:0,spread:.15,ballistae:[5],mult:1},
  medium:{castleHP:180,fire:1.7,lead:.6,spread:.07,ballistae:[5],mult:1.5},
  hard:{castleHP:240,fire:1.2,lead:1,spread:.03,ballistae:[5,0],mult:2.2}
};
export const BOT={
  easy:{pool:150,alt:240,err:140,perPass:1,upg:0,ai:{lead:.3,spread:.12,fire:2.4},mult:1},
  medium:{pool:180,alt:170,err:60,perPass:2,upg:1,ai:{lead:.6,spread:.07,fire:1.9},mult:1.5},
  hard:{pool:210,alt:130,err:30,perPass:2,upg:2,ai:{lead:.9,spread:.04,fire:1.6},mult:2.2}
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
