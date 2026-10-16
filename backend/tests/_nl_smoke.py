import os,re,time,uuid,httpx,asyncio
from dotenv import load_dotenv; load_dotenv('/app/backend/.env')
from motor.motor_asyncio import AsyncIOMotorClient
API=open('/app/frontend/.env').read().split('REACT_APP_BACKEND_URL=')[1].split()[0].strip('"')+'/api'
cred=open('/app/memory/test_credentials.md').read()
email=re.search(r'Email:\s*`?([^\s`]+)',cred).group(1); pw=re.search(r'Password:\s*`?([^\s`]+)',cred).group(1)
d=AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]
P='fictif-nl-'
async def main():
    now='2026-06-01T10:00:00+00:00'
    docs=[dict(id=P+'ok1',email=P+'ok1@exemple-fictif.fr',status='subscribed',consent=True,consent_at=now,consent_text_version='newsletter-v1-2026-06',unsubscribe_token=P+'tok1',created_at=now),
          dict(id=P+'ok2',email=P+'ok2@exemple-fictif.fr',status='subscribed',consent=True,consent_at=now,consent_text_version='newsletter-v1-2026-06',unsubscribe_token=P+'tok2',created_at=now),
          dict(id=P+'unsub',email=P+'unsub@exemple-fictif.fr',status='unsubscribed',consent=False,consent_at=now,consent_text_version='newsletter-v1-2026-06',unsubscribe_token=P+'tok3',created_at=now),
          dict(id=P+'legacy',email=P+'legacy@exemple-fictif.fr',consent=True,confirmed=False,unsubscribe_token=P+'tok4',created_at=now)]
    await d.newsletter.delete_many({'id':{'$regex':'^'+P}})
    for x in docs: await d.newsletter.insert_one(x)
    c=httpx.Client(timeout=30); tok=c.post(API+'/admin/login',json={'email':email,'password':pw}).json()['access_token']; h={'Authorization':'Bearer '+tok}
    print('noauth', c.get(API+'/admin/newsletter').status_code)
    subs={s['id']:s for s in c.get(API+'/admin/newsletter',headers=h).json() if s['id'].startswith(P)}
    print({k:(v['eligible'],v['ineligible_reason']) for k,v in subs.items()})
    print('settings',c.get(API+'/admin/newsletter/settings',headers=h).json())
    body="Bonjour,\n\nNouveautés :\n- Budget https://la-maison-dauben.com/boutique.\n- <script>x</script>"
    pv=c.post(API+'/admin/newsletter/preview',headers=h,json={'subject':'Test','body':body}).json()['html']
    print('preview ok', '<ul' in pv, '&lt;script&gt;' in pv, 'desinscription?token=' in pv, 'SIRET' in pv)
    print('bad confirm', c.post(API+'/admin/newsletter/send',headers=h,json={'subject':'S','body':'B','recipient_ids':[P+'ok1'],'confirmation':'oui'}).status_code)
    print('only inelig', c.post(API+'/admin/newsletter/send',headers=h,json={'subject':'S','body':'B','recipient_ids':[P+'unsub',P+'legacy'],'confirmation':'ENVOYER'}).status_code)
    print('mark test', c.patch(API+f'/admin/newsletter/{P}ok2',headers=h,json={'is_test':True}).status_code)
    r=c.post(API+'/admin/newsletter/send',headers=h,json={'subject':'Smoke','body':'Bonjour','recipient_ids':[P+'ok1',P+'ok2',P+'unsub'],'confirmation':'ENVOYER'}).json(); print('send',r)
    time.sleep(2)
    camp=[x for x in c.get(API+'/admin/newsletter/campaigns',headers=h).json() if x['id']==r['campaign_id']][0]
    print('campaign',camp['status'],camp['counts'],[ (x['email'],x['status']) for x in camp['results']])
    print('remove', c.delete(API+f'/admin/newsletter/{P}ok1',headers=h).status_code)
    print('after remove send', c.post(API+'/admin/newsletter/send',headers=h,json={'subject':'S','body':'B','recipient_ids':[P+'ok1'],'confirmation':'ENVOYER'}).status_code)
    doc=await d.newsletter.find_one({'id':P+'ok1'}); print('proof kept', doc['consent_at'], doc['removed'])
    await d.newsletter.delete_many({'id':{'$regex':'^'+P}}); await d.newsletter_campaigns.delete_one({'id':r['campaign_id']}); print('cleaned')
asyncio.run(main())
