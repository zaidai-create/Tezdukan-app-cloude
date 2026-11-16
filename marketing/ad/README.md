# Qayam Traders ad video (90–120 s)

Re-creates the promo video from the real app, using a demo copy of the database with fictional customer names.

1. `demo.sql` — run on a copy of the local database (`createdb -T qayam qayam_demo`), then start the app on port 4000 with `DATABASE_URL=.../qayam_demo`.
2. `node rec.js <out>/rec` — records each scene (install illustration in `mock/`, login, home, bill, invoice, voice, approvals, recovery, web, roles) as frames; encode each `<scene>_f/list.txt` with ffmpeg concat.
3. Voice-over: one line per scene in `vo_lines.txt` (Urdu script, offline Piper voice `ur_PK-fasih-medium`). Any other voice works: put `a01.wav … a12.wav` in a folder and set `VO_DIR`.
4. `python3 music.py build/music.wav 115` — original background track.
5. `python3 build.py` — composes 1920x1080 scenes (phone/browser frames, titles, captions, transitions) and mixes voice + ducked music into `build/Qayam-Traders-Ad.mp4`.
