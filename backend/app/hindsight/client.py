"""
Hindsight SDK Client

TRACE's interface to the Hindsight persistent memory service.
"""

from typing import Dict, Any, List, Optional

from hindsight_client import Hindsight

from app.core.config import settings


class HindsightClient:
    """Client for interacting with Hindsight using the official Python SDK."""

    def __init__(self):
        self.base_url = settings.hindsight_api_url
        self.api_key = settings.hindsight_api_key
        self.namespace = settings.hindsight_namespace

        self._client = Hindsight(
            base_url=self.base_url,
            api_key=self.api_key,
        )

    async def close(self):
        """Close the Hindsight SDK client."""
        await self._client.aclose()

    async def store_memory(
        self,
        memory_id: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Store a TRACE incident in Hindsight.

        The incident ID is preserved as Hindsight's document_id so that
        the memory can be traced back to the structured SQLite record.
        """

        result = await self._client.aretain(
            bank_id=self.namespace,
            content=self._content_to_text(content),
            document_id=memory_id,
            metadata=self._stringify_metadata(metadata),
        )

        return self._response_to_dict(result)

    async def search_memories(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Recall relevant historical incidents from Hindsight.
        """

        recall_query = query

        if filters:
            filter_text = ", ".join(
                f"{key}={value}"
                for key, value in filters.items()
                if value is not None
            )

            if filter_text:
                recall_query = f"{query}. Relevant constraints: {filter_text}"

        result = await self._client.arecall(
            bank_id=self.namespace,
            query=recall_query,
            max_tokens=max(512, limit * 256),
        )

        return self._extract_results(result, limit)

    async def get_memory(
        self,
        memory_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve a specific memory.

        Hindsight recall is semantic rather than a direct document lookup,
        so this method searches for the supplied document/incident ID.
        """

        results = await self.search_memories(
            query=f"incident {memory_id}",
            filters={"incident_id": memory_id},
            limit=1,
        )

        return results[0] if results else None

    async def update_memory(
        self,
        memory_id: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Update an existing memory by retaining the updated incident content.
        """

        result = await self._client.aretain(
            bank_id=self.namespace,
            content=self._content_to_text(content),
            document_id=memory_id,
            metadata=self._stringify_metadata(metadata),
            update_mode="replace",
        )

        return self._response_to_dict(result)

    async def delete_memory(self, memory_id: str) -> bool:
        """
        Hindsight document deletion is not part of the client interface
        currently used by TRACE.

        Keep this compatibility method without issuing an unsafe request.
        """
        return False

    async def list_memories(
        self,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Hindsight is recall-oriented rather than a traditional CRUD store.

        Use a broad semantic recall query when callers request a list.
        """

        query = "historical manufacturing machine incidents"

        if filters:
            filter_text = ", ".join(
                f"{key}={value}"
                for key, value in filters.items()
                if value is not None
            )

            if filter_text:
                query += f" matching {filter_text}"

        results = await self.search_memories(
            query=query,
            limit=limit + offset,
        )

        return results[offset:offset + limit]

    @staticmethod
    def _content_to_text(content: Dict[str, Any]) -> str:
        """
        Convert structured incident data into natural language.

        Hindsight's retain operation is designed to process natural-language
        memory content.
        """

        parts = []

        for key, value in content.items():
            if value is None:
                continue

            label = key.replace("_", " ").strip().title()
            parts.append(f"{label}: {value}")

        return "\n".join(parts)

    @staticmethod
    def _stringify_metadata(
        metadata: Optional[Dict[str, Any]],
    ) -> Dict[str, str]:
        """Convert metadata values to strings as required by the SDK."""

        if not metadata:
            return {}

        return {
            str(key): str(value)
            for key, value in metadata.items()
            if value is not None
        }

    @staticmethod
    def _response_to_dict(result: Any) -> Dict[str, Any]:
        """Convert an SDK response model into a JSON-compatible dictionary."""

        if hasattr(result, "model_dump"):
            return result.model_dump()

        if hasattr(result, "dict"):
            return result.dict()

        if isinstance(result, dict):
            return result

        return {"result": str(result)}

    @staticmethod
    def _extract_results(
        result: Any,
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Extract recall results from the SDK response."""

        if hasattr(result, "results"):
            raw_results = result.results
        elif isinstance(result, dict):
            raw_results = result.get("results", [])
        else:
            raw_results = []

        extracted = []

        for item in raw_results[:limit]:
            if hasattr(item, "model_dump"):
                extracted.append(item.model_dump())
            elif hasattr(item, "dict"):
                extracted.append(item.dict())
            elif isinstance(item, dict):
                extracted.append(item)
            else:
                extracted.append({"result": str(item)})

        return extracted
