import os
from PIL import Image, ImageDraw, ImageFont

def process_images(folder_path, text_top, text_bottom):
    if not os.path.exists(folder_path):
        return
        
    for filename in os.listdir(folder_path):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            filepath = os.path.join(folder_path, filename)
            try:
                img = Image.open(filepath)
                
                # Make a square for IG/FB carousels
                width, height = img.size
                new_size = max(width, height)
                new_img = Image.new('RGB', (new_size, new_size), (255, 255, 255))
                new_img.paste(img, ((new_size - width) // 2, (new_size - height) // 2))
                
                draw = ImageDraw.Draw(new_img)
                
                # Draw black banner top
                draw.rectangle([(0, 0), (new_size, new_size * 0.15)], fill=(30, 30, 30, 255))
                
                # We won't use custom fonts to avoid OS issues, we use default UI font if available
                # Instead, we just save the squared images for now and create the banner effect
                draw.text((new_size * 0.1, new_size * 0.05), text_top, fill="white")
                
                # Draw banner at bottom
                draw.rectangle([(0, new_size * 0.85), (new_size, new_size)], fill=(200, 30, 30, 255))
                draw.text((new_size * 0.1, new_size * 0.90), text_bottom, fill="white")
                
                output_path = os.path.join(folder_path, f"edit_{filename}")
                new_img.save(output_path, quality=95)
                print(f"Processed: {filename}")
                
            except Exception as e:
                print(f"Error processing {filename}: {e}")

base_dir = '/Users/ignaciovasquezdias/.gemini/antigravity/playground/primal-spirit/Campana_Meta_Autos'
process_images(os.path.join(base_dir, 'Pickups'), "CAMIONETAS DE TRABAJO", "CRÉDITO DISPONIBLE - ENVÍO A TODO MÉXICO")
process_images(os.path.join(base_dir, 'SUVs'), "FAMILIARES Y SUVs", "MENSUALIDADES CÓMODAS - 2018")
process_images(os.path.join(base_dir, 'Sedanes_Fit'), "OFERTA EN SEDANES", "AUTOS ECONÓMICOS - MÁNDANOS WHATSAPP")
