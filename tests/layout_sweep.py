# Layout sweep (run by Claude before each release): every page and sheet at eight phone heights, 640 to 915 px.
# Fails on page scrolling, content under the tab bar, sideways clipping, or a clipped Today verse. Lists and reading
# panels that scroll inside themselves are exempt. Needs Python Playwright and a local server on 8813.
import asyncio, json, sys
from playwright.async_api import async_playwright
T='If any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.'
SEED = """(async()=>{const m=await import('./js/db.js');await m.open('telmyn');await m.put('days',{date:'2026-10-27',protein_g:174,water_oz:113.9,verse_applied_notes:'x',weight_lb:220});})()"""
CHECK = """(()=>{const out=[];const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
 const scope=document.querySelector('.layer:not(.closing) .layer-body')||document.querySelector('.view');
 if(scope.scrollHeight>scope.clientHeight+1) out.push('scrolls '+(scope.scrollHeight-scope.clientHeight)+'px');
 const tabs=document.querySelector('.tabs-bar');const tb=tabs&&!document.querySelector('.layer:not(.closing)')?tabs.getBoundingClientRect().top:innerHeight;
 for(const e of scope.querySelectorAll('*')){if(!vis(e)||e.closest('.vs-studypage, .vs-verse, .vs-vlist'))continue;const r=e.getBoundingClientRect();if(r.bottom>tb+1&&e.children.length===0&&e.textContent.trim()){out.push('under bar: '+e.textContent.trim().slice(0,20));break;}}
 for(const e of scope.querySelectorAll('*')){if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='visible'&&!['vs-lead-t','nf-text','go-name'].some(c=>e.classList.contains(c))&&e.tagName!=='SMALL'&&e.clientWidth>0){out.push('clips sideways: '+(e.className||e.tagName));break;}}
 return out})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for hh in (640,700,731,760,780,820,860,915):
            pg = await b.new_page(viewport={'width':412 if hh>640 else 360,'height':hh}, color_scheme='dark')
            await pg.route('**/verse?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'verses':[{'id':'J-1-5','text':T}],'text':T,'version':'NKJV'})))
            await pg.route('**/videos?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'videos':[{'id':'a','title':'Book of James Summary','thumb':''}]})))
            await pg.route('**/passage?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'videos':[]})))
            await pg.goto('http://localhost:8813/#today'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(1200)
            res={}
            for tab in ('today','progress','gear','me'):
                await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(500); res[tab]=await pg.evaluate(CHECK) + (['verse clamped'] if tab=='today' and await pg.locator('.vp-text.clamped').count() else [])
            await pg.evaluate("location.hash='#me'"); await pg.wait_for_timeout(300)
            await pg.click('text=Day log'); await pg.wait_for_timeout(500); res['day view']=await pg.evaluate(CHECK)
            await pg.click('text=Edit this day'); await pg.wait_for_timeout(400)
            for g in ('Day','Body','Fuel','Watch','Notes'):
                await pg.click(f'.log-form .tabs >> text={g}'); await pg.wait_for_timeout(150); res['log '+g]=await pg.evaluate(CHECK)
            await pg.click('.layer-head [aria-label=Close] >> nth=-1'); await pg.wait_for_timeout(300)
            await pg.click('.layer-head [aria-label=Close] >> nth=-1'); await pg.wait_for_timeout(300)
            await pg.evaluate("location.hash='#today'"); await pg.wait_for_timeout(400)
            await pg.click('.verse-card'); await pg.wait_for_timeout(1200); res['verse']=await pg.evaluate(CHECK)
            await pg.click('.layer-head [aria-label=Close]'); await pg.wait_for_timeout(300)
            await pg.click('.quick .chip:has-text("Fluid")'); await pg.wait_for_timeout(400); res['fluid']=await pg.evaluate(CHECK)
            await pg.click('.layer-head [aria-label=Close]'); await pg.wait_for_timeout(300)
            await pg.click('.next .btn.go'); await pg.wait_for_timeout(500); res['runner']=await pg.evaluate("(()=>{const m=document.querySelector('.runner');return m&&m.scrollHeight>m.clientHeight+1?['runner overflows']:[]})()")
            bad={k:v for k,v in res.items() if v}
            print(hh, 'OK' if not bad else bad)
            if hh==780:
                await pg.keyboard.press('Escape')
            await pg.close()
        await b.close()
asyncio.run(main())
