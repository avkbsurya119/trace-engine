from typing import Any, Dict, List, Optional

from hindsight_client import Hindsight

from app.core.config import settings


class HindsightClient:
    """
    Wrapper around the Hindsight Cloud SDK.

    Hindsight is used as the semantic memory layer for TRACE.
    SQLite remains the exact structured source of truth for incidents.
    """

    def __init__(self):
        self.base_url = settings.hindsight_api_url
        self.api_key = settings.hindsight_api_key
        self.namespace = settings.hindsight_namespace

        self._client = Hindsight(
            base_url=self.base_url,
            api_key=self.api_key,
        )

    async def store_memory(
        self,
        memory_id: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Store an incident in Hindsight.

        memory_id is used as:
        - document_id
        - incident_id metadata

        This gives us a reliable bridge from semantic memory
        back to the exact SQLite incident.
        """

        try:
            metadata = dict(metadata or {})

            # Always keep the exact incident ID available.
            metadata["incident_id"] = memory_id

            await self._client.aretain(
                bank_id=self.namespace,
                content=self._content_to_text(content),
                document_id=memory_id,
                metadata=self._stringify_metadata(metadata),
                tags=self._build_tags(content, memory_id),
            )

            return True

        except Exception as e:
            print(f"Hindsight retain error: {e}")
            return False

    async def search_memories(
        self,
        query: str,
        limit: int = 10,
        tags: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search Hindsight semantic memory.
        """

        try:
            response = await self._client.arecall(
                bank_id=self.namespace,
                query=query,
                max_tokens=4096,
                budget="mid",
                tags=tags,
                tags_match="any",
            )

            results = self._extract_results(response)

            # Keep the requested number of results.
            return results[:limit]

        except Exception as e:
            print(f"Hindsight recall error: {e}")
            return []

    async def get_memory(
        self,
        memory_id: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve a memory by searching for its incident ID.

        NOTE:
        SQLite is the authoritative exact lookup.
        This method exists for compatibility with the existing
        MemoryService and older code.
        """

        try:
            response = await self._client.arecall(
                bank_id=self.namespace,
                query=memory_id,
                max_tokens=4096,
                budget="mid",
            )

            results = self._extract_results(response)

            # First look for an exact document_id.
            for result in results:
                if result.get("document_id") == memory_id:
                    return result

            # Then look for incident_id in metadata.
            for result in results:
                metadata = result.get("metadata") or {}

                if metadata.get("incident_id") == memory_id:
                    return result

            # Finally look for incident_id in tags.
            target_tag = f"incident_id:{memory_id}"

            for result in results:
                tags = result.get("tags") or []

                if target_tag in tags:
                    return result

            return None

        except Exception as e:
            print(f"Hindsight get error: {e}")
            return None

    async def update_memory(
        self,
        memory_id: str,
        content: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Update an existing Hindsight memory.

        Hindsight does not expose a separate update-memory method
        in the installed SDK, so we use retain with update_mode='replace'.
        """

        try:
            metadata = dict(metadata or {})
            metadata["incident_id"] = memory_id

            await self._client.aretain(
                bank_id=self.namespace,
                content=self._content_to_text(content),
                document_id=memory_id,
                metadata=self._stringify_metadata(metadata),
                tags=self._build_tags(content, memory_id),
                update_mode="replace",
            )

            return True

        except Exception as e:
            print(f"Hindsight update error: {e}")
            return False

    async def delete_memory(
        self,
        memory_id: str,
    ) -> bool:
        """
        Hindsight memory deletion is not currently used by TRACE.

        SQLite remains the structured source of truth.
        """

        print(
            f"Hindsight delete requested for {memory_id}, "
            "but deletion is not implemented."
        )

        return False

    async def list_memories(
        self,
        query: str = "manufacturing incidents troubleshooting defects",
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve a broad set of memories.

        Hindsight does not expose a simple unrestricted list operation
        through the SDK, so TRACE uses semantic recall for this method.
        """

        try:
            response = await self._client.arecall(
                bank_id=self.namespace,
                query=query,
                max_tokens=8192,
                budget="mid",
            )

            results = self._extract_results(response)

            return results[:limit]

        except Exception as e:
            print(f"Hindsight list error: {e}")
            return []

    async def close(self):
        """
        Close the underlying Hindsight client.
        """

        try:
            await self._client.aclose()
        except Exception as e:
            print(f"Hindsight close error: {e}")

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------

    @staticmethod
    def _content_to_text(content: Dict[str, Any]) -> str:
        """
        Convert structured incident data into natural language.

        This is what Hindsight semantically indexes.
        """

        parts = []

        if content.get("type"):
            parts.append(f"Incident type: {content['type']}")

        if content.get("incident_id"):
            parts.append(f"Incident ID: {content['incident_id']}")

        if content.get("machine_id"):
            parts.append(f"Machine: {content['machine_id']}")

        if content.get("machine_type"):
            parts.append(f"Machine type: {content['machine_type']}")

        if content.get("production_line"):
            parts.append(
                f"Production line: {content['production_line']}"
            )

        if content.get("timestamp"):
            parts.append(f"Timestamp: {content['timestamp']}")

        if content.get("defect_type"):
            parts.append(
                f"Defect type: {content['defect_type']}"
            )

        if content.get("symptoms"):
            symptoms = content["symptoms"]

            if isinstance(symptoms, list):
                symptoms_text = ", ".join(str(x) for x in symptoms)
            else:
                symptoms_text = str(symptoms)

            parts.append(f"Symptoms: {symptoms_text}")

        if content.get("sensor_values"):
            parts.append(
                f"Sensor values: {content['sensor_values']}"
            )

        if content.get("operating_conditions"):
            parts.append(
                f"Operating conditions: "
                f"{content['operating_conditions']}"
            )

        if content.get("description"):
            parts.append(
                f"Description: {content['description']}"
            )

        if content.get("suspected_root_cause"):
            parts.append(
                f"Suspected root cause: "
                f"{content['suspected_root_cause']}"
            )

        if content.get("confirmed_root_cause"):
            parts.append(
                f"Confirmed root cause: "
                f"{content['confirmed_root_cause']}"
            )

        if content.get("action_taken"):
            parts.append(
                f"Action taken: {content['action_taken']}"
            )

        if content.get("action_outcome"):
            parts.append(
                f"Action outcome: {content['action_outcome']}"
            )

        if content.get("resolution_details"):
            parts.append(
                f"Resolution details: "
                f"{content['resolution_details']}"
            )

        if content.get("resolution_time_minutes") is not None:
            parts.append(
                f"Resolution time: "
                f"{content['resolution_time_minutes']} minutes"
            )

        if content.get("technician_notes"):
            parts.append(
                f"Technician notes: "
                f"{content['technician_notes']}"
            )

        if content.get("searchable_text"):
            parts.append(
                f"Searchable context: "
                f"{content['searchable_text']}"
            )

        return "\n".join(parts)

    @staticmethod
    def _stringify_metadata(
        metadata: Dict[str, Any],
    ) -> Dict[str, str]:
        """
        Hindsight metadata is represented as string key/value pairs.
        """

        return {
            str(key): str(value)
            for key, value in metadata.items()
            if value is not None
        }

    @staticmethod
    def _build_tags(
        content: Dict[str, Any],
        memory_id: str,
    ) -> List[str]:
        """
        Create explicit searchable tags for TRACE incidents.
        """

        tags = [
            f"incident_id:{memory_id}",
        ]

        if content.get("machine_id"):
            tags.append(
                f"machine_id:{content['machine_id']}"
            )

        if content.get("machine_type"):
            tags.append(
                f"machine_type:{content['machine_type']}"
            )

        if content.get("production_line"):
            tags.append(
                f"production_line:{content['production_line']}"
            )

        if content.get("defect_type"):
            tags.append(
                f"defect_type:{content['defect_type']}"
            )

        if content.get("action_outcome"):
            tags.append(
                f"action_outcome:{content['action_outcome']}"
            )

            tags.append("has_outcome:true")

        else:
            tags.append("has_outcome:false")

        return tags

    @staticmethod
    def _response_to_dict(response: Any) -> Dict[str, Any]:
        """
        Convert a Hindsight SDK model into a normal dictionary.
        """

        if response is None:
            return {}

        if isinstance(response, dict):
            return response

        # Pydantic v2
        if hasattr(response, "model_dump"):
            try:
                return response.model_dump()
            except Exception:
                pass

        # Pydantic v1 compatibility
        if hasattr(response, "dict"):
            try:
                return response.dict()
            except Exception:
                pass

        # Generic object fallback
        if hasattr(response, "__dict__"):
            return dict(response.__dict__)

        return {}

    @classmethod
    def _extract_results(
        cls,
        response: Any,
    ) -> List[Dict[str, Any]]:
        """
        Extract RecallResult objects from a RecallResponse.
        """

        if response is None:
            return []

        # Normal Hindsight RecallResponse path.
        if hasattr(response, "results"):
            raw_results = response.results
        elif isinstance(response, dict):
            raw_results = response.get("results", [])
        elif isinstance(response, list):
            raw_results = response
        else:
            raw_results = []

        results = []

        for result in raw_results:
            result_dict = cls._response_to_dict(result)

            if result_dict:
                results.append(result_dict)

        return results
