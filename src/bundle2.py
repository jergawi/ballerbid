import json, os, re
# BB_SRC: folder with the sources (default: this script's folder); BB_NPM: node_modules holding morphdom and mqtt@5.16.1
B=os.environ.get('BB_SRC',os.path.dirname(os.path.abspath(__file__)))+'/'
NPM=os.environ.get('BB_NPM',B+'node_modules')+'/'
# game modules, spliced into app.js just before the matchup model (order matters: later modules use earlier ones)
MODULES=['mis.js','season.js','views2.js','legend.js','bench.js','place.js','formats.js','sfx.js','views3.js']
css=open(B+'style4.css').read()
app=open(B+'app.js').read()
extra=''.join(open(B+m).read()+'\n' for m in MODULES)
assert app.count('/* ---------- matchup model')==1
app=app.replace('/* ---------- matchup model',extra+'/* ---------- matchup model')
md=open(NPM+'morphdom/dist/morphdom-umd.min.js').read()
mq=open(NPM+'mqtt/dist/mqtt.min.js').read()
safe=lambda c: re.sub(r'</(script)', r'<\\/\1', c, flags=re.I)
KEEP=['n','id','pos','tm','y0','y1','g','mp','pts','trb','ast','stl','blk','tov','obpm','dbpm','usg','astp','trbp','blkp','stlp','pe','lo','hi','est','tp','tpa','pf36']
th=json.load(open(B+'themes.json'))
def _v(i,k):
    v=i.get(k)
    if k=='est': return 1 if v else 0
    if isinstance(v,float): v=round(v,3 if abs(v)<1 else 2)
    return v
import unicodedata
for t in th:
    for i in t['items']:
        if isinstance(i.get('n'),str): i['n']=unicodedata.normalize('NFC',i['n'])
for t in th: t['items']=[[_v(i,k) for k in KEEP] for i in t['items']]
thj=json.dumps({'cols':KEEP,'themes':th},ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
ca=open(B+'career.json').read().replace('</','<\\/'); li=open(B+'links.json').read(); bi=open(B+'bios.json').read()
import hashlib, base64
SRI='sha384-'+base64.b64encode(hashlib.sha384(open(NPM+'mqtt/dist/mqtt.min.js','rb').read()).digest()).decode()
def csp(html,extra_connect=''):
    hs=[]
    for m in re.finditer(r'<script>(.*?)</script>',html,flags=re.S): hs.append("'sha256-"+base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode()+"'")
    pol=("default-src 'none'; script-src "+' '.join(hs)+" https://cdn.jsdelivr.net/npm/mqtt@5.16.1/dist/mqtt.min.js; worker-src blob:; "
         "connect-src wss://broker.emqx.io:8084 wss://broker.hivemq.com:8884"+extra_connect+"; style-src 'unsafe-inline' https://fonts.googleapis.com; "
         "font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none'; object-src 'none'")
    return html.replace('<!--CSP-->','<meta http-equiv="Content-Security-Policy" content="'+pol+'">')
def page(mqtt_tag):
    return f'''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<!--CSP-->
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#e4e9f3">
<title>BALLER BID 球星喊價</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&family=Noto+Sans+TC:wght@500;700;900&display=swap" rel="stylesheet">
<style>
{css}
</style>
<script>{safe(md)}</script>
{mqtt_tag}
<script type="application/json" id="d-themes">{thj}</script>
<script type="application/json" id="d-career">{ca}</script>
<script type="application/json" id="d-links">{li}</script>
<script type="application/json" id="d-bios">{bi}</script>
</head>
<body>
<div id="app" class="wrap"><div class="center mut" style="margin-top:80px">載入球員資料…</div></div>
<div id="toast"></div><div id="stagefx" aria-hidden="true"></div>
<script>
{safe(app)}
</script>
</body>
</html>
'''
os.makedirs(B+'dist2',exist_ok=True)
open(B+'dist2/index.html','w').write(csp(page('<script src="https://cdn.jsdelivr.net/npm/mqtt@5.16.1/dist/mqtt.min.js" integrity="'+SRI+'" crossorigin="anonymous" async></script>')))
open(B+'dist2/test.html','w').write(page('<script>'+safe(mq)+'</script>'))
TESTPAGE=page('<script>'+safe(mq)+'</script>')
print({f:os.path.getsize(B+'dist2/'+f) for f in ['index.html','test.html']})
