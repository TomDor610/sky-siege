// Mutable state shared between modules.
// ES module imports are read-only live bindings: every module sees the current
// value, but reassignment must go through the setters below.
export let G=null;
export let prog=null;
export let build=null;
export let fort=null;
export let gameMode='duel';
export let difficulty='medium';
export function setG(v){G=v;}
export function setProg(v){prog=v;}
export function setBuild(v){build=v;}
export function setFort(v){fort=v;}
export function setGameMode(v){gameMode=v;}
export function setDifficulty(v){difficulty=v;}
