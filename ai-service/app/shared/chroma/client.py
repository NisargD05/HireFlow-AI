from app.shared.config.settings import settings
from app.shared.embeddings.service import get_embeddings
from app.shared.utils.file_utils import ensure_directory

_chroma_client = None
_vector_store_cache: dict[str, object] = {}


def get_chroma_client():
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    try:
        import chromadb
    except ImportError as error:
        raise RuntimeError(
            "ChromaDB is not installed. Install Microsoft C++ Build Tools on Windows, "
            "or run Chroma in Docker/Linux, then reinstall chromadb."
        ) from error

    if settings.chroma_http_host:
        host = settings.chroma_http_host
        port = settings.chroma_http_port
        try:
            _chroma_client = chromadb.HttpClient(host=host, port=port)
            return _chroma_client
        except Exception:
            try:
                base = f"http://{host}:{port}"
                _chroma_client = chromadb.HttpClient(url=base)
                return _chroma_client
            except Exception as err:
                raise

    ensure_directory(settings.chroma_persist_directory)
    _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_directory)
    return _chroma_client


def get_chroma_collection():
    client = get_chroma_client()
    collection = client.get_or_create_collection(name=settings.chroma_collection_name)
    return collection


def get_vector_store(collection_name: str | None = None):
    try:
        from langchain_chroma import Chroma
    except ImportError as error:
        raise RuntimeError("langchain-chroma is not installed. Rebuild the ai-service image.") from error

    active_collection = collection_name or settings.chroma_collection_name
    if active_collection not in _vector_store_cache:
        client = get_chroma_client()
        _vector_store_cache[active_collection] = Chroma(
            client=client,
            collection_name=active_collection,
            embedding_function=get_embeddings(),
        )
    return _vector_store_cache[active_collection]


def get_retriever(collection_name: str | None = None, k: int = 5):
    return get_vector_store(collection_name).as_retriever(search_kwargs={"k": k})
