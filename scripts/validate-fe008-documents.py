from pathlib import Path
import json,zipfile,hashlib,re,xml.etree.ElementTree as ET
from pypdf import PdfReader
root=Path('docs/fe008/evidence/documents');out={}
for p in root.iterdir():
 b=p.read_bytes();item={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'signature':b[:5].hex()}
 if p.suffix=='.pdf':
  r=PdfReader(p);texts=[page.extract_text() or '' for page in r.pages];item.update(pages=len(texts),pageTextLengths=[len(t) for t in texts],textSample='\n'.join(texts)[:1800]);assert len(texts)>0 and sum(map(len,texts))>200;assert 'FE008' in ''.join(texts)
 else:
  with zipfile.ZipFile(p) as z:
   assert z.testzip() is None;assert '[Content_Types].xml' in z.namelist()
   if p.suffix=='.docx':
    doc=ET.fromstring(z.read('word/document.xml'));text=' '.join(doc.itertext());assert 'FE008' in text;item.update(entries=len(z.namelist()),textLength=len(text),textSample=text[:1800])
   else:
    slides=sorted(n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n));notes=sorted(n for n in z.namelist() if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n));assert len(slides)==5 and len(notes)==5
    size=ET.fromstring(z.read('ppt/presentation.xml')).find('{http://schemas.openxmlformats.org/presentationml/2006/main}sldSz');ratio=int(size.attrib['cx'])/int(size.attrib['cy']);assert abs(ratio-16/9)<.01
    item.update(slides=len(slides),notesSlides=len(notes),ratio=ratio,slideTexts=[' '.join(ET.fromstring(z.read(n)).itertext()) for n in slides],notesTexts=[' '.join(ET.fromstring(z.read(n)).itertext()) for n in notes])
 out[p.name]=item
Path('docs/fe008/evidence/document-validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:{a:b for a,b in v.items() if a in ['bytes','pages','slides','notesSlides','ratio','sha256']} for k,v in out.items()},indent=2))
