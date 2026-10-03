"""Read-only native window/tray ownership probe for isolated desktop tests."""
import ctypes as c, json, sys
from ctypes import wintypes as w
pid=int(sys.argv[1]);user=c.WinDLL('user32');shell=c.WinDLL('shell32')
user.GetWindowThreadProcessId.argtypes=[w.HWND,c.POINTER(w.DWORD)]
user.GetClassNameW.argtypes=[w.HWND,w.LPWSTR,c.c_int]
user.GetWindowTextW.argtypes=[w.HWND,w.LPWSTR,c.c_int]
user.IsWindowVisible.argtypes=[w.HWND]
class Identifier(c.Structure): _fields_=[('size',w.DWORD),('hwnd',w.HWND),('id',w.UINT),('guid',c.c_byte*16)]
shell.Shell_NotifyIconGetRect.argtypes=[c.POINTER(Identifier),c.POINTER(w.RECT)]
shell.Shell_NotifyIconGetRect.restype=c.c_long
def tray(hwnd,identifier):
 value=Identifier();value.size=c.sizeof(value);value.hwnd=hwnd;value.id=identifier
 rect=w.RECT();hr=shell.Shell_NotifyIconGetRect(c.byref(value),c.byref(rect))
 return {'hwnd':hwnd,'id':identifier,'registered':hr==0,'hresult':hr}
windows=[];icons=[]
@c.WINFUNCTYPE(w.BOOL,w.HWND,w.LPARAM)
def visit(hwnd,_):
 owner=w.DWORD();tid=user.GetWindowThreadProcessId(hwnd,c.byref(owner))
 if owner.value==pid:
  title=c.create_unicode_buffer(512);kind=c.create_unicode_buffer(256)
  user.GetWindowTextW(hwnd,title,len(title));user.GetClassNameW(hwnd,kind,len(kind))
  windows.append({'hwnd':hwnd,'tid':tid,'class':kind.value,'title':title.value,'visible':bool(user.IsWindowVisible(hwnd))})
  if kind.value=='tray_icon_app':
   for identifier in range(16):
    state=tray(hwnd,identifier)
    if state['registered']:icons.append(state)
 return True
user.EnumWindows(visit,0)
known=[tray(int(sys.argv[i]),int(sys.argv[i+1])) for i in range(2,len(sys.argv),2)]
print(json.dumps({'windows':windows,'icons':icons,'knownIcons':known},ensure_ascii=False))
