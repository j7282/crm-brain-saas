import requests
from bs4 import BeautifulSoup
import os
import urllib.parse

url = 'https://gob.seminuevosdeoferta.autos/venta-de-seminuevos/'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

try:
    resp = requests.get(url, headers=headers)
    soup = BeautifulSoup(resp.content, 'html.parser')
    imgs = soup.find_all('img')
    
    downloaded = 0
    for img in imgs:
        src = img.get('src')
        if src:
            full_url = urllib.parse.urljoin(url, src)
            
            folder = 'Sedanes_Fit'
            lower_url = full_url.lower()
            if any(k in lower_url for k in ['np300', 'colorado', 'silverado', 'tacoma', 'f-150', 'f150', 'pickup']):
                folder = 'Pickups'
            elif any(k in lower_url for k in ['crv', 'cr-v', 'rav4', 'sienna', 'explorer', 'journey', 'sorento', 'equinox', 'cx-5', 'cx5', 'suv', 'highlander']):
                folder = 'SUVs'
                
            filename = full_url.split('/')[-1].split('?')[0]
            if not filename.endswith(('.jpg', '.png', '.jpeg', '.webp')):
                filename += '.jpg'
            
            save_path = os.path.join('/Users/ignaciovasquezdias/.gemini/antigravity/playground/primal-spirit/Campana_Meta_Autos', folder, filename)
            
            try:
                img_resp = requests.get(full_url, headers=headers)
                if img_resp.status_code == 200:
                    with open(save_path, 'wb') as f:
                        f.write(img_resp.content)
                    print(f'Downloaded {filename} to {folder}')
                    downloaded += 1
            except Exception as e:
                print(f'Failed to download {full_url}: {e}')
                
    print(f'\nTotal images downloaded: {downloaded}')
except Exception as e:
    print(f'Error: {e}')
