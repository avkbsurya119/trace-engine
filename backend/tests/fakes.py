"""In-memory stand-in for HindsightClient used by the offline tests."""

import re
from typing import Any, Dict, List, Optional

WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> set:
    return set(WORD.findall(text.lower()))


class FakeHindsightClient:
    """Same interface as app.hindsight.client.HindsightClient."""

    documents: Dict[str, Dict[str, Any]] = {}
    fail_retain = False
    fail_recall = False
    bank_id = "trace-test"

    def __init__(self, bank_id: Optional[str] = None):
        if bank_id:
            self.bank_id = bank_id

    @classmethod
    def reset(cls):
        cls.documents = {}
        cls.fail_retain = False
        cls.fail_recall = False

    async def close(self):
        pass

    async def retain(self, document_id, narrative, tags, metadata, timestamp=None, replace=False):
        if self.fail_retain:
            raise ConnectionError("fake Hindsight retain failure")
        self.documents[document_id] = {"text": narrative, "tags": list(tags), "metadata": metadata}

    async def retain_batch(self, items: List[Dict[str, Any]]) -> int:
        for item in items:
            await self.retain(item["document_id"], item["narrative"], item["tags"], item["metadata"])
        return len(items)

    async def recall(self, query: str, tags: Optional[List[str]] = None, max_tokens: int = 6000):
        if self.fail_recall:
            raise ConnectionError("fake Hindsight recall failure")
        q = _tokens(query)
        results = []
        for document_id, doc in self.documents.items():
            if tags and not all(t in doc["tags"] for t in tags):
                continue
            overlap = len(q & _tokens(doc["text"])) / max(len(q), 1)
            results.append({
                "document_id": document_id,
                "text": doc["text"][:200],
                "type": "world",
                "tags": doc["tags"],
                "scores": {"semantic": round(0.6 + 0.39 * overlap, 3)},
            })
        results.sort(key=lambda r: r["scores"]["semantic"], reverse=True)
        return results[:40]

    async def delete_document(self, document_id: str) -> bool:
        return self.documents.pop(document_id, None) is not None

    async def check_bank(self):
        pass

    async def delete_bank(self):
        self.documents.clear()

    async def create_bank(self, mission: str):
        pass
