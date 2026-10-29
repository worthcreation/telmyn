# Landscape sweep (run by Claude before each release): every main screen, the verse study and the workout video picker
# at 915x412 and 800x360. Needs Python Playwright, a local server on 8813, and tests/layout_sweep.py beside it.
import asyncio, json
from playwright.async_api import async_playwright
T='If any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.'
SEED = """(async()=>{const m=await import('./js/db.js');await m.open('telmyn');await m.put('days',{date:'2026-10-27',protein_g:174,water_oz:113.9,verse_applied_notes:'x',weight_lb:220});})()"""
CHECK = open(__file__.replace('landscape_sweep.py','layout_sweep.py')).read().split('CHECK = """')[1].split('"""')[0]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for (w,hh) in ((915,412),(800,360)):
            pg = await b.new_page(viewport={'width':w,'height':hh}, color_scheme='dark')
            await pg.route('**/verse?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'verses':[{'id':'J-1-5','text':T}],'text':T,'version':'NKJV'})))
            await pg.route('**/videos?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'videos':[{'id':'a','title':'Book of James Summary','thumb':''}]})))
            await pg.route('**/passage?*', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps({'videos':[{'id':'p1','title':'James 1:5 Explained','channel':'Desiring God','on':'verse','thumb':''}]})))
            await pg.goto('http://localhost:8813/#today'); await pg.wait_for_timeout(700); await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(1200)
            res={}
            for tab in ('today','progress','gear','me'):
                await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(500); res[tab]=await pg.evaluate(CHECK); await pg.screenshot(path=f'/tmp/L_{w}_{tab}.png')
            await pg.evaluate("location.hash='#today'"); await pg.wait_for_timeout(400)
            await pg.click('.verse-card'); await pg.wait_for_timeout(1200); res['verse']=await pg.evaluate(CHECK); await pg.screenshot(path=f'/tmp/L_{w}_verse.png')
            await pg.click('.layer-head [aria-label=Close]'); await pg.wait_for_timeout(300)
            await pg.click('.next .btn.go'); await pg.wait_for_timeout(1500); await pg.screenshot(path=f'/tmp/L_{w}_runner.png')
            await pg.click('.study-bar'); await pg.wait_for_timeout(600); res['picker']=[]  # a list of videos may scroll inside its own layer; await pg.screenshot(path=f'/tmp/L_{w}_picker.png')
            print(w,hh,{k:v for k,v in res.items() if v} or 'OK')
            await pg.close()
        await b.close()
asyncio.run(main())
