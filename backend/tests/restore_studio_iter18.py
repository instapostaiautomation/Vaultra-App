# Restores App Studio seed state after iteration-18 tests (J1 blank, J2 "Patel Gold" theme_selected)
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("/app/backend/.env")
eng = create_engine(os.environ["DATABASE_URL_SYNC"])
with eng.begin() as c:
    c.execute(text("UPDATE jewellers SET app_name='', bundle_id='', theme_preset='', logo_url='', splash_url='', app_status='details_pending', support_email='', store_short='', store_long='', store_keywords='', app_version='1.0.0' WHERE id='demo-jeweller-001'"))
    c.execute(text("UPDATE jewellers SET app_name='Patel Gold', bundle_id='in.pateljewelleryhouse.gold', theme_preset='emerald_heritage', logo_url='', splash_url='', app_status='theme_selected', support_email='', store_short='', store_long='', store_keywords='', app_version='1.0.0' WHERE id='demo-jeweller-002'"))
    for r in c.execute(text("SELECT id, app_name, bundle_id, theme_preset, logo_url, app_status FROM jewellers ORDER BY id")):
        print(r)
