import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const page=await browser.newPage({viewport:{width:1380,height:1000}}),errors=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));
await mkdir('art/attack-library/inspection',{recursive:true});
await page.goto('http://127.0.0.1:4291/animation-library-preview.html');
await page.waitForFunction(()=>window.attackLibrary?.available);
await page.screenshot({path:'art/attack-library/inspection/desktop.png',fullPage:true});
for(const label of ['Sword + shield','Twin blades','Greatsword','Staff cast','Two-hand cast','Shield impact','Dodge','Buff','Hurt']){
 await page.getByRole('button',{name:label,exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('sequence-name').textContent!=='Loading studies…'&&window.attackLibrary?.available);
 // The selection can reuse an old sequence during asynchronous decoding;
 // wait for the visible class/weapon/action to agree with the published state.
 await page.waitForFunction(()=>window.attackLibrary?.resolved?.primary===document.getElementById('main').value&&window.attackLibrary?.resolved?.action===document.getElementById('action').value&&window.attackLibrary?.classId===document.querySelector('[data-class][aria-pressed=true]').dataset.class&&window.attackLibrary?.available);
 const disabled=await page.locator('#play').isDisabled();
 const observed={label,disabled,state:await page.evaluate(()=>window.attackLibrary)};
 for(const frame of [0,2,3,4]){await page.locator('#frame').fill(String(frame));await page.locator('#frame').dispatchEvent('input');await page.locator('#stage').screenshot({path:`art/attack-library/inspection/${label.toLowerCase().replaceAll(' ','-').replaceAll('+','and')}-${frame}.png`})}
 if(!disabled){for(const speed of ['1','0.25']){await page.locator('#speed').selectOption(speed);await page.locator('#play').click();await page.waitForFunction(()=>window.attackLibrary.frame===3,{},{timeout:10000});observed[`speed${speed}`]=await page.evaluate(()=>window.attackLibrary.frame);await page.locator('#play').click()}}
 evidence.push(observed);
}
await page.locator('#action').selectOption('dice');await page.waitForFunction(()=>!window.attackLibrary.available&&document.getElementById('notice').textContent.includes('still needs artwork'));
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'art/attack-library/inspection/phone.png',fullPage:true});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
await writeFile('art/attack-library/inspection/browser-evidence.json',JSON.stringify({errors,overflow,evidence},null,2));
await browser.close();if(errors.length||overflow)throw new Error(JSON.stringify({errors,overflow}));console.log(JSON.stringify({examples:evidence.length,errors,overflow,held:evidence.filter(e=>e.disabled).map(e=>e.label)}));
