from fastapi import FastAPI
from routers import auth

app = FastAPI(title="SideQuest API")

app.include_router(auth.router)

@app.get("/")
async def root():
    return {"message": "SideQuest API is running!"}