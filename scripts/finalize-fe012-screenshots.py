"""Convert captured screenshots and produce a contact sheet and measurements."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

root=Path(__file__).resolve().parents[1]
folder=root/'docs/fe012/screenshots'
rows=json.loads((folder/'metadata.json').read_text(encoding='utf-8'))
for png in folder.glob('*.png'):
    with Image.open(png) as image: image.convert('RGB').save(png.with_suffix('.jpg'),quality=86)
    png.unlink()
for row in rows:
    assert row['scroll'] <= row['client'], 'Horizontal overflow'
    assert all(icon['loaded'] for icon in row['icons']), 'Unloaded SVG'
    with Image.open(folder/row['file']) as image:
        assert abs(image.width-row['client'])<=20
        assert abs(image.height-row['documentHeight'])<=max(20,row['documentHeight']*.05), 'Stale viewport screenshot'
        row['imageWidth'],row['imageHeight']=image.size
states=sorted({r['state'] for r in rows})
sheet=Image.new('RGB',(1200,((len(states)+3)//4)*255),'#e9edf1')
draw=ImageDraw.Draw(sheet)
for i,state in enumerate(states):
    row=next(r for r in rows if r['state']==state and r['requested']==1440)
    with Image.open(folder/row['file']) as image:
        thumb=image.crop((0,0,image.width,min(image.height,1000)))
        thumb.thumbnail((290,220))
        x,y=(i%4)*300,(i//4)*255
        sheet.paste(thumb,(x,y+25));draw.text((x+5,y+5),state,fill='black')
sheet.save(folder/'contact-sheet.jpg',quality=90)
(folder/'metadata.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'screenshots':len(rows),'states':states,'overflow':False,'loadedSVGs':True},indent=2))
