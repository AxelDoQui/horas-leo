"""Dibuja el icono de «Horas Leo» (un reloj blanco con el nombre debajo, sobre azul) y lo escribe en todos
los tamaños de Android dentro de android/app/src/main/res.

Uso:  py -I herramientas/hacer_icono.py
Hay que tener Pillow instalado. Después: npx cap sync android y recompilar.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

NOMBRE = "Horas Leo"
# Tipografías en negrita de Windows, por orden de preferencia.
FUENTES = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\verdanab.ttf",
]
AZUL = (31, 111, 235, 255)  # #1F6FEB, el azul de la app
BLANCO = (255, 255, 255, 255)
RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "android", "app", "src", "main", "res")
SUPER = 4  # se dibuja 4 veces más grande y se reduce, para que los bordes salgan suaves

# carpeta -> (lado del icono normal y redondo, lado de la capa adaptativa)
TAMANOS = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def punta(cx, cy, largo, hora12):
    """Punto a `largo` del centro, en la dirección de una hora de reloj (12 = arriba)."""
    ang = math.radians(hora12 * 30 - 90)
    return cx + largo * math.cos(ang), cy + largo * math.sin(ang)


def dibujar_reloj(d, cx, cy, radio):
    """Reloj blanco: aro, cuatro marcas, aguja larga a las 12 y corta a las 4."""
    grosor = radio * 0.16
    d.ellipse([cx - radio, cy - radio, cx + radio, cy + radio], outline=BLANCO, width=round(grosor))
    for h in (12, 3, 6, 9):
        a = punta(cx, cy, radio * 0.74, h)
        b = punta(cx, cy, radio * 0.58, h)
        d.line([a, b], fill=BLANCO, width=round(radio * 0.08))
    ancho = round(radio * 0.12)
    for hora, largo in ((12, 0.58), (4, 0.40)):
        x, y = punta(cx, cy, radio * largo, hora)
        d.line([(cx, cy), (x, y)], fill=BLANCO, width=ancho)
        d.ellipse([x - ancho / 2, y - ancho / 2, x + ancho / 2, y + ancho / 2], fill=BLANCO)
    r = radio * 0.09
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLANCO)


def fuente_de_ancho(ancho):
    """Fuente en negrita con el tamaño justo para que NOMBRE mida `ancho` píxeles."""
    ruta = next((r for r in FUENTES if os.path.exists(r)), None)
    if ruta is None:
        sys.exit("No encuentro ninguna tipografía en negrita en C:\\Windows\\Fonts.")
    prueba = ImageFont.truetype(ruta, 200)
    izq, _, der, _ = prueba.getbbox(NOMBRE)
    return ImageFont.truetype(ruta, max(1, int(200 * ancho / (der - izq))))


def dibujar_contenido(d, g, zona):
    """Reloj arriba y NOMBRE debajo, centrados, ocupando `zona` (fracción del lado) de ancho."""
    ancho = g * zona
    fuente = fuente_de_ancho(ancho)
    izq, arriba, der, abajo = d.textbbox((0, 0), NOMBRE, font=fuente)
    alto_texto = abajo - arriba
    diametro = ancho * 0.60
    hueco = ancho * 0.07
    total = diametro + hueco + alto_texto
    y0 = (g - total) / 2
    dibujar_reloj(d, g / 2, y0 + diametro / 2, diametro / 2)
    x = (g - (der - izq)) / 2 - izq
    y = y0 + diametro + hueco - arriba
    d.text((x, y), NOMBRE, font=fuente, fill=BLANCO)


def lienzo(lado):
    g = lado * SUPER
    im = Image.new("RGBA", (g, g), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im), g


def reducir(im, lado):
    return im.resize((lado, lado), Image.LANCZOS)


def icono_cuadrado(lado):
    im, d, g = lienzo(lado)
    d.rounded_rectangle([0, 0, g - 1, g - 1], radius=g * 0.22, fill=AZUL)
    dibujar_contenido(d, g, 0.78)
    return reducir(im, lado)


def icono_redondo(lado):
    im, d, g = lienzo(lado)
    d.ellipse([0, 0, g - 1, g - 1], fill=AZUL)
    dibujar_contenido(d, g, 0.66)
    return reducir(im, lado)


def capa_adaptativa(lado):
    """Reloj y nombre sobre transparente, dentro de lo que no recorta ninguna máscara
    (círculo de 72 sobre 108; por eso la zona es solo el 48 % del lado)."""
    im, d, g = lienzo(lado)
    dibujar_contenido(d, g, 0.48)
    return reducir(im, lado)


def main():
    for carpeta, (normal, adaptativa) in TAMANOS.items():
        destino = os.path.join(RES, f"mipmap-{carpeta}")
        if not os.path.isdir(destino):
            sys.exit(f"No existe {destino}. ¿Está creado el proyecto Android?")
        icono_cuadrado(normal).save(os.path.join(destino, "ic_launcher.png"))
        icono_redondo(normal).save(os.path.join(destino, "ic_launcher_round.png"))
        capa_adaptativa(adaptativa).save(os.path.join(destino, "ic_launcher_foreground.png"))
        print(f"mipmap-{carpeta}: {normal} px y capa de {adaptativa} px")
    # Fondo de la capa adaptativa: el mismo azul.
    with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#1F6FEB</color>\n</resources>\n')
    print("Fondo adaptativo: #1F6FEB")


if __name__ == "__main__":
    main()
