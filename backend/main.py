import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import admin, auth, countries, quests

app = FastAPI(title="SideQuest API")

allowed_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(countries.router)
app.include_router(quests.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    return {"message": "SideQuest API is running!"}
