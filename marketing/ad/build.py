# Builds the Qayam Traders ad: 1920x1080, 30 fps. Layers drawn with PIL, composed with ffmpeg.
import os, sys, subprocess, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AD = os.path.dirname(os.path.abspath(__file__))
REC, VO, BLD, MOCK = f'{AD}/rec', os.environ.get('VO_DIR', f'{AD}/vo2'), f'{AD}/build', f'{AD}/mock'
L = f'{BLD}/layers'; os.makedirs(L, exist_ok=True)
W, H, FPS, XF = 1920, 1080, 30, 0.6
FD = '/usr/share/fonts/opentype/inter'
F = lambda name, size: ImageFont.truetype(f'{FD}/{name}.otf', size)
NAVY, GOLD, GREEN, WHITE = (11, 37, 84), (212, 160, 23), (11, 93, 64), (255, 255, 255)

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(' '.join(cmd)[:3000]); print(r.stderr[-3000:]); sys.exit(1)
    return r
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)

# ---------------- scenes ----------------
S = [
 dict(id='s01', kind='intro', vo='a01', dur=7.5, cap=['Qayam Traders ka apna smart ERP.', 'Ab poore business ka hisaab — aap ki jaib mein.']),
 dict(id='s02', clip=('install', 0, None), side='left', chip='STEP 1  ·  INSTALL', title='WhatsApp se\ninstall karein', bullets=['APK file par tap — download', '“Allow from this source” on', 'Install  →  Open'], vo='a02', dur=14.0,
      cap=['Shuru karna bohot aasaan hai: WhatsApp par aayi APK file par tap karein.', 'Phone poochhe to “Allow from this source” on karein — phir Install.']),
 dict(id='s03', clip=('login', 0, None), side='right', chip='STEP 2  ·  LOGIN', title='Sirf ek dafa\nlogin', bullets=['Apna username & password', 'Har role ki apni screen', 'Phir app seedhi khulti hai'], vo='a03', dur=8.0,
      cap=['App kholein, apna username aur password daalein — bas ek hi dafa.', 'Uske baad app hamesha seedhi khulegi.']),
 dict(id='s04', clip=('home', 0, None), side='left', chip='DASHBOARD', title='Sab kuch\nek nazar mein', bullets=['Aaj ki sale & wasooli', 'Kis se kitne paise lene hain', 'Stock ke alerts'], vo='a04', dur=8.0,
      cap=['Home par sab saamne: aaj ki sale, wasooli,', 'kis se kitne paise lene hain, aur stock ke alerts.']),
 dict(id='s05', clip=('bill', 0, 25.0), side='right', chip='BILLING', title='Bill sirf\n1 minute mein', bullets=['Plus  →  Create Bill', 'TP aur discount khud nazar aaye', 'Discount Rs ya % mein'], vo='a05', dur=11.0,
      cap=['Bill banana ho to Plus dabayein, customer chunein, item add karein.', 'TP aur discount khud nazar aata hai — bill ek minute mein tayyar.']),
 dict(id='s06', clip=('bill', 25.0, None), side='left', chip='INVOICE', title='Logo wala\nprofessional invoice', bullets=['A4 ya 80mm receipt', 'PDF ya picture', 'Seedha WhatsApp par'], vo='a06', dur=8.0,
      cap=['Logo wala professional invoice —', 'PDF ya picture bana kar seedha WhatsApp par customer ko bhejein.']),
 dict(id='s07', clip=('voice', 0, None), side='right', chip='VOICE ENTRY', title='Bol kar\nentry karein', bullets=['“3 kilo ghee Mehran Hotel ko…”', 'App khud samajhti hai', 'Check karein  →  Approve'], vo='a07', dur=10.5,
      cap=['Ya sirf bolein: “3 kilo ghee, Mehran Hotel ko diya, 3000 ka.”', 'App khud samajh kar entry bana deti hai — aap bas Approve karein.']),
 dict(id='s08', clip=('approve', 0, None), side='left', chip='OWNER APPROVAL', title='Rs 10,000+ entry\nowner ki approval se', bullets=['Owners ko notification', 'Items, TP aur discount dekhein', '1 tap: Approve ya Reject'], vo='a08', dur=9.0,
      cap=['Rs 10,000 se bari har entry owners ke paas approval ke liye jaati hai.', 'Notification aata hai — ek tap mein Approve ya Reject.']),
 dict(id='s09', clip=('recovery', 0, None), side='right', chip='RECOVERY', title='Wasooli\nkabhi na bhoolein', bullets=['Purana baqaya sab se upar', 'WhatsApp reminder 1 tap mein', 'Call ya payment receive'], vo='a09', dur=7.5,
      cap=['Recovery list mein dekhein kis ka kitna purana baqaya hai,', 'aur ek tap mein WhatsApp reminder bhejein.']),
 dict(id='s10', kind='web', clip=('web', 0, None), chip='WEB SOFTWARE  ·  OFFICE', chips=['Dashboard', 'Bills register', 'Item-wise sales', 'Profit & Loss', 'Excel / PDF'], vo='a10', dur=12.0,
      cap=['Aur office ke liye web software: bara dashboard, bills register,', 'item-wise sales aur profit & loss — sab Excel aur PDF ke saath.']),
 dict(id='s11', clip=('roles', 0, None), side='left', chip='TEAM & ROLES', title='Har bande ka\napna role', bullets=['Owner  ·  Manager  ·  Salesman', 'Har koi sirf apna kaam dekhe', 'Ek dafa login, hamesha safe'], vo='a11', dur=6.5,
      cap=['Har bande ka apna login, apna role:', 'Owner, Manager aur Salesman.']),
 dict(id='s12', kind='outro', vo='a12', dur=8.0, cap=['Qayam Traders ERP —', 'Bill banao. Hisaab rakho. Business barhao.']),
]

