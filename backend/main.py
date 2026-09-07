from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth

app = FastAPI(title="SideQuest API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.get("/")
async def root():
    return {"message": "SideQuest API is running!"}