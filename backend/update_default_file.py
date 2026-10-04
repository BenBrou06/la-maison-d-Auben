"""Migration ponctuelle : remplace le fichier de Budget mensuel par le fichier
par défaut réel fourni par la marque (assets/Budget-mensuel-DEFAULT.xlsx)."""
import asyncio
import os
import uuid

from dotenv import load_dotenv

load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient
import seed_data
from storage import put_object, init_storage, APP_NAME, MIME_TYPES


async def main():
    init_storage()
    data = seed_data.load_default_xlsx()
    path = f"{APP_NAME}/files/budget-mensuel/{uuid.uuid4()}.xlsx"
    put_object(path, data, MIME_TYPES["xlsx"])
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    res = await db.products.update_one(
        {"slug": "budget-mensuel"},
        {"$set": {
            "download_storage_path": path,
            "download_filename": seed_data.DEFAULT_XLSX_FILENAME,
            "download_is_placeholder": False,
        }},
    )
    print(f"matched={res.matched_count} modified={res.modified_count} path={path} bytes={len(data)}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
