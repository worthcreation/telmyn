# Button sweep (run by Claude before each release): every button on every screen keeps at least 6 px between its text
# and its edges, at 360 and 412 px wide. Needs Python Playwright and a local server on 8813.
import asyncio, json
from playwright.async_api import async_playwright
T='If any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.'
# For every visible button: room between its text and its own edges (px). Under 6 px on a side counts as cramped.
MEASURE = """(()=>{const out=[];for(const b of document.querySelectorAll('button, .btn, .chip')){if(b.matches('.daylist button, .kw, .sw, .stat, .vs-start, .vs-order-w, .icon-btn, .tabs-bar button, label.btn, .j-entry, .vs-lead, .vs-video, .note-field, .pill, .wk'))continue;const r=b.getBoundingClientRect();if(!r.width||!r.height)continue;
 const range=document.createRange();range.selectNodeContents(b);const t=range.getBoundingClientRect();if(!t.width)continue;
 const l=t.left-r.left,rt=r.right-t.right,tp=t.top-r.top,bt=r.bottom-t.bottom;const m=Math.min(l,rt);
 if(m<6||b.scrollWidth>b.clientWidth+1)out.push(`${(b.textContent||'').trim().slice(0,18)}: ${Math.round(l)}/${Math.round(rt)} px`)}return [...new Set(out)]})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for (w,hh) in ((360,700),(412,780),(412,915)):
            pg = await b.new_page(viewport={'width':w,'height':hh}, color_scheme='dark')
            await pg.route('**/verse?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'verses':[{'id':'J-1-5','text':T}],'text':T,'version':'NKJV'})))
            await pg.route('**/videos?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'videos':[{'id':'a','title':'Book of James Summary','thumb':''}]})))
            await pg.route('**/passage?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'videos':[]})))
            await pg.goto('http://localhost:8813/#today'); await pg.wait_for_timeout(1200)
            res={}
            for tab in ('today','progress','gear','me'):
                await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(400); res[tab]=await pg.evaluate(MEASURE)
            await pg.click('text=Day log'); await pg.wait_for_timeout(400)
            for g in ('Day','Body','Fuel'):
                await pg.click(f'.log-form .tabs >> text={g}'); await pg.wait_for_timeout(150); res['log '+g]=await pg.evaluate(MEASURE)
            await pg.click('.layer-head [aria-label=Close]'); await pg.wait_for_timeout(300)
            await pg.evaluate("location.hash='#today'"); await pg.wait_for_timeout(300)
            await pg.click('.verse-card'); await pg.wait_for_timeout(1000); res['verse']=await pg.evaluate(MEASURE)
            await pg.click('.layer-head [aria-label=Close]'); await pg.wait_for_timeout(300)
            for chip in ('Fluid','Weight'):
                await pg.click(f'.quick .chip:has-text("{chip}")'); await pg.wait_for_timeout(400); res[chip]=await pg.evaluate(MEASURE); await pg.click('.layer-head [aria-label=Close]'); await pg.wait_for_timeout(300)
            await pg.click('.next .btn.go'); await pg.wait_for_timeout(500); res['runner']=await pg.evaluate(MEASURE)
            print(w,hh,{k:v for k,v in res.items() if v})
            await pg.close()
        await b.close()
asyncio.run(main())
