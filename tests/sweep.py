# Sweeps (run before each release): one browser, every viewport at once.
#   python3 tests/sweep.py          (starts its own web server; needs Python Playwright)
# Layout: every page and sheet at seven phone heights (700 to 915 px; a clamped verse with "tap to read all" is by design). Fails on page scrolling, content under the tab
#   bar, sideways clipping, or a clipped Today verse. Lists and reading panels that scroll inside themselves are exempt.
# Buttons: every button on every screen keeps at least 6 px between its text and its edges, at 360 and 412 px wide.
# Landscape: every main screen, the verse study and the runner at 915x412 and 800x360.
# Prints one line per sweep, like tests/tests.js; a failing viewport is named under its sweep.
import asyncio, json, os, socket, subprocess, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
T = 'If any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.'
SEED = """(async()=>{const m=await import('./js/db.js');await m.open('telmyn');await m.put('days',{date:'2026-10-27',protein_g:174,water_oz:113.9,verse_applied_notes:'x',weight_lb:220});})()"""
CHECK = """(()=>{const out=[];const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
 const scope=document.querySelector('.layer:not(.closing) .layer-body')||document.querySelector('.view');
 if(scope.scrollHeight>scope.clientHeight+1) out.push('scrolls '+(scope.scrollHeight-scope.clientHeight)+'px');
 const tabs=document.querySelector('.tabs-bar');const tb=tabs&&!document.querySelector('.layer:not(.closing)')?tabs.getBoundingClientRect().top:innerHeight;
 for(const e of scope.querySelectorAll('*')){if(!vis(e)||e.closest('.vs-studypage, .vs-verse, .vs-vlist'))continue;const r=e.getBoundingClientRect();if(r.bottom>tb+1&&e.children.length===0&&e.textContent.trim()){out.push('under bar: '+e.textContent.trim().slice(0,20));break;}}
 for(const e of scope.querySelectorAll('*')){if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='visible'&&!['vs-lead-t','nf-text','go-name'].some(c=>e.classList.contains(c))&&e.tagName!=='SMALL'&&e.clientWidth>0){out.push('clips sideways: '+(e.className||e.tagName));break;}}
 return out})()"""
MEASURE = """(()=>{const out=[];for(const b of document.querySelectorAll('button, .btn, .chip')){if(b.matches('.daylist button, .kw, .sw, .stat, .vs-start, .vs-order-w, .icon-btn, .tabs-bar button, label.btn, .j-entry, .vs-lead, .vs-video, .note-field, .pill, .wk'))continue;const r=b.getBoundingClientRect();if(!r.width||!r.height)continue;
 const range=document.createRange();range.selectNodeContents(b);const t=range.getBoundingClientRect();if(!t.width)continue;
 const l=t.left-r.left,rt=r.right-t.right,tp=t.top-r.top,bt=r.bottom-t.bottom;const m=Math.min(l,rt);
 if(m<6||b.scrollWidth>b.clientWidth+1)out.push(`${(b.textContent||'').trim().slice(0,18)}: ${Math.round(l)}/${Math.round(rt)} px`)}return [...new Set(out)]})()"""

def reply(body): return lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(body))

# Each viewport gets its own browser context (own storage and service worker), so pages never reload each other.
async def page(b, port, w, h):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, color_scheme='dark')
    pg = await ctx.new_page()
    await pg.route('**/verse?*', reply({'verses': [{'id': 'J-1-5', 'text': T}], 'text': T, 'version': 'NKJV'}))
    await pg.route('**/videos?*', reply({'videos': [{'id': 'a', 'title': 'Book of James Summary', 'thumb': ''}]}))
    await pg.route('**/passage?*', reply({'videos': [{'id': 'p1', 'title': 'James 1:5 Explained', 'channel': 'Desiring God', 'on': 'verse', 'thumb': ''}]}))
    # First load installs the service worker and reloads once it takes over; seed and reload only after that.
    await pg.goto(f'http://localhost:{port}/#today')
    for _ in range(40):   # polled, because the reload that comes with the takeover would cut a single wait short
        await pg.wait_for_timeout(400)
        try:
            if await pg.evaluate('!!navigator.serviceWorker.controller'): break
        except Exception: pass
    await pg.wait_for_timeout(1500); await pg.wait_for_load_state('load'); await pg.wait_for_selector('.status .pill', timeout=15000)   # the app's own reload after the takeover
    await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_selector('.status .pill', timeout=15000); await pg.wait_for_timeout(600)
    return pg

# After a tap that opens a sheet or layer: wait for it, then a beat for its layout.
async def opened(pg, ms=400):
    await pg.wait_for_selector('.layer:not(.closing) .layer-body', timeout=8000); await pg.wait_for_timeout(ms)

async def close_layer(pg, n=1):
    for _ in range(n): await pg.click('.layer-head [aria-label=Close] >> nth=-1'); await pg.wait_for_timeout(300)

