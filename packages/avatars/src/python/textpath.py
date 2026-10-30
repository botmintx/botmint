import os, functools
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
G=os.environ.get("BOTMINT_FONTS","/usr/share/fonts/truetype/sand-box/google/").rstrip("/")+"/"
SRC={"grotesk":G+"Space Grotesk/SpaceGrotesk-VariableFont_wght.ttf",
     "mono":G+"JetBrains Mono/JetBrainsMono-VariableFont_wght.ttf",
     "inter":G+"Inter/Inter-VariableFont_opsz,wght.ttf",
     "geist":G+"Geist/Geist-VariableFont_wght.ttf","geistmono":G+"Geist Mono/GeistMono-VariableFont_wght.ttf",
     "intertight":G+"Inter Tight/InterTight-VariableFont_wght.ttf","instrument":G+"Instrument Sans/InstrumentSans-VariableFont_wdth,wght.ttf",
     "bricolage":G+"Bricolage Grotesque/BricolageGrotesque-VariableFont_opsz,wdth,wght.ttf","host":G+"Host Grotesk/HostGrotesk-VariableFont_wght.ttf",
     "funnel":G+"Funnel Display/FunnelDisplay-VariableFont_wght.ttf","mona":G+"Mona Sans/MonaSans-VariableFont_wdth,wght.ttf"}
HERE=os.path.dirname(os.path.abspath(__file__)); os.makedirs(f"{HERE}/fonts", exist_ok=True)
@functools.lru_cache(None)
def load(fam,wght):
    out=f"{HERE}/fonts/{fam}-{wght}.ttf"
    if not os.path.exists(out):
        f=TTFont(SRC[fam]); loc={"wght":wght}
        ax=[a.axisTag for a in f["fvar"].axes]
        if "opsz" in ax: loc["opsz"]=max(a.minValue for a in f["fvar"].axes if a.axisTag=="opsz") if fam=="bricolage" else 32
        if "wdth" in ax: loc["wdth"]=100
        instancer.instantiateVariableFont(f,loc,inplace=True); f.save(out)
    tt=TTFont(out); blob=hb.Blob.from_file_path(out)
    return tt, hb.Font(hb.Face(blob))
def text(s,fam="grotesk",wght=700,size=48,x=0,y=0,anchor="start",track=0.0,features=None):
    tt,font=load(fam,wght); upem=tt["head"].unitsPerEm
    buf=hb.Buffer(); buf.add_str(s); buf.guess_segment_properties()
    hb.shape(font,buf,features or {"kern":True,"liga":True})
    gs=tt.getGlyphSet(); order=tt.getGlyphOrder(); sc=size/upem
    pen=SVGPathPen(gs,ntos=lambda v:(f"{v:.2f}".rstrip("0").rstrip(".") or "0")); cx=0; tr=track*upem
    items=list(zip(buf.glyph_infos,buf.glyph_positions))
    total=sum(p.x_advance for _,p in items)+tr*(len(items)-1)
    w=total*sc
    ox={"start":0,"middle":-w/2,"end":-w}[anchor]
    for i,p in items:
        name=order[i.codepoint]
        tp=TransformPen(pen,(sc,0,0,-sc,x+ox+(cx+p.x_offset)*sc,y-p.y_offset*sc))
        gs[name].draw(tp); cx+=p.x_advance+tr
    return pen.getCommands(), w
