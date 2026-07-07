import { chromium } from 'playwright';
import path from 'node:path';
const BASE='http://localhost:3000';
const SHOT='C:/Users/capos/Documents/Personal/AI/MonZA/monza-Cars-marketplace/.frontend-check';
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERR: '+String(e).split('\n')[0]));
p.on('console',m=>{if(m.type()==='error')errs.push('CON: '+m.text().split('\n')[0]);});
await p.goto(BASE+'/cars/porsche',{waitUntil:'domcontentloaded',timeout:30000});
await p.waitForTimeout(2500);
const hrefs=await p.$$eval('a[href*="/cars/porsche/"]',els=>els.map(e=>e.getAttribute('href')).filter(h=>h&&!h.endsWith('/report')).slice(0,3));
console.log('sample detail hrefs:',JSON.stringify(hrefs));
if(hrefs.length){
  const url=BASE+hrefs[0];
  const r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await p.waitForTimeout(2500);
  console.log('detail status',r&&r.status(),'url',p.url(),'title',await p.title());
  console.log('detail bodyTextLen',(await p.evaluate(()=>document.body.innerText.length))||0);
  await p.screenshot({path:path.join(SHOT,'detail-direct.png')});
  const rep=await p.goto(url.replace(/\/$/,'')+'/report',{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
  await p.waitForTimeout(2000);
  console.log('report status',rep&&rep.status(),'url',p.url(),'len',(await p.evaluate(()=>document.body.innerText.length))||0);
  await p.screenshot({path:path.join(SHOT,'detail-report.png')});
}
console.log('JS errors:',errs.length?JSON.stringify(errs,null,2):'none');
await b.close();
