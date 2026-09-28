"""
Hindsight SDK Client

TRACE's thin interface to the Hindsight persistent memory service.
Every TRACE incident is one Hindsight document whose document_id is the
SQLite incident_id, so recalled memories can always be traced back to the
exact structured record.
"""

import inspect
from datetime import datetime
from typing import Any, Dict, List, Optional

from hindsight_client import Hindsight

from app.core.config import settings


class HindsightClient:
    """Client for interacting with Hindsight using the official Python SDK."""

    def __init__(self, bank_id: Optional[str] = None):
        self.bank_id = bank_id or settings.hindsight_namespace
        self._client = Hindsight(
            base_url=settings.hindsight_api_url,
            api_key=settings.hindsight_api_key,
        )

    async def close(self):
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Retain
    # ------------------------------------------------------------------

    async def retain(
        self,
        document_id: str,
        narrative: str,
        tags: List[str],
        metadata: Dict[str, Any],
        timestamp: Optional[datetime] = None,
        replace: bool = False,
    ) -> None:
        """Retain (or re-retain) one incident narrative."""

        await self._client.aretain(
            bank_id=self.bank_id,
            content=narrative,
            document_id=document_id,
            tags=tags,
            metadata=self._stringify(metadata),
            timestamp=timestamp,
            update_mode="replace" if replace else None,
        )

    async def retain_batch(self, items: List[Dict[str, Any]]) -> int:
        """
        Retain many incident narratives in one call.

        Each item: {document_id, narrative, tags, metadata, timestamp}.
        """

        payload = [
            {
                "content": item["narrative"],
                "document_id": item["document_id"],
                "tags": item["tags"],
                "metadata": self._stringify(item["metadata"]),
                "timestamp": item["timestamp"].isoformat() if item.get("timestamp") else None,
            }
            for item in items
        ]
        result = await self._client.aretain_batch(bank_id=self.bank_id, items=payload)
        return getattr(result, "items_count", len(items))

    # ------------------------------------------------------------------
    # Recall
    # ------------------------------------------------------------------

    async def recall(
        self,
        query: str,
        tags: Optional[List[str]] = None,
        max_tokens: int = 6000,
    ) -> List[Dict[str, Any]]:
        """
        Semantic recall restricted to facts that belong to a document
        (world/experience facts carry document_id; consolidated
        observations do not, so they cannot be cross-referenced).
        """

        result = await self._client.arecall(
            bank_id=self.bank_id,
            query=query,
            types=["world", "experience"],
            tags=tags,
            tags_match="all_strict" if tags else "any",
            max_tokens=max_tokens,
        )
        return [item.model_dump() for item in (result.results or [])]

    # ------------------------------------------------------------------
    # Bank / document management (seeding and demo reset)
    # ------------------------------------------------------------------

    async def delete_document(self, document_id: str) -> bool:
        try:
            response = self._client._documents_api.delete_document(
                bank_id=self.bank_id,
                document_id=document_id,
            )
            if inspect.isawaitable(response):
                await response
            return True
        except Exception:
            return False

    async def delete_bank(self) -> None:
        try:
            await self._client.adelete_bank(bank_id=self.bank_id)
        except Exception:
            # Bank did not exist yet.
            pass

    async def create_bank(self, mission: str) -> None:
        await self._client.acreate_bank(
            bank_id=self.bank_id,
            name="TRACE maintenance memory",
            mission=mission,
        )

    @staticmethod
    def _stringify(metadata: Dict[str, Any]) -> Dict[str, str]:
        return {
            str(key): str(value)
            for key, value in (metadata or {}).items()
            if value is not None
        }
