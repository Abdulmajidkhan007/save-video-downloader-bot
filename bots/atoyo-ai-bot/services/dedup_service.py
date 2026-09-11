import io
import imagehash
from PIL import Image


class Deduplicator:
    def __init__(self):
        self.seen_hashes = set()

    def is_duplicate(self, photo_bytes: bytes, threshold: int = 4) -> bool:
        """Rasmni pHash bo'yicha solishtirib dublikatlarni aniqlaydi."""
        try:
            img = Image.open(io.BytesIO(photo_bytes))
            current_hash = imagehash.phash(img)

            for h in self.seen_hashes:
                if current_hash - h <= threshold:
                    return True

            self.seen_hashes.add(current_hash)
            return False
        except Exception:
            return False
