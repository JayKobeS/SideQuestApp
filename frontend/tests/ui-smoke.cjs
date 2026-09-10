// Browser smoke test with explicitly mocked API fixtures, never a production login.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve('.test-artifacts/web');
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve=>server.listen(8099,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},geolocation:{latitude:52.23,longitude:21.01},permissions:['geolocation'],reducedMotion:'no-preference'});
    await context.addInitScript(()=>localStorage.setItem('jwt_token','ui-test-fixture'));
    let requests=[];
    let quests=[1,2,3].map((id)=>({id,template_id:id,title:['Kolor dnia','Nieznany zakątek','Kwadrans na zewnątrz'][id-1],description:'Odkryj coś nowego w swojej okolicy.',category:'daily',status:'active',xp_reward:80,medal:null,expires_at:'2026-09-11T04:00:00Z',daily_key:'2026-09-10',lat:null,lon:null,country_code:null}));
    const medals=[{id:100,title:'Półmaraton',description:'Ukończ bieg na dystansie 21,0975 km.',category:'achievement',medal:'silver',xp_reward:3000,lat:null,lon:null}];
    await context.route('http://localhost:8000/**',async route=>{
      const url=new URL(route.request().url()); const method=route.request().method(); requests.push(method+' '+url.pathname);
      let data={};
      if(url.pathname==='/auth/me') data={username:'Kuba',level:3,xp:2400,role:'user',email:'test@example.org',quests};
      if(url.pathname==='/auth/location-country') data={country_code:'PL'};
      if(url.pathname==='/quests/board') data={quests,capacities:{world:4,country:5,local:3},daily_key:'2026-09-10',daily_reset_at:new Date(Date.now()+86400000).toISOString()};
      if(url.pathname==='/quests/achievements') data=medals;
      if(url.pathname==='/quests/explore') {
        const {category}=route.request().postDataJSON();
        data={id:quests.length+10,template_id:20,title:'Paryż: miejski spacer',description:'Poznaj miejsce i zapisz krótką relację z wizyty.',category,status:'active',xp_reward:600,medal:null,expires_at:'2027-03-10T12:00:00Z',daily_key:null,city:'Paryż',country_code:'FR',lat:48.8566,lon:2.3522};
        quests.push(data);
      }
      if(url.pathname.endsWith('/submit')) {const id=Number(url.pathname.split('/')[2]);quests=quests.map(q=>q.id===id?{...q,status:'pending_review'}:q);data=quests.find(q=>q.id===id);}
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
    });
    const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8099/');
    await page.getByText('ROLL',{exact:true}).waitFor();
    await page.getByText('Przygotowuję mapę…',{exact:true}).waitFor({state:'hidden',timeout:25000});
    await page.locator('.sq-user-location').waitFor({timeout:15000});
    await page.screenshot({path:'.test-artifacts/home-mobile.png'});
    await page.getByText('ROLL',{exact:true}).click();
    await page.waitForTimeout(1000);
    assert.equal(await page.getByText('WYLOSOWANO',{exact:true}).count(),0,'roll animation should spin before revealing the result');
    await page.getByText('WYLOSOWANO',{exact:true}).waitFor({timeout:15000});
    await page.locator('.sq-user-location').waitFor();
    await page.screenshot({path:'.test-artifacts/rolled-mobile.png'});
    await page.getByLabel('Wróć do globu').click();
    await page.locator('.sq-user-location').waitFor();
    await page.getByLabel('Moje zadania').click();
    await page.getByText('Dzienne',{exact:true}).click();
    await page.getByText('Dzisiejsze',{exact:false}).waitFor();
    await page.getByText('Kolor dnia',{exact:true}).click();
    await page.getByLabel('Opis wykonania zadania').fill('Wykonano podczas spaceru.');
    await page.getByText('Zgłoś wykonanie',{exact:false}).click();
    await page.getByText('Kolor dnia',{exact:true}).waitFor({state:'hidden'});
    assert(requests.includes('POST /quests/1/submit'));
    await page.getByLabel('Osiągnięcia').click();
    await page.getByText('✦ Osiągnięcia',{exact:true}).waitFor();
    await page.screenshot({path:'.test-artifacts/medals-mobile.png'});
    await page.getByLabel('Zamknij listę').click();
    await page.getByRole('tab',{name:'Kraj'}).click();
    await page.getByText('ROLL',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Miasto'}).click();
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:'.test-artifacts/home-desktop.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: minimalist map, single roll, avatar, daily submission, medals, scopes, desktop');
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1});


