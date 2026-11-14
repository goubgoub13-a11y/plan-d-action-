"""Embed maintained interface sources in the standalone comparison app."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
p=root/'refonte/index.html'
s=p.read_text()
s=re.sub(r'\n/\* INTERFACE_V2_START \*/.*?/\* INTERFACE_V2_END \*/\n','\n',s,flags=re.S)
s=re.sub(r'\n<style id="interface-v2">.*?</style>','',s,flags=re.S)
s=s.replace('</head>','\n<style id="interface-v2">\n'+(root/'refonte/interface.css').read_text()+'\n</style>\n</head>',1)
s=s.replace('\ninit();\n','\n/* INTERFACE_V2_START */\n'+(root/'refonte/interface.js').read_text()+'\n/* INTERFACE_V2_END */\n\ninit();\n',1)
p.write_text(s)
