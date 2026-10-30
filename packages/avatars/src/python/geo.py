import math
from shapely.geometry import Point, Polygon, LineString, box
from shapely.ops import unary_union
from shapely import affinity
def f(v): return f"{v:.2f}".rstrip("0").rstrip(".")
def d_of(g):
    gs=[g] if g.geom_type=="Polygon" else list(g.geoms); out=[]
    for p in gs:
        for ring in [p.exterior]+list(p.interiors):
            pts=list(ring.coords)[:-1]; out.append("M"+" L".join(f"{f(x)} {f(y)}" for x,y in pts)+"Z")
    return "".join(out)
def circle(cx,cy,r): return Point(cx,cy).buffer(r,resolution=64)
def ell(cx,cy,rx,ry,rot=0):
    e=affinity.scale(Point(cx,cy).buffer(1,resolution=96),rx,ry)
    return affinity.rotate(e,rot,origin=(cx,cy)) if rot else e
def roundc(g,r): return g.buffer(-r,resolution=32).buffer(r,resolution=32)
def roundv(g,r): return g.buffer(r,resolution=32).buffer(-r,resolution=32)
def stroke(pts,w): return LineString(pts).buffer(w/2,resolution=32)
def bez(p0,c,p1,n=40):
    return [((1-t)**2*p0[0]+2*(1-t)*t*c[0]+t*t*p1[0],(1-t)**2*p0[1]+2*(1-t)*t*c[1]+t*t*p1[1]) for t in [i/n for i in range(n+1)]]
def cbez(p0,c1,c2,p1,n=48):
    o=[]
    for i in range(n+1):
        t=i/n; a=(1-t)**3; b=3*(1-t)**2*t; c=3*(1-t)*t*t; d=t**3
        o.append((a*p0[0]+b*c1[0]+c*c2[0]+d*p1[0], a*p0[1]+b*c1[1]+c*c2[1]+d*p1[1]))
    return o
def taper(path,r0,r1):
    n=len(path)-1; cs=[Point(*path[i]).buffer(r0+(r1-r0)*i/n,resolution=24) for i in range(n+1)]
    return unary_union([cs[i].union(cs[i+1]).convex_hull for i in range(n)])
def capsule(cx,cy,w,h,rot=0):
    g=LineString([(cx,cy-h/2+w/2),(cx,cy+h/2-w/2)]).buffer(w/2,resolution=32)
    return affinity.rotate(g,rot,origin=(cx,cy)) if rot else g
def mirror(g,x=128): return affinity.scale(g,xfact=-1,origin=(x,0))
