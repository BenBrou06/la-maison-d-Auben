"""Applique le contenu riche (description, fonctionnalités, FAQ…) aux fiches
« bientôt disponibles » déjà présentes en base. Ne touche ni au prix, ni au statut,
ni au fichier, ni à l'image principale (préserve les éventuelles éditions admin)."""
import asyncio
import os

from dotenv import load_dotenv

load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient
import seed_data

CONTENT_FIELDS = [
    "short_description", "description", "audience", "features", "contents",
    "compatibility", "faq", "seo", "gallery", "lookup_key", "currency", "main_image_placeholder",
]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    for p in seed_data.COMING_SOON:
        data = {k: p[k] for k in CONTENT_FIELDS if k in p}
        res = await db.products.update_one({"slug": p["slug"]}, {"$set": data})
        print(f"{p['slug']}: matched={res.matched_count} modified={res.modified_count}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
