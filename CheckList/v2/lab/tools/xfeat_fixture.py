# Renders perspective views from a synthetic equirectangular panorama at
# KNOWN rotations and focal length, runs the real XFeat ONNX model on each,
# and dumps raw outputs for the JS post-processing to consume.
# This lets the browser pipeline be validated end-to-end without a browser.
import numpy as np, onnxruntime as ort, json, os, struct

OUT = os.environ.get('XFEAT_FIXTURE_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.fixture')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

# ---- synthetic equirect panorama with plenty of corner structure ----
EH, EW = 1024, 2048
pano = np.zeros((EH, EW, 3), np.float32)
# base texture
base = rng.random((EH // 16, EW // 16, 3)).astype(np.float32)
pano = np.repeat(np.repeat(base, 16, axis=0), 16, axis=1)[:EH, :EW]
# high-frequency detail so descriptors have something to bite on
pano = 0.55 * pano + 0.45 * rng.random((EH, EW, 3)).astype(np.float32)
# rectangles and bars -> strong corners
for _ in range(900):
    h = rng.integers(8, 60); w = rng.integers(8, 90)
    y = rng.integers(0, EH - h); x = rng.integers(0, EW - w)
    pano[y:y+h, x:x+w] = rng.random(3).astype(np.float32)
for _ in range(400):
    y = rng.integers(0, EH - 4); x = rng.integers(0, EW - 200)
    pano[y:y+rng.integers(2, 5), x:x+rng.integers(40, 200)] = rng.random(3).astype(np.float32)
pano = np.clip(pano, 0, 1)

def basis(yaw, pitch, roll):
    fwd = np.array([np.sin(yaw)*np.cos(pitch), np.cos(yaw)*np.cos(pitch), np.sin(pitch)])
    wu = np.array([0.0, 0.0, 1.0])
    r0 = np.array([1.0,0,0]) if abs(fwd[2]) > 0.999 else np.cross(fwd, wu)
    r0 = r0/np.linalg.norm(r0)
    u0 = np.cross(r0, fwd); u0 = u0/np.linalg.norm(u0)
    cr, sr = np.cos(roll), np.sin(roll)
    right = r0*cr - u0*sr; up = u0*cr + r0*sr
    return right/np.linalg.norm(right), up/np.linalg.norm(up), fwd

def render(yaw, pitch, roll, W, H, focal):
    right, up, fwd = basis(yaw, pitch, roll)
    xs = (np.arange(W) + 0.5 - W/2) / focal
    ys = (H/2 - np.arange(H) - 0.5) / focal
    gx, gy = np.meshgrid(xs, ys)
    d = (right[None,None,:]*gx[...,None] + up[None,None,:]*gy[...,None] + fwd[None,None,:])
    d /= np.linalg.norm(d, axis=2, keepdims=True)
    yaw_o = np.arctan2(d[...,0], d[...,1])
    pitch_o = np.arcsin(np.clip(d[...,2], -1, 1))
    u = (yaw_o/(2*np.pi) + 0.5) * EW
    v = (0.5 - pitch_o/np.pi) * EH
    u0 = np.floor(u).astype(int); v0 = np.floor(v).astype(int)
    fu = (u - u0)[...,None]; fv = (v - v0)[...,None]
    u0 %= EW; u1 = (u0+1) % EW
    v0 = np.clip(v0, 0, EH-1); v1 = np.clip(v0+1, 0, EH-1)
    return (pano[v0,u0]*(1-fu)*(1-fv) + pano[v0,u1]*fu*(1-fv) +
            pano[v1,u0]*(1-fu)*fv + pano[v1,u1]*fu*fv).astype(np.float32)

W, H = 960, 540
TRUE_HFOV = 73.5
focal = W / (2*np.tan(np.radians(TRUE_HFOV)/2))

# horizon ring, with realistic aiming error and roll
views = []
for i in range(8):
    views.append({
        'yaw': float(np.radians(i*45) + rng.normal(0, np.radians(3.0))),
        'pitch': float(rng.normal(0, np.radians(3.0))),
        'roll': float(rng.normal(0, np.radians(2.5))),
    })

so = ort.SessionOptions(); so.log_severity_level = 3
sess = ort.InferenceSession(
    r'E:\sroberto27.github.io\CheckList\v2\lab\vendor\xfeat.onnx', so,
    providers=['CPUExecutionProvider'])

NET_W, NET_H = 640, 360
meta = {'width': W, 'height': H, 'netWidth': NET_W, 'netHeight': NET_H,
        'trueHFovDeg': TRUE_HFOV, 'trueFocal': float(focal), 'views': views, 'files': []}

for i, v in enumerate(views):
    img = render(v['yaw'], v['pitch'], v['roll'], W, H, focal)
    # downscale to network input exactly as the browser canvas would
    ys = (np.arange(NET_H) + 0.5) * H / NET_H - 0.5
    xs = (np.arange(NET_W) + 0.5) * W / NET_W - 0.5
    yi = np.clip(np.round(ys).astype(int), 0, H-1)
    xi = np.clip(np.round(xs).astype(int), 0, W-1)
    small = img[np.ix_(yi, xi)]
    x = np.transpose(small, (2,0,1))[None].astype(np.float32)
    desc, heat, rel = sess.run(None, {'image': x})
    gh, gw = desc.shape[2], desc.shape[3]
    fn = 'view%02d.bin' % i
    with open(os.path.join(OUT, fn), 'wb') as f:
        f.write(struct.pack('<4i', NET_W, NET_H, gw, gh))
        f.write(heat[0,0].astype(np.float32).tobytes())
        f.write(desc[0].astype(np.float32).tobytes())
    meta['files'].append(fn)
    print('view %d: heat %s desc %s -> %s' % (i, heat.shape, desc.shape, fn))

with open(os.path.join(OUT, 'meta.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('wrote fixture to', OUT)
