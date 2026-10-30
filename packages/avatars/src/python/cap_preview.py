"""Baseball-cap review sheet: 3 cap PFPs at full size + the same at 128px. Writes previews/pfp-cap.png + svg/pfp-cap.svg."""
import sys, os, io, cairosvg
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from traits import pfp
from PIL import Image
TS = [dict(Background="Paper", Body="Mint", Eyes="Idle", Headwear="Cap", Eyewear="None", Clothing="Bomber", Accessory="Chain"),
      dict(Background="Sky", Body="Cobalt", Eyes="Wide", Headwear="Cap", Eyewear="None", Clothing="Hoodie", Accessory="None"),
      dict(Background="Butter", Body="Gold", Eyes="Joy", Headwear="Cap", Eyewear="Shades", Clothing="Tee", Accessory="Seed Pendant")]
s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 512">'
for i, t in enumerate(TS): s += f'<svg x="{i*512}" y="0" width="512" height="512" viewBox="0 0 512 512">' + ''.join(pfp(t).L) + '</svg>'
s += '</svg>'
ROOT = os.path.dirname(os.path.dirname(HERE)); open(f"{ROOT}/svg/pfp-cap.svg", "w").write(s)
big = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(), output_width=3072, output_height=1024))).convert("RGB").resize((1536, 512), Image.LANCZOS)
out = Image.new("RGB", (1536, 512 + 160), "#0B0D0E"); out.paste(big, (0, 0))
for i in range(3): out.paste(big.crop((i*512, 0, i*512+512, 512)).resize((128, 128), Image.LANCZOS), (i*512 + 192, 528))
out.save(f"{ROOT}/previews/pfp-cap.png")
