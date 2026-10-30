from itertools import combinations
from math import comb
arch=["analyst","trader","researcher","chief-of-staff","inbox-manager","content-creator","sales-sdr","support-triage","recruiter","ops-coordinator","dev-assistant","community-manager","payments-assistant"]
dom=["fintech","crypto","commodities","equities","saas","ecommerce","real-estate","healthcare","legal","media","gaming","education","travel","logistics","creator-economy"]
conn=["gmail","calendar","slack","notion","github","x","market-data","broker","linear","social-scheduler","x-money"]
auto=["read-only","draft-only","approve-to-act","bounded-autonomous"]
markets={"fintech","crypto","commodities","equities"}
valid=0
for a in arch:
  for d in dom:
    for c in combinations(conn,2):
      cs=set(c)
      for ui,u in enumerate(auto):
        if a=="trader" and ("market-data" not in cs or d not in markets): continue  # R1
        if a=="trader" and ui>2: continue                                           # R2
        if "broker" in cs and (a!="trader" or ui>2): continue                       # R3
        if a=="dev-assistant" and "github" not in cs: continue                      # R4
        if a=="inbox-manager" and "gmail" not in cs: continue                       # R4
        if d in {"healthcare","legal"} and ui>1: continue                           # R5
        if a=="payments-assistant" and "x-money" not in cs: continue                # R6
        if "x-money" in cs and a!="payments-assistant": continue                    # R6
        if ("x-money" in cs or a=="payments-assistant") and ui>2: continue          # R7
        valid+=1
indep=10*comb(22,3)*8*6*12
print(13*15*comb(11,2)*4, valid, indep, 13*15*comb(11,2)*4*indep, valid*indep, valid*10*comb(22,3)*8)
# -> 42900 19535 8870400 380540160000 173283264000 2406712000
