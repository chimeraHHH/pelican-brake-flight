import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=require('playwright-core');
const out=process.env.PELICAN_QA_OUTPUT||'/tmp/pelican-flight-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});const reports=[];
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.clock.install({time:new Date('2026-10-10T00:00:00Z')});await page.goto('http://localhost:4173/?q=low&freeze=1&dt=.05',{waitUntil:'load'});await page.waitForFunction(()=>!!window.__pelican);await page.clock.pauseAt(new Date('2026-10-10T00:01:00Z'));await page.click('#startMute');await page.locator('#intro').waitFor({state:'hidden'});await page.clock.runFor(400);
  await page.screenshot({path:out+`/mobile-ride-${viewport.width}.png`});
  const session=await context.newCDPSession(page),brakeBox=await page.locator('[data-key="down"]').boundingBox(),leftBox=await page.locator('[data-key="left"]').boundingBox();
  const point=(b,id)=>({x:b.x+b.width/2,y:b.y+b.height/2,id});
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(brakeBox,1),point(leftBox,2)]});await page.clock.runFor(300);const brake=await page.evaluate(()=>window.__pelican.challenge.brakeTime);assert.ok(brake>.5);assert.ok(await page.locator('[data-key="down"]').evaluate(b=>b.classList.contains('on')));
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(50);assert.equal(await page.locator('.tbtn.on').count(),0);const releasedBrake=await page.evaluate(()=>window.__pelican.challenge.brakeTime);assert.ok(releasedBrake>=brake&&releasedBrake-brake<=.051);await page.clock.runFor(250);assert.equal(await page.evaluate(()=>window.__pelican.challenge.brakeTime),releasedBrake);
  // Near-threshold fixture exercises the same touch button, launch and flight controls.
  await page.evaluate(()=>{window.__pelican.challenge.brakeTime=5.8;window.__pelican.S.speed=12;});
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(brakeBox,1)]});await page.clock.runFor(100);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__pelican.challenge.phase),'flight');
  await page.clock.runFor(250);await page.click('#flapButton');await page.clock.runFor(150);assert.equal(await page.evaluate(()=>window.__pelican.challenge.flight.flaps),1);await page.screenshot({path:out+`/mobile-flight-${viewport.width}.png`});
  await page.clock.runFor(4500);assert.ok(await page.locator('#flightResult').isVisible());await page.screenshot({path:out+`/mobile-result-${viewport.width}.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const button=await page.locator('#rideAgain').boundingBox();assert.ok(button.x>=0&&button.x+button.width<=viewport.width&&button.y>=0&&button.y+button.height<=viewport.height);await page.click('#rideAgain');assert.equal(await page.evaluate(()=>window.__pelican.challenge.brakeTime),0);assert.deepEqual(errors,[]);
  reports.push({viewport,multitouchBrake:true,releaseRetainsTime:true,touchLaunch:true,touchFlap:true,landing:true,restartVisible:true,overflow:false,errors});await context.close();
}
await writeFile(out+'/mobile-report.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));await browser.close();