async def layout(b, port, h):
    pg = await page(b, port, 412 if h > 640 else 360, h)
    res = {}
    for tab in ('today', 'progress', 'gear', 'me'):
        await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(500); res[tab] = await pg.evaluate(CHECK) + (['verse clamped'] if tab == 'today' and await pg.locator('.vp-text.clamped').count() else [])
    await pg.evaluate("location.hash='#me'"); await pg.wait_for_timeout(300)
    await pg.click('text=Day log'); await opened(pg); res['day view'] = await pg.evaluate(CHECK)
    await pg.click('text=Edit this day'); await pg.wait_for_selector('.log-form', timeout=8000); await pg.wait_for_timeout(300)
    for g in ('Day', 'Body', 'Fuel', 'Watch', 'Notes'):
        await pg.click(f'.log-form .tabs >> text={g}'); await pg.wait_for_timeout(150); res['log ' + g] = await pg.evaluate(CHECK)
    await close_layer(pg, 2)
    await pg.evaluate("location.hash='#today'"); await pg.wait_for_timeout(400)
    await pg.click('.verse-card'); await opened(pg, 1000); res['verse'] = await pg.evaluate(CHECK)
    await close_layer(pg)
    for name in ('Fluids', 'Protein'):
        await pg.click(f'.status .pill:has-text("{name}")'); await opened(pg); res[name] = await pg.evaluate(CHECK)
        await close_layer(pg)
    await pg.click('.next .btn.go'); await pg.wait_for_timeout(500); res['runner'] = await pg.evaluate("(()=>{const m=document.querySelector('.runner');return m&&m.scrollHeight>m.clientHeight+1?['runner overflows']:[]})()")
    await pg.close()
    return f'{h}', {k: v for k, v in res.items() if v}

async def buttons(b, port, w, h):
    pg = await page(b, port, w, h)
    res = {}
    for tab in ('today', 'progress', 'gear', 'me'):
        await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(400); res[tab] = await pg.evaluate(MEASURE)
    await pg.click('text=Day log'); await opened(pg); res['day view'] = await pg.evaluate(MEASURE)
    await pg.click('text=Edit this day'); await pg.wait_for_selector('.log-form', timeout=8000); await pg.wait_for_timeout(300)
    for g in ('Day', 'Body', 'Fuel'):
        await pg.click(f'.log-form .tabs >> text={g}'); await pg.wait_for_timeout(150); res['log ' + g] = await pg.evaluate(MEASURE)
    await close_layer(pg, 2)
    await pg.evaluate("location.hash='#today'"); await pg.wait_for_timeout(300)
    await pg.click('.verse-card'); await opened(pg, 800); res['verse'] = await pg.evaluate(MEASURE)
    await close_layer(pg)
    for name, sel in (('Fluids', '.status .pill:has-text("Fluids")'), ('Protein', '.status .pill:has-text("Protein")'), ('Weight', '.weigh')):
        await pg.click(sel); await opened(pg); res[name] = await pg.evaluate(MEASURE); await close_layer(pg)
    await pg.click('.next .btn.go'); await pg.wait_for_timeout(500); res['runner'] = await pg.evaluate(MEASURE)
    await pg.close()
    return f'{w}x{h}', {k: v for k, v in res.items() if v}

async def landscape(b, port, w, h):
    pg = await page(b, port, w, h)
    res = {}
    for tab in ('today', 'progress', 'gear', 'me'):
        await pg.evaluate(f"location.hash='#{tab}'"); await pg.wait_for_timeout(500); res[tab] = await pg.evaluate(CHECK)
    await pg.evaluate("location.hash='#today'"); await pg.wait_for_timeout(400)
    await pg.click('.verse-card'); await opened(pg, 1000); res['verse'] = await pg.evaluate(CHECK)
    await close_layer(pg)
    await pg.click('.next .btn.go'); await pg.wait_for_timeout(1500)
    await pg.click('.study-bar'); await pg.wait_for_timeout(600)   # the video list may scroll inside its own layer
    await pg.close()
    return f'{w}x{h}', {k: v for k, v in res.items() if v}

# A few pages at a time: more than that and the pages starve each other and time out.
LANES = asyncio.Semaphore(6)
async def safely(job, label):
    async with LANES:
        try: return await job
        except Exception as e: return label, {'error': str(e).split('\n')[0][:120]}

async def main():
    s = socket.socket(); s.bind(('', 0)); port = s.getsockname()[1]; s.close()
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    failed = 0
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME)
            jobs = {
                'Layout': [safely(layout(b, port, h), f'{h}') for h in (700, 731, 760, 780, 820, 860, 915)],
                'Buttons': [safely(buttons(b, port, w, h), f'{w}x{h}') for (w, h) in ((360, 700), (412, 780), (412, 915))],
                'Landscape': [safely(landscape(b, port, w, h), f'{w}x{h}') for (w, h) in ((915, 412), (800, 360))],
            }
            results = dict(zip(jobs, await asyncio.gather(*[asyncio.gather(*v) for v in jobs.values()])))
            await b.close()
    finally:
        server.terminate()
    for name, rows in results.items():
        bad = [(k, v) for k, v in rows if v]
        print(f'{name.ljust(10)} {f"{len(bad)} of {len(rows)} failed" if bad else f"{len(rows)} passed"}')
        for k, v in bad: print(f'  FAIL {k}: {v}'); failed += 1
    print(f'{failed} failed' if failed else 'All sweeps passed')
    sys.exit(1 if failed else 0)
asyncio.run(main())
