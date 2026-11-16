# Light corporate background track (original, synthesized): I–V–vi–IV in D, 96 BPM, pad + arpeggio + soft beat.
import numpy as np, wave, sys
SR = 44100
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 112.0
out = sys.argv[1]
bpm = 96; beat = 60 / bpm; bar = beat * 4
N = int(SR * dur); t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
chords = [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [55, 59, 62, 67]]  # D A Bm G
bass = [38, 33, 35, 31]
def env(n, a, r):
    e = np.ones(n); a = min(int(a * SR), n); r = min(int(r * SR), n)
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e
nb = int(dur / bar) + 1
for b in range(nb):
    s0 = int(b * bar * SR); n = min(int(bar * SR), N - s0)
    if n <= 0: break
    tt = np.arange(n) / SR; ch = chords[b % 4]
    pad = np.zeros(n)
    for m in ch:
        f = hz(m)
        for k, a in ((1, 1), (2, .28), (3, .12)):
            pad += a * np.sin(2 * np.pi * f * k * tt + .3 * np.sin(2 * np.pi * .3 * tt)) * (1 + .002 * k)
    pad *= env(n, .6, .6) * (.55 + .45 * np.sin(2 * np.pi * tt / bar * .5) ** 2) / len(ch)
    L[s0:s0 + n] += .16 * pad; R[s0:s0 + n] += .16 * np.roll(pad, 220)
    # bass
    fb = hz(bass[b % 4]); bs = np.sin(2 * np.pi * fb * tt) + .3 * np.sin(4 * np.pi * fb * tt)
    L[s0:s0 + n] += .12 * bs * env(n, .02, .3); R[s0:s0 + n] += .12 * bs * env(n, .02, .3)
    # arpeggio 8th notes (enters after the intro bar)
    if b >= 1:
        seq = ch + ch[::-1][1:3] + [ch[0] + 12]
        for i in range(8):
            a0 = s0 + int(i * beat / 2 * SR); an = int(beat * 1.2 * SR)
            if a0 + an > N: break
            ta = np.arange(an) / SR; f = hz(seq[i % len(seq)] + 12)
            pl = (np.sin(2 * np.pi * f * ta) + .25 * np.sin(4 * np.pi * f * ta)) * np.exp(-ta * 6)
            pan = .5 + .35 * np.sin(i)
            L[a0:a0 + an] += .07 * pl * (1 - pan) * 2; R[a0:a0 + an] += .07 * pl * pan * 2
    # soft kick on 1 and 3, shaker on off-beats (from bar 2)
    if b >= 2:
        for i in range(4):
            k0 = s0 + int(i * beat * SR)
            if i in (0, 2):
                kn = int(.25 * SR); tk = np.arange(kn) / SR
                if k0 + kn <= N:
                    kk = np.sin(2 * np.pi * (50 + 70 * np.exp(-tk * 25)) * tk) * np.exp(-tk * 12)
                    L[k0:k0 + kn] += .22 * kk; R[k0:k0 + kn] += .22 * kk
            h0 = k0 + int(beat / 2 * SR); hn = int(.06 * SR)
            if h0 + hn <= N:
                nz = np.random.default_rng(b * 8 + i).standard_normal(hn); nz = np.diff(np.concatenate([[0], nz])) * np.exp(-np.arange(hn) / SR * 60)
                L[h0:h0 + hn] += .025 * nz; R[h0:h0 + hn] += .03 * nz
# fades + normalise
fade = env(N, 2.0, 3.0); L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max()); L /= pk * 1.12; R /= pk * 1.12
data = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('music', out, dur)
