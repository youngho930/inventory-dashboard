from flask import Flask, render_template, jsonify, request, send_file, make_response, session, send_from_directory
import requests
from datetime import datetime, timedelta, timezone
import json
import os
import time
import zipfile
import io
import math
import hashlib

try:
    from dotenv import load_dotenv
    load_dotenv()   # .env 파일이 있으면 환경변수로 읽어들임
except ImportError:
    pass

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', os.urandom(24).hex())

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 이카운트 ERP OpenAPI 접속 정보 — 값은 환경변수(.env)에서 읽어옵니다.
# .env.example 을 복사해 .env 로 만들고 실제 값을 채워 사용하세요.
ECNT_CONF = {
    "COM_CODE": os.environ.get("ECOUNT_COM_CODE", ""),
    "USER_ID": os.environ.get("ECOUNT_USER_ID", ""),
    "API_CERT_KEY": os.environ.get("ECOUNT_API_CERT_KEY", ""),
    "ZONE": os.environ.get("ECOUNT_ZONE", "CA"),
}

# 데모 모드 — ERP 접속 정보가 없으면 자동으로 켜집니다.
# 실제 API를 호출하지 않고 demo_inventory.json 의 예시 재고를 반환합니다.
DEMO_MODE = (
    os.environ.get("DEMO_MODE", "").lower() == "true"
    or not ECNT_CONF["API_CERT_KEY"]
)
DEMO_INVENTORY_FILE = 'demo_inventory.json' 

