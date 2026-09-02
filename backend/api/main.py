from fastapi import FastAPI

app = FastAPI(title="SideQuest API")

@app.get("/")
async def root():
    return {"message": "SideQuest API is running!"}