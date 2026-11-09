// Translations: t('key', {vars}) with {name} placeholders and plural forms.
// A value may be a string or a plural object {one, two, other}; the form is
// picked with Intl.PluralRules from vars.n (missing forms fall back to other).
//
// Language: saved choice ('skysiege_lang') > Hebrew for players who already
// have progress (they have been playing in Hebrew) > browser language.
import he from './he.js';
import en from './en.js';
import {store} from '../util.js';

export const LANGS={he,en};
const KEY='skysiege_lang';
let lang='he';
const plurals={};
const listeners=[];

export const getLang=()=>lang;
export const isRTL=()=>lang==='he';
export const textDir=()=>(isRTL()?'rtl':'ltr');

export function detectLang(){
  const s=store.get(KEY);if(s==='he'||s==='en')return s;
  if(store.get('skysiege_prog'))return 'he';
  const list=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];
  return list.some(x=>/^(he|iw)\b/i.test(x))?'he':'en';
}

export function t(key,vars){
  let v=LANGS[lang][key];
  if(v===undefined)v=LANGS.he[key];
  if(v===undefined)return key;
  if(typeof v==='object'){
    const pr=plurals[lang]||(plurals[lang]=new Intl.PluralRules(lang));
    v=v[pr.select(vars&&vars.n!==undefined?vars.n:0)]??v.other;
  }
  return vars?v.replace(/\{(\w+)\}/g,(m,k)=>(k in vars?vars[k]:m)):v;
}

// Static texts in index.html: data-i18n (textContent) and data-i18n-title.
export function applyStatic(){
  const html=document.documentElement;
  html.lang=lang;html.dir=textDir();
  document.title=t('title');
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle);});
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{el.placeholder=t(el.dataset.i18nPh);});
}

export function setLang(l){
  if(!LANGS[l])return;
  lang=l;store.set(KEY,l);applyStatic();
  listeners.forEach(f=>f(l));
}
export const onLangChange=f=>listeners.push(f);
export function initLang(){lang=detectLang();applyStatic();}
