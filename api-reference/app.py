import io
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
from PIL import Image
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, File, UploadFile
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from huggingface_hub import hf_hub_download
# pyrefly: ignore [missing-import]
from ram.models import ram_plus
# pyrefly: ignore [missing-import]
from ram import inference_ram, get_transform

app = FastAPI()

# Allow your website to call this endpoint from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten this to your domain later
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda" if torch.cuda.is_available() else "cpu"
IMAGE_SIZE = 384
transform = get_transform(image_size=IMAGE_SIZE)

# Download checkpoint once at startup
ckpt_path = hf_hub_download(
    repo_id="xinyu1205/recognize-anything-plus-model",
    filename="ram_plus_swin_large_14m.pth",
)
model = ram_plus(pretrained=ckpt_path, image_size=IMAGE_SIZE, vit="swin_l")
model.eval().to(device)

@app.post("/tag")
async def tag(file: UploadFile = File(...)):
    raw = await file.read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(device)
    with torch.no_grad():
        en_tags, zh_tags = inference_ram(tensor, model)
    return {
        "tags_en": [t.strip() for t in en_tags.split("|")],
        "tags_zh": [t.strip() for t in zh_tags.split("|")],
    }

@app.get("/")
def health():
    return {"status": "ok"}