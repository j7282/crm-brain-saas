from bs4 import BeautifulSoup
import requests
import os

def download_image(url, folder, name):
    response = requests.get(url)
    if response.status_code == 200:
        with open(os.path.join(folder, f'{name}.jpg'), 'wb') as f:
            f.write(response.content)

url = 'https://gob.seminuevosdeoferta.autos/venta-de-seminuevos/'
resp = requests.get(url)
soup = BeautifulSoup(resp.content, 'html.parser')

# Find images. The site likely uses standard img tags or backgrounds.
imgs = soup.find_all('img')

for i, img in enumerate(imgs):
    src = img.get('src')
    if src and src.startswith('http'):
        print(f'Downloading {src}')
        download_image(src, '/Users/ignaciovasquezdias/.gemini/antigravity/playground/primal-spirit/Campana_Meta_Autos', f'auto_{i}')

