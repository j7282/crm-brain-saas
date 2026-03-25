import json
import urllib.request
import urllib.parse
import csv
import os
import time
import ssl

# --- CONFIGURACIÓN EXPERTA (Solución SSL Mac) ---
ssl._create_default_https_context = ssl._create_unverified_context

# --- CONFIGURACIÓN Y CONSTANTES ---

# Usamos la ruta absoluta garantizada
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(BASE_DIR, 'credenciales.csv')
# J7282: Token protegido vía variables de entorno por auditoría de Claude
TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
if not TOKEN:
    print("❌ ERROR: TELEGRAM_BOT_TOKEN no configurado en el entorno.")
    exit(1)
API_URL = f"https://api.telegram.org/bot{TOKEN}"

def load_data():
    records = []
    try:
        if not os.path.exists(CSV_FILE):
             print(f"❌ ERROR: El archivo '{CSV_FILE}' no existe.")
             return []
        
        with open(CSV_FILE, mode='r', encoding='utf-8') as f:
            # Limpiamos posibles espacios en blanco de las líneas
            reader = csv.DictReader(f)
            for row in reader:
                # Normalizamos las llaves a minúsculas y limpiamos valores
                clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
                records.append(clean_row)
        
        print(f"✅ Base de datos cargada: {len(records)} registros desde {CSV_FILE}")
        if records:
            print(f"DEBUG: Cabeceras detectadas: {list(records[0].keys())}")
    except Exception as e:
        print(f"❌ Error al cargar CSV: {e}")
    return records

def format_result(record):
    return (
        f"👤 Nombre: {record.get('nombre', 'Sin información')}\n\n"
        f"🌐 Red: {record.get('red_social', 'Sin información')}\n\n"
        f"👤 Usuario: {record.get('usuario', 'Sin información')}\n\n"
        f"🔑 Password: {record.get('password', 'Sin información')}\n\n"
        f"📧 Email: {record.get('email', 'Sin información')}"
    )

def send_telegram_request(method, data=None):
    url = f"{API_URL}/{method}"
    headers = {'Content-Type': 'application/json'}
    try:
        req_data = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=req_data, headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"⚠️ Red '{method}': {e}")
        return None

def handle_message(message):
    text = message.get('text', '').strip()
    chat_id = message['chat']['id']
    if not text: return
    
    parts = text.split(maxsplit=1)
    command = parts[0].lower()
    value = parts[1].strip().lower() if len(parts) > 1 else ""
    
    if command in ['/start', '/help', '/ayuda']:
        help_text = "🔎 `/id <valor>`\n🔎 `/nombre <valor>`\n🔎 `/usuario <valor>`\n🔎 `/red <valor>`"
        send_telegram_request('sendMessage', {'chat_id': chat_id, 'text': help_text})
        return
        
    records = load_data()
    results = []
    
    # Búsqueda ultra-robusta normalizando valores
    for r in records:
        if command == '/id' and r.get('id') == value:
            results.append(r)
        elif command == '/nombre' and value in r.get('nombre', '').lower():
            results.append(r)
        elif command == '/usuario' and r.get('usuario', '').lower() == value:
            results.append(r)
        elif command == '/red' and r.get('red_social', '').lower() == value:
            results.append(r)
            
    if not results:
        send_telegram_request('sendMessage', {'chat_id': chat_id, 'text': "❌ Sin resultados."})
    else:
        for res in results:
            send_telegram_request('sendMessage', {'chat_id': chat_id, 'text': format_result(res)})

def start_polling():
    last_update_id = 0
    print("-" * 50)
    print("🚀 BOT DE CREDENCIALES (MODO EXPERTO) ACTIVADO")
    print(f"📡 Cargando desde: {CSV_FILE}")
    print("Estado: ONLINE")
    print("-" * 50)
    while True:
        try:
            updates = send_telegram_request('getUpdates', {'offset': last_update_id + 1, 'timeout': 30})
            if updates and updates.get('ok') and updates.get('result'):
                for update in updates['result']:
                    last_update_id = update['update_id']
                    if 'message' in update: handle_message(update['message'])
        except Exception as e:
            print(f"⚠️ Error: {e}")
            time.sleep(5)

if __name__ == '__main__':
    start_polling()