# ---------------- static layers ----------------
def rr(size, radius, fill):
    im = Image.new('RGBA', size, (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=fill); return im

SW, SH = 400, 866            # phone screen (from 390x844)
BZ = 15                      # bezel
PW, PH = SW + 2 * BZ, SH + 2 * BZ
def phone_layers():
    fr = rr((PW, PH), 62, (14, 16, 20, 255))
    d = ImageDraw.Draw(fr)
    d.rounded_rectangle([1, 1, PW - 2, PH - 2], 61, outline=(70, 74, 82, 255), width=2)
    hole = rr((SW, SH), 48, (0, 0, 0, 255)).split()[3]
    a = fr.split()[3]; a.paste(0, (BZ, BZ), hole); fr.putalpha(a)
    d.ellipse([PW // 2 - 6, BZ + 7, PW // 2 + 6, BZ + 19], fill=(20, 20, 24, 255))      # camera
    d.rounded_rectangle([PW - 3, 190, PW + 1, 270], 2, fill=(40, 42, 48, 255))          # side button
    fr.save(f'{L}/phone.png')
    rr((SW, SH), 48, (255, 255, 255, 255)).save(f'{L}/phone_mask.png')
    sh = Image.new('RGBA', (PW + 160, PH + 160), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([80, 95, 80 + PW, 95 + PH], 62, fill=(0, 0, 0, 150))
    sh.filter(ImageFilter.GaussianBlur(34)).save(f'{L}/phone_shadow.png')

BW = 1460; BH = round(BW * 900 / 1440); BAR = 44
def browser_layers():
    w, h = BW, BH + BAR
    fr = rr((w, h), 18, (236, 239, 244, 255)); d = ImageDraw.Draw(fr)
    a = fr.split()[3]; a.paste(0, (0, BAR, w, h)); fr.putalpha(a)
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]): d.ellipse([20 + i * 22, 16, 32 + i * 22, 28], fill=c + (255,))
    d.rounded_rectangle([w // 2 - 230, 9, w // 2 + 230, 35], 13, fill=(255, 255, 255, 255))
    d.text((w // 2, 22), 'qayam-traders.ample.run', font=F('Inter-Medium', 15), fill=(90, 98, 112), anchor='mm')
    fr.save(f'{L}/browser.png')
    m = Image.new('RGBA', (BW, BH), (255, 255, 255, 255)); md = Image.new('L', (BW, BH), 0); ImageDraw.Draw(md).rounded_rectangle([0, -30, BW - 1, BH - 1], 18, fill=255); m.putalpha(md); m.save(f'{L}/browser_mask.png')
    sh = Image.new('RGBA', (w + 200, h + 200), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([100, 120, 100 + w, 120 + h], 18, fill=(0, 0, 0, 140))
    sh.filter(ImageFilter.GaussianBlur(40)).save(f'{L}/browser_shadow.png')

SB = 26
def statusbar():
    im = Image.new('RGBA', (SW, SB), (243, 246, 244, 255)); d = ImageDraw.Draw(im)
    d.text((30, SB / 2 + 1), '10:42', font=F('Inter-SemiBold', 14), fill=(28, 28, 30), anchor='lm')
    x = SW - 30
    d.rounded_rectangle([x - 24, 8, x - 2, 18], 3, outline=(28, 28, 30), width=2); d.rectangle([x - 22, 10, x - 8, 16], fill=(28, 28, 30)); d.rectangle([x - 1, 11, x + 1, 15], fill=(28, 28, 30))
    d.text((x - 32, SB / 2 + 1), '4G', font=F('Inter-Bold', 12), fill=(28, 28, 30), anchor='rm')
    for i in range(4): d.rectangle([x - 72 + i * 5, 17 - i * 3, x - 69 + i * 5, 18], fill=(28, 28, 30))
    im.save(f'{L}/statusbar.png')

def decor():
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x in range(0, W, 48):
        for y in range(0, H, 48): d.ellipse([x - 1.3, y - 1.3, x + 1.3, y + 1.3], fill=(255, 255, 255, 18))
    g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
    gd.ellipse([1350, -320, 2250, 580], fill=(212, 160, 23, 40)); gd.ellipse([-380, 560, 520, 1460], fill=(40, 200, 140, 34))
    g = g.filter(ImageFilter.GaussianBlur(120)); im = Image.alpha_composite(g, im)
    v = Image.new('L', (W, H), 0); ImageDraw.Draw(v).rectangle([0, 0, W, H], fill=0)
    vig = Image.new('RGBA', (W, H), (0, 0, 0, 0)); vd = ImageDraw.Draw(vig)
    for i in range(40): vd.rectangle([i * 6, i * 6, W - i * 6, H - i * 6], outline=(0, 0, 0, max(0, 70 - i * 2)), width=6)
    Image.alpha_composite(im, vig.filter(ImageFilter.GaussianBlur(30))).save(f'{L}/decor.png')

def text_img(path, text, font, fill=WHITE, pad=(0, 0), shadow=True, spacing=8, align='left'):
    tmp = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    bb = tmp.multiline_textbbox((0, 0), text, font=font, spacing=spacing)
    w, h = bb[2] - bb[0] + pad[0] * 2 + 20, bb[3] - bb[1] + pad[1] * 2 + 20
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if shadow:
        s = Image.new('RGBA', (w, h), (0, 0, 0, 0)); ImageDraw.Draw(s).multiline_text((pad[0] + 10 - bb[0], pad[1] + 13 - bb[1]), text, font=font, fill=(0, 0, 0, 110), spacing=spacing, align=align)
        im = Image.alpha_composite(im, s.filter(ImageFilter.GaussianBlur(6))); d = ImageDraw.Draw(im)
    d.multiline_text((pad[0] + 10 - bb[0], pad[1] + 10 - bb[1]), text, font=font, fill=fill, spacing=spacing, align=align)
    im.save(path); return im.size

def chip_img(path, text, bg=GOLD, fg=NAVY, size=24):
    f = F('Inter-Bold', size); tw = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textlength(text, font=f)
    w, h = int(tw + 44), size + 26
    im = rr((w, h), h // 2, bg + (255,)); ImageDraw.Draw(im).text((w / 2, h / 2 + 1), text, font=f, fill=fg, anchor='mm'); im.save(path); return im.size

def bullet_img(path, text):
    f = F('Inter-SemiBold', 34); tw = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textlength(text, font=f)
    w, h = int(tw + 92), 62
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], 18, fill=(255, 255, 255, 26))
    d.ellipse([14, 15, 46, 47], fill=GOLD + (255,)); d.line([(22, 31), (28, 38), (39, 24)], fill=NAVY + (255,), width=4, joint='curve')
    d.text((62, h / 2 + 1), text, font=f, fill=WHITE, anchor='lm'); im.save(path); return im.size

def caption_img(path, text):
    f = F('Inter-SemiBold', 36); tw = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textlength(text, font=f)
    w, h = int(tw + 64), 70
    im = rr((w, h), 20, (6, 14, 32, 200)); d = ImageDraw.Draw(im)
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w - 1, h - 1], 20, outline=(255, 255, 255, 30), width=1)
    d.text((w / 2, h / 2 + 1), text, font=f, fill=(255, 255, 255), anchor='mm'); im.save(path); return im.size

phone_layers(); browser_layers(); decor(); statusbar()
ICON = f'{AD}/../../../../../../home/user/Tezdukan-app-cloude/app/public'
APP_PUBLIC = '/home/user/Tezdukan-app-cloude/app/public'
# logo card for intro/outro
logo = Image.open(f'{APP_PUBLIC}/brand/logo-full.png').convert('RGBA'); lw = 400; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
card = rr((lw + 120, logo.height + 90), 44, (255, 255, 255, 255)); card.alpha_composite(logo, (60, 45))
cs = Image.new('RGBA', (card.width + 160, card.height + 160), (0, 0, 0, 0)); cs.alpha_composite(rr((card.width, card.height), 44, (0, 0, 0, 150)), (80, 100)); cs = cs.filter(ImageFilter.GaussianBlur(30)); cs.alpha_composite(card, (80, 80)); cs.save(f'{L}/logocard.png')

# ---------------- timing ----------------
for s in S:
    s['vo_len'] = dur(f'{VO}/{s["vo"]}.wav') if os.path.exists(f'{VO}/{s["vo"]}.wav') else 0
    s['dur'] = max(s['dur'], s['vo_len'] + 1.6)
t = 0
for i, s in enumerate(S):
    s['start'] = t; t += s['dur'] - (XF if i < len(S) - 1 else 0)
TOTAL = t
VO_AT = 0.55  # voice starts this long after the scene starts
print('total', round(TOTAL, 2), [round(s['dur'], 1) for s in S])

def caps_for(s, prefix):
    out = []; parts = s['cap']; tot = sum(len(p) for p in parts)
    a = VO_AT if s.get('kind') != 'intro' else VO_AT + 0.6
    span = max(s['vo_len'], 2.5) + 0.25
    for k, p in enumerate(parts):
        b = a + span * len(p) / tot
        if k == len(parts) - 1: b = min(max(b, a + 1.6), s['dur'] - 0.25)
        fn = f'{L}/{prefix}_cap{k}.png'; size = caption_img(fn, p)
        out.append((fn, size, a, b)); a = b
    return out

E = lambda st, d=0.6, amp=1: f"pow(1-min(max((t-{st})/{d},0),1),3)*{amp}"

def scene(s):
    out = f'{BLD}/{s["id"]}.mp4'; D = s['dur']; kind = s.get('kind', 'app')
    inp = ['-f', 'lavfi', '-i', f'gradients=s={W}x{H}:c0=0x0a1f47:c1=0x10336b:c2=0x0c4a4f:n=3:speed=0.004:d={D}:r={FPS}',
           '-framerate', str(FPS), '-loop', '1', '-t', str(D), '-i', f'{L}/decor.png']
    fc = ['[0:v]format=rgba[bg0]', '[bg0][1:v]overlay=0:0[v0]']; n = 2; last = 'v0'; k = 0
    def add_img(path):
        nonlocal n
        inp.extend(['-framerate', str(FPS), '-loop', '1', '-t', str(D), '-i', path]); n += 1; return n - 1
    def ov(idx, x, y, st=0.0, fade=0.45, extra=''):
        nonlocal last, k
        k += 1; fc.append(f'[{idx}:v]format=rgba,fade=in:st={st}:d={fade}:alpha=1{extra}[l{k}]')
        fc.append(f"[{last}][l{k}]overlay=x='{x}':y='{y}':eval=frame[v{k}]"); last = f'v{k}'
    if kind in ('app', 'web'):
        name, a, b = s['clip']; src = f'{REC}/{name}.mp4'; b = b if b is not None else dur(src)
        f = max((b - a) / (D - 0.2), 1.0)
        inp.extend(['-i', src]); ci = n; n += 1
    if kind == 'app':
        left = s['side'] == 'left'
        PX = 230 if left else W - 230 - PW; PY = 52
        TX = PX + PW + 110 if left else 150
        dirn = 1 if left else -1
        mi = add_img(f'{L}/phone_mask.png'); fi = add_img(f'{L}/phone.png'); shi = add_img(f'{L}/phone_shadow.png')
        k += 1
        own_bar = name == 'install'
        sz = f'scale={SW}:{SH}:flags=lanczos' if own_bar else f'scale={SW}:{SH - SB}:flags=lanczos,pad={SW}:{SH}:0:{SB}:color=0xF3F6F4'
        fc.append(f'[{ci}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{f:.4f},fps={FPS},tpad=stop_mode=clone:stop_duration={D},trim=duration={D},{sz},format=rgba[c0]')
        if not own_bar:
            sbi = add_img(f'{L}/statusbar.png'); fc.append(f'[c0][{sbi}:v]overlay=0:0[c1]'); fc.append(f'[c1][{mi}:v]alphamerge[scr]')
        else: fc.append(f'[c0][{mi}:v]alphamerge[scr]')
        ey = E(0.0, 0.8, 90)
        fc.append(f"[{last}][{shi}:v]overlay=x={PX - 80}:y='{PY - 80}+{ey}':eval=frame[w1]")
        fc.append(f"[w1][scr]overlay=x={PX + BZ}:y='{PY + BZ}+{ey}':eval=frame[w2]")
        fc.append(f"[w2][{fi}:v]overlay=x={PX}:y='{PY}+{ey}':eval=frame[w3]"); last = 'w3'
        # text panel
        y = 250
        cw, chh = chip_img(f'{L}/{s["id"]}_chip.png', s['chip']); ov(add_img(f'{L}/{s["id"]}_chip.png'), f"{TX}+{dirn}*{E(0.25, .55, 50)}", y, 0.25); y += chh + 26
        tw, th = text_img(f'{L}/{s["id"]}_title.png', s['title'], F('InterDisplay-ExtraBold', 76), spacing=6)
        ov(add_img(f'{L}/{s["id"]}_title.png'), f"{TX - 10}+{dirn}*{E(0.4, .6, 70)}", y - 10, 0.4); y += th + 26
        for j, bt in enumerate(s['bullets']):
            bw, bh = bullet_img(f'{L}/{s["id"]}_b{j}.png', bt)
            st = 0.8 + j * 0.55
            st = min(st, D - 1.5)
            ov(add_img(f'{L}/{s["id"]}_b{j}.png'), f"{TX}+{dirn}*{E(st, .5, 60)}", y, st); y += bh + 16
        # gold underline accent
    elif kind == 'web':
        BX = (W - BW) // 2; BY = 118
        mi = add_img(f'{L}/browser_mask.png'); fi = add_img(f'{L}/browser.png'); shi = add_img(f'{L}/browser_shadow.png')
        fc.append(f'[{ci}:v]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{f:.4f},fps={FPS},tpad=stop_mode=clone:stop_duration={D},trim=duration={D},scale={BW}:{BH}:flags=lanczos,format=rgba[c0]')
        fc.append(f'[c0][{mi}:v]alphamerge[scr]')
        ey = E(0.0, 0.8, 80)
        fc.append(f"[{last}][{shi}:v]overlay=x={BX - 100}:y='{BY - 100}+{ey}':eval=frame[w1]")
        fc.append(f"[w1][scr]overlay=x={BX}:y='{BY + BAR}+{ey}':eval=frame[w2]")
        fc.append(f"[w2][{fi}:v]overlay=x={BX}:y='{BY}+{ey}':eval=frame[w3]"); last = 'w3'
        cw, chh = chip_img(f'{L}/{s["id"]}_chip.png', s['chip']); ov(add_img(f'{L}/{s["id"]}_chip.png'), f"{BX}-{E(0.2, .5, 40)}", 46, 0.2)
        x = BX + cw + 18
        for j, c in enumerate(s['chips']):
            w2, h2 = chip_img(f'{L}/{s["id"]}_c{j}.png', c, bg=(255, 255, 255), fg=NAVY, size=22)
            st = 0.8 + j * (s['vo_len'] / len(s['chips']) * 0.8)
            ov(add_img(f'{L}/{s["id"]}_c{j}.png'), x, f"{48}+{E(st, .45, 24)}", st); x += w2 + 12
    else:  # intro / outro
        lc = add_img(f'{L}/logocard.png')
        cw, chh = Image.open(f'{L}/logocard.png').size
        k += 1
        fc.append(f"[{lc}:v]format=rgba,fade=in:st=0.15:d=0.6:alpha=1,scale=w='{cw}*(0.86+0.14*(1-{E(0.15, 0.9)}))':h=-1:eval=frame[lg]")
        fc.append(f"[{last}][lg]overlay=x='(W-w)/2':y='{95 if kind == 'intro' else 70}+(h0-h)/2':eval=frame[w{k}]".replace('h0', str(chh))); last = f'w{k}'
        if kind == 'intro':
            tw, th = text_img(f'{L}/intro_t.png', 'Smart ERP · Android App · Web Software', F('InterDisplay-Bold', 54)); ov(add_img(f'{L}/intro_t.png'), (W - tw) // 2, f"630+{E(1.0, .6, 30)}", 1.0)
            x0 = 0; chips = ['Bills', 'Stock', 'Wasooli', 'Approvals', 'WhatsApp invoice', 'Reports']
            sizes = [chip_img(f'{L}/intro_c{j}.png', c, bg=(255, 255, 255), fg=NAVY, size=24) for j, c in enumerate(chips)]
            tot = sum(w2 for w2, _ in sizes) + 14 * (len(chips) - 1); x = (W - tot) // 2
            for j, (w2, h2) in enumerate(sizes):
                st = 1.6 + j * 0.18; ov(add_img(f'{L}/intro_c{j}.png'), x, f"745+{E(st, .45, 26)}", st); x += w2 + 14
        else:
            tw, th = text_img(f'{L}/outro_t.png', 'Bill banao. Hisaab rakho.\nBusiness barhao.', F('InterDisplay-ExtraBold', 66), spacing=10, align='center')
            ov(add_img(f'{L}/outro_t.png'), (W - tw) // 2, f"585+{E(0.9, .6, 30)}", 0.9)
            cw2, ch2 = chip_img(f'{L}/outro_c.png', 'Android App  +  Web Software', size=26); ov(add_img(f'{L}/outro_c.png'), (W - cw2) // 2, f"815+{E(1.6, .5, 20)}", 1.6)
    # captions
    for (fn, (cw, chh), a, b) in caps_for(s, s['id']):
        idx = add_img(fn)
        ov(idx, (W - cw) // 2, H - chh - 34, a, 0.25, f',fade=out:st={b - 0.25:.2f}:d=0.25:alpha=1')
    fc.append(f'[{last}]format=yuv420p[out]')
    cmd = ['ffmpeg', '-y', '-v', 'error', *inp, '-filter_complex', ';'.join(fc), '-map', '[out]', '-t', f'{D:.3f}', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out]
    run(cmd); print('scene', s['id'], round(D, 2)); return out

only = sys.argv[1:]
files = [scene(s) if (not only or s['id'] in only or not os.path.exists(f'{BLD}/{s["id"]}.mp4')) else f'{BLD}/{s["id"]}.mp4' for s in S]

# ---------------- join with transitions ----------------
TR = ['fade', 'smoothleft', 'smoothleft', 'fade', 'smoothleft', 'fade', 'smoothleft', 'fade', 'smoothleft', 'fade', 'fadeblack']
inp = []; [inp.extend(['-i', f]) for f in files]
fc = []; last = '0:v'
for i in range(1, len(files)):
    off = S[i]['start']
    fc.append(f'[{last}][{i}:v]xfade=transition={TR[(i - 1) % len(TR)]}:duration={XF}:offset={off:.3f}[x{i}]'); last = f'x{i}'
# audio: voice lines at their scene times, music ducked under the voice
ai = len(files)
for s in S: inp.extend(['-i', f'{VO}/{s["vo"]}.wav'])
inp.extend(['-i', f'{BLD}/music.wav'])
vo_tags = []
for j, s in enumerate(S):
    at = int((s['start'] + VO_AT + (0.6 if s.get('kind') == 'intro' else 0)) * 1000)
    fc.append(f'[{ai + j}:a]aresample=44100,aformat=channel_layouts=stereo,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,volume=1.6,adelay={at}|{at}[vo{j}]'); vo_tags.append(f'[vo{j}]')
fc.append(f'{"".join(vo_tags)}amix=inputs={len(vo_tags)}:normalize=0,asplit=2[vox][key]')
fc.append(f'[{ai + len(S)}:a]atrim=0:{TOTAL + 0.5:.2f},volume=0.30,afade=t=out:st={TOTAL - 3:.2f}:d=3[mus]')
fc.append('[mus][key]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=500[duck]')
fc.append('[vox][duck]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000[aout]')
final = f'{BLD}/Qayam-Traders-Ad.mp4'
run(['ffmpeg', '-y', '-v', 'error', *inp, '-filter_complex', ';'.join(fc), '-map', f'[{last}]', '-map', '[aout]', '-t', f'{TOTAL:.3f}',
     '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', final])
print('final', final, round(dur(final), 2))