def _hash_pw(raw: str) -> str:
    """비밀번호는 평문으로 보관하지 않고 SHA-256 해시로 비교합니다."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# 관리자 계정 — 아이디/비밀번호는 환경변수로 주입 (기본값은 로컬 데모용)
USERS = {
    os.environ.get("ADMIN_ID", "admin"): {
        "pw_hash": _hash_pw(os.environ.get("ADMIN_PW", "changeme")),
        "name": "시스템 관리자",
        "role": "admin",
    }
}

BOARD_FILE = 'board_posts.json'
LOG_FILE = 'production_log.json'
SYSTEM_LOG_FILE = 'system_audit_log.json'
CALENDAR_FILE = 'calendar_events.json'
HISTORY_FILE = 'production_history.json'
MEMO_FILE = 'item_memos.json'
DDAY_FILE = 'dday_list.json'
NOTICE_FILE = 'notice_list.json'
PROD_RECORD_FILE = 'production_records.json'
PART_PRICE_FILE = 'part_prices.json'
BOM_FILE = 'bom_data.json'
INCOMING_FILE = 'incoming_history.json'
ARCHIVE_META_FILE = 'archive_meta.json'
DEFECT_FILE = 'defect_records.json'
SUPPLIER_FILE = 'suppliers.json'
KPI_FILE = 'kpi_settings.json' # 👈 KPI 설정 파일 저장소 추가

server_session = { "id": None, "last_login": None }
global_last_data = None 

def is_admin(): return session.get('is_admin', False)
def get_user_name(): return session.get('user_name', '알수없음')

def load_json(path, default_type=list):
    if not os.path.exists(path):
        with open(path, 'w', encoding='utf-8') as f: json.dump([] if default_type is list else {}, f)
    try:
        with open(path, 'r', encoding='utf-8') as f: return json.load(f)
    except: return [] if default_type is list else {}

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=4)

def get_file_size(size_bytes):
    if size_bytes == 0: return "0B"
    size_name = ("B", "KB", "MB", "GB", "TB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    return f"{round(size_bytes / p, 2)} {size_name[i]}"

def auto_system_log(title, content):
    data = load_json(SYSTEM_LOG_FILE)
    log = {
        "id": int(datetime.now().timestamp()*1000),
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "title": title,
        "content": content,
        "writer": get_user_name() or "시스템"
    }
    data.insert(0, log)
    save_json(SYSTEM_LOG_FILE, data)

def sync_to_ecount(action_type, data):
    sid = get_valid_session()
    if not sid: return False
    print(f"\n[이카운트 양방향 동기화 시도] 작업: {action_type}")
    return True

def login_ecount():
    if DEMO_MODE:
        return None
    try:
        url = f"https://oapi{ECNT_CONF['ZONE']}.ecount.com/OAPI/V2/OAPILogin"
        payload = {"COM_CODE": ECNT_CONF["COM_CODE"], "USER_ID": ECNT_CONF["USER_ID"], "API_CERT_KEY": ECNT_CONF["API_CERT_KEY"], "LAN_TYPE": "ko-KR", "ZONE": ECNT_CONF["ZONE"]}
        res = requests.post(url, json=payload, timeout=15).json()
        if str(res.get("Status")) != "200": return None
        new_sid = res["Data"]["Datas"]["SESSION_ID"]
        server_session["id"] = new_sid; server_session["last_login"] = datetime.now()
        return new_sid
    except: return None

def get_valid_session(force_renew=False):
    if force_renew or not server_session["id"] or not server_session["last_login"]: return login_ecount()
    if datetime.now() - server_session["last_login"] > timedelta(minutes=50): return login_ecount()
    return server_session["id"]

@app.route('/')
def index(): return render_template('dashboard.html')

@app.route('/manifest.json')
def serve_manifest():
    return jsonify({ "name": "PANAXTOS Inventory", "short_name": "재고관리", "start_url": "/", "display": "standalone", "background_color": "#f8f9fa", "theme_color": "#4361ee", "icons": [ { "src": "/static/logo.png", "sizes": "192x192", "type": "image/png" } ] })

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    uid = request.json.get('user_id', '').strip()
    pw = request.json.get('password', '').strip()
    if uid in USERS and USERS[uid]['pw_hash'] == _hash_pw(pw):
        session['is_admin'] = True; session['user_id'] = uid; session['user_name'] = USERS[uid]['name']; session['role'] = USERS[uid]['role']
        auto_system_log("접속 기록", f"시스템에 로그인했습니다.")
        return jsonify({"status": "success", "role": session['role'], "name": session['user_name']})
    return jsonify({"status": "fail", "message": "아이디 또는 비밀번호 오류"}), 401

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout(): 
    name = session.get('user_name', '')
    if name: auto_system_log("로그아웃", f"시스템에서 로그아웃했습니다.")
    session.clear(); return jsonify({"status": "success"})

@app.route('/api/auth/check', methods=['GET'])
def auth_check(): return jsonify({"is_admin": is_admin(), "name": get_user_name(), "role": session.get('role', ''), "demo": DEMO_MODE})

@app.route('/api/inventory')
def get_inventory():
    global global_last_data
    kst_now = datetime.now(timezone.utc) + timedelta(hours=9)

    if DEMO_MODE:
        # ERP 접속 정보가 없을 때도 화면을 확인할 수 있도록 예시 재고를 반환합니다.
        result_data = {
            "status": "success",
            "items": load_json(DEMO_INVENTORY_FILE),
            "update_time": kst_now.strftime("%Y-%m-%d %H:%M:%S"),
            "demo": True,
        }
        global_last_data = result_data
        resp = make_response(jsonify(result_data))
        resp.headers['Cache-Control'] = 'no-store'
        return resp

    for attempt in range(3):
        try:
            sid = get_valid_session(force_renew=(attempt > 0))
            if not sid: raise Exception("Login Failed")
            kst_now = datetime.now(timezone.utc) + timedelta(hours=9)
            all_items = []; current_page = 1
            while True:
                payload = {"BASE_DATE": kst_now.strftime("%Y%m%d"), "LAN_TYPE": "ko-KR", "INC_ZERO_BAL": "Y", "INC_NO_RESULT": "Y", "ZERO_QTY_YN": "Y", "PAGE_SIZE": 1000, "PAGE_CURRENT_NO": current_page}
                url = f"https://oapi{ECNT_CONF['ZONE']}.ecount.com/OAPI/V2/InventoryBalance/GetListInventoryBalanceStatusByLocation?SESSION_ID={sid}"
                res_inv = requests.post(url, json=payload, timeout=15).json()
                if str(res_inv.get("Status")) != "200": 
                    if current_page > 1: break
                    raise Exception(res_inv.get("Errors"))
                items = res_inv.get("Data", {}).get("Result", [])
                if not items: break
                all_items.extend(items); current_page += 1
                if len(items) < 1000: break
                
            result_data = { "status": "success", "items": all_items, "update_time": kst_now.strftime("%Y-%m-%d %H:%M:%S") }
            global_last_data = result_data
            resp = make_response(jsonify(result_data)); resp.headers['Cache-Control'] = 'no-store'; return resp
        except Exception as e: 
            if attempt < 2: time.sleep(1)
    if global_last_data: return jsonify(global_last_data)
    return jsonify({"status": "error"}), 500

@app.route('/api/item_master')
def get_item_master(): return jsonify({"status": "success", "items": global_last_data["items"] if global_last_data else []})

@app.route('/api/backup', methods=['GET'])
def download_backup():
    if not is_admin(): return "Unauthorized", 401
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in [LOG_FILE, SYSTEM_LOG_FILE, CALENDAR_FILE, HISTORY_FILE, MEMO_FILE, DDAY_FILE, NOTICE_FILE, BOARD_FILE, PROD_RECORD_FILE, PART_PRICE_FILE, BOM_FILE, INCOMING_FILE, ARCHIVE_META_FILE, DEFECT_FILE, SUPPLIER_FILE, KPI_FILE]:
            if os.path.exists(f): zf.write(f)
    memory_file.seek(0)
    auto_system_log("데이터 백업", f"전체 데이터를 백업(다운로드)했습니다.")
    return send_file(memory_file, download_name=f"backup_{datetime.now().strftime('%Y%m%d')}.zip", as_attachment=True)

@app.route('/api/system_log', methods=['GET'])
def get_system_log():
    if not is_admin(): return jsonify([]), 401
    return jsonify(load_json(SYSTEM_LOG_FILE))

@app.route('/api/incoming', methods=['GET', 'POST', 'DELETE'])
def manage_incoming():
    if request.method == 'GET': return jsonify(load_json(INCOMING_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(INCOMING_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
            auto_system_log("입고 수정", f"입고 내역을 수정했습니다. ({item['product']})")
        else:
            item['id'] = int(datetime.now().timestamp() * 1000); data.insert(0, item)
            auto_system_log("신규 입고", f"{item['product']} {item['qty']}개를 입고 처리했습니다.")
            sync_to_ecount("입고등록", item) 
    elif request.method == 'DELETE': 
        data = [d for d in data if d['id'] != request.args.get('id', type=int)]
        auto_system_log("데이터 삭제", f"입고 내역을 삭제했습니다.")
    save_json(INCOMING_FILE, data); return jsonify({"status": "success"})

@app.route('/api/production_record', methods=['GET', 'POST', 'DELETE'])
def manage_production_record():
    if request.method == 'GET': return jsonify(load_json(PROD_RECORD_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(PROD_RECORD_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
            auto_system_log("생산 수정", f"생산 내역을 수정했습니다. ({item['name']})")
        else:
            item['id'] = int(datetime.now().timestamp() * 1000); data.insert(0, item)
            auto_system_log("완제품 생산", f"{item['name']} {item['qty']}대를 생산 등록했습니다.")
            sync_to_ecount("생산입고", item) 
    elif request.method == 'DELETE': 
        data = [d for d in data if d['id'] != request.args.get('id', type=int)]
        auto_system_log("데이터 삭제", f"생산 내역을 삭제했습니다.")
    save_json(PROD_RECORD_FILE, data); return jsonify({"status": "success"})

@app.route('/api/bom', methods=['GET', 'POST', 'DELETE'])
def manage_bom():
    if request.method == 'GET': return jsonify(load_json(BOM_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(BOM_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
        else: item['id'] = int(datetime.now().timestamp() * 1000); data.append(item)
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(BOM_FILE, data); return jsonify({"status": "success"})

@app.route('/api/part_price', methods=['GET', 'POST', 'DELETE'])
def manage_part_price():
    if request.method == 'GET': return jsonify(load_json(PART_PRICE_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(PART_PRICE_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
            auto_system_log("단가 수정", f"{item['name']}의 구매 단가를 수정했습니다.")
        else:
            item['id'] = int(datetime.now().timestamp() * 1000); data.insert(0, item)
            auto_system_log("단가 등록", f"{item['name']}의 구매 단가를 {item['price']}원으로 기록했습니다.")
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(PART_PRICE_FILE, data); return jsonify({"status": "success"})

@app.route('/api/board', methods=['GET', 'POST', 'DELETE'])
def manage_board():
    if request.method == 'GET': return jsonify(load_json(BOARD_FILE))
    data = load_json(BOARD_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']: 
            if not is_admin(): return jsonify({"status":"fail"}), 401
            for i, d in enumerate(data):
                if d['id'] == item['id']: 
                    data[i]['title'] = item['title']
                    data[i]['author'] = item['author']
                    data[i]['team'] = item.get('team', '')
                    data[i]['content'] = item['content']
                    break
        else: 
            item['id'] = int(datetime.now().timestamp() * 1000)
            item['date'] = datetime.now().strftime("%Y-%m-%d %H:%M")
            data.insert(0, item)
    elif request.method == 'DELETE':
        if not is_admin(): return jsonify({"status":"fail"}), 401
        data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(BOARD_FILE, data); return jsonify({"status": "success"})

@app.route('/api/archive', methods=['GET', 'POST', 'DELETE'])
def manage_archive():
    meta_data = load_json(ARCHIVE_META_FILE)
    if request.method == 'GET':
        existing_files = {item.get('filename') for item in meta_data}
        needs_save = False
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            # .gitkeep 등 숨김 파일은 자료실 목록에 노출하지 않음
            if filename.startswith('.'):
                continue
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(filepath) and filename not in existing_files:
                stat = os.stat(filepath)
                meta_data.append({"id": int(stat.st_mtime * 1000) + hash(filename) % 1000, "title": "기존 파일 (미분류)", "filename": filename, "original_name": filename, "size": get_file_size(stat.st_size), "date": datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M')})
                needs_save = True
        if needs_save: meta_data.sort(key=lambda x: x['date'], reverse=True); save_json(ARCHIVE_META_FILE, meta_data)
        return jsonify(meta_data)
        
    if not is_admin(): return jsonify({"status": "fail"}), 401
    if request.method == 'POST':
        if 'file' not in request.files: return jsonify({"status": "fail"}), 400
        file = request.files['file']; title = request.form.get('title', '제목 없음')
        if file.filename == '': return jsonify({"status": "fail"}), 400
        timestamp = int(datetime.now().timestamp() * 1000); safe_filename = f"{timestamp}_{file.filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename); file.save(filepath); stat = os.stat(filepath)
        meta_data.insert(0, {"id": timestamp, "title": title, "filename": safe_filename, "original_name": file.filename, "size": get_file_size(stat.st_size), "date": datetime.now().strftime('%Y-%m-%d %H:%M')})
        save_json(ARCHIVE_META_FILE, meta_data)
        auto_system_log("자료실 업로드", f"'{file.filename}' 파일을 업로드했습니다.")
        return jsonify({"status": "success"})
        
    if request.method == 'DELETE':
        item_id = request.args.get('id', type=int)
        item = next((x for x in meta_data if x.get('id') == item_id), None)
        if item:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], item['filename'])
            if os.path.exists(filepath): os.remove(filepath)
            meta_data = [x for x in meta_data if x.get('id') != item_id]
            save_json(ARCHIVE_META_FILE, meta_data)
            return jsonify({"status": "success"})
        return jsonify({"status": "fail"}), 400

@app.route('/uploads/<path:filename>')
def download_file(filename): return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/memo', methods=['GET', 'POST'])
def manage_memo():
    if request.method == 'GET': return jsonify(load_json(MEMO_FILE, dict))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = request.json; memos = load_json(MEMO_FILE, dict); memos[data.get('code')] = data.get('text'); save_json(MEMO_FILE, memos); return jsonify({"status": "success"})

@app.route('/api/dday', methods=['GET', 'POST', 'DELETE'])
def manage_dday():
    if request.method == 'GET': return jsonify(load_json(DDAY_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(DDAY_FILE)
    if request.method == 'POST': item = request.json; item['id'] = int(datetime.now().timestamp()*1000); data.append(item)
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(DDAY_FILE, data); return jsonify({"status": "success"})

@app.route('/api/notice', methods=['GET', 'POST', 'DELETE'])
def manage_notice():
    if request.method == 'GET': return jsonify(load_json(NOTICE_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(NOTICE_FILE)
    if request.method == 'POST': item = request.json; item['id'] = int(datetime.now().timestamp()*1000); data.insert(0, item)
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(NOTICE_FILE, data); return jsonify({"status": "success"})

@app.route('/api/history', methods=['GET', 'POST', 'DELETE'])
def manage_history():
    if request.method == 'GET': return jsonify(load_json(HISTORY_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(HISTORY_FILE)
    if request.method == 'POST': item = request.json; item['id'] = int(datetime.now().timestamp()*1000); data.insert(0, item)
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(HISTORY_FILE, data); return jsonify({"status": "success"})

@app.route('/api/log', methods=['GET', 'POST', 'DELETE'])
def manage_log():
    if request.method == 'GET': return jsonify(load_json(LOG_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401 
    data = load_json(LOG_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']: 
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i]['type'] = item['type']; data[i]['date'] = item['date']; data[i]['title'] = item['title']; data[i]['content'] = item['content']; data[i]['writer'] = item.get('writer', ''); break
        else: item['id'] = int(datetime.now().timestamp()); data.insert(0, item)
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(LOG_FILE, data); return jsonify({"status": "success"})

@app.route('/api/calendar', methods=['GET', 'POST', 'DELETE'])
def manage_calendar():
    if request.method == 'GET': return jsonify(load_json(CALENDAR_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(CALENDAR_FILE)
    if request.method == 'POST': item = request.json; item['id'] = int(datetime.now().timestamp()*1000); data.append(item)
    elif request.method == 'DELETE': data = [d for d in data if d['id'] != request.args.get('id', type=int)]
    save_json(CALENDAR_FILE, data); return jsonify({"status": "success"})

@app.route('/api/defect', methods=['GET', 'POST', 'DELETE'])
def manage_defect():
    if request.method == 'GET': return jsonify(load_json(DEFECT_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    data = load_json(DEFECT_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
            auto_system_log("불량/폐기 수정", f"폐기 내역을 수정했습니다. ({item['name']})")
        else:
            item['id'] = int(datetime.now().timestamp() * 1000)
            data.insert(0, item)
            auto_system_log("불량/폐기 등록", f"{item['name']} {item['qty']}개 폐기 (손실액: {item['totalCost']}원)")
    elif request.method == 'DELETE':
        data = [d for d in data if d['id'] != request.args.get('id', type=int)]
        auto_system_log("데이터 삭제", f"불량/폐기 내역을 삭제했습니다.")
    save_json(DEFECT_FILE, data)
    return jsonify({"status": "success"})

@app.route('/api/supplier', methods=['GET', 'POST', 'DELETE'])
def manage_supplier():
    if request.method == 'GET': return jsonify(load_json(SUPPLIER_FILE))
    if not is_admin(): return jsonify({"status":"fail"}), 401
    
    data = load_json(SUPPLIER_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
            auto_system_log("협력업체 수정", f"업체 정보를 수정했습니다. ({item['name']})")
        else:
            item['id'] = int(datetime.now().timestamp() * 1000)
            data.insert(0, item)
            auto_system_log("협력업체 등록", f"신규 업체 {item['name']} 등록")
    elif request.method == 'DELETE':
        data = [d for d in data if d['id'] != request.args.get('id', type=int)]
        auto_system_log("데이터 삭제", f"협력업체 정보를 삭제했습니다.")
        
    save_json(SUPPLIER_FILE, data)
    return jsonify({"status": "success"})

# 🚀 [핵심 추가] KPI 동적 관리 API
@app.route('/api/kpi', methods=['GET', 'POST', 'DELETE'])
def manage_kpi():
    if request.method == 'GET':
        data = load_json(KPI_FILE)
        if not data:
            data = [
                {"id": 1, "name": "S26 밴드", "code": "FP-105", "safe_qty": 100, "img": "s26.png"},
                {"id": 2, "name": "MW 키오스크", "code": "MM-027", "safe_qty": 10, "img": "mw.png"}
            ]
            save_json(KPI_FILE, data)
        return jsonify(data)
    
    if not is_admin(): return jsonify({"status":"fail"}), 401
    
    data = load_json(KPI_FILE)
    if request.method == 'POST':
        item = request.json
        if 'id' in item and item['id']:
            for i, d in enumerate(data):
                if d['id'] == item['id']: data[i] = item; break
            auto_system_log("KPI 설정 변경", f"대시보드 KPI 품목({item['name']})을 수정했습니다.")
        else:
            item['id'] = int(datetime.now().timestamp() * 1000)
            data.append(item)
            auto_system_log("KPI 설정 추가", f"대시보드 KPI 품목({item['name']})을 추가했습니다.")
    elif request.method == 'DELETE':
        data = [d for d in data if d['id'] != request.args.get('id', type=int)]
        auto_system_log("KPI 설정 삭제", f"대시보드 KPI 품목을 삭제했습니다.")
        
    save_json(KPI_FILE, data)
    return jsonify({"status": "success"})

@app.route('/sw.js')
def serve_sw():
    sw_content = """
    self.addEventListener('install', event => { self.skipWaiting(); });
    self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });
    self.addEventListener('fetch', event => { event.respondWith(fetch(event.request)); });
    """
    resp = make_response(sw_content)
    resp.headers['Content-Type'] = 'application/javascript'
    resp.headers['Cache-Control'] = 'no-store'
    return resp

if __name__ == '__main__':
    from waitress import serve
    print("=====================================================")
    print("🚀 실서비스용 대시보드 서버가 가동되었습니다!")
    print("🌐 접속 주소: http://127.0.0.1:2580")
    print("=====================================================")
    serve(app, host='127.0.0.1', port=2580, threads=16)
