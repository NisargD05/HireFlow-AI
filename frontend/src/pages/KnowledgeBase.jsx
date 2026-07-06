import { useEffect, useState } from "react";
import api from "../api/axios";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Loader from "../components/ui/Loader";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/StatusBadge";

function KnowledgeBase() {
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchDocuments = async () => {
    try {
      const { data } = await api.get("/knowledge-base");
      setDocuments(data.documents);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (event) => {
    setMessage("");
    setError("");
    setSelectedFile(event.target.files[0] || null);
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedFile) {
      setError("Please select a PDF file");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setUploading(true);
      await api.post("/knowledge-base/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setSelectedFile(null);
      event.target.reset();
      setMessage("PDF uploaded successfully");
      fetchDocuments();
    } catch (error) {
      setError(error.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const filteredDocuments = documents.filter((document) =>
    [document.originalFileName, document.uploadedBy?.name, document.status]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const handleDelete = async (documentId) => {
    try {
      await api.delete(`/knowledge-base/${documentId}`);
      setDocuments((currentDocuments) =>
        currentDocuments.filter((document) => document._id !== documentId)
      );
      setMessage("Document deleted");
    } catch (error) {
      setError(error.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Knowledge intelligence"
        title="Knowledge Base"
        description="Upload company PDFs and convert them into indexed context for RAG-based job description generation."
      />

      <Card className="overflow-hidden">
        <form onSubmit={handleUpload} className="grid gap-5 p-5 lg:grid-cols-[1fr_20rem]">
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-8 text-center transition hover:border-blue-300 hover:bg-blue-50/40">
            <label htmlFor="pdf-upload" className="block cursor-pointer">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                PDF
              </span>
              <span className="mt-4 block text-base font-semibold text-slate-950">
                Drop a PDF into your hiring knowledge layer
              </span>
              <span className="mt-2 block text-sm leading-6 text-slate-500">
                Use role rubrics, company culture docs, hiring bars, interview notes, and historical role patterns.
              </span>
            </label>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="field-control mx-auto mt-5 max-w-lg"
            />
            {selectedFile && (
              <p className="mt-3 text-sm font-medium text-slate-700">{selectedFile.name}</p>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">Indexing pipeline</p>
              <div className="mt-4 space-y-3 text-sm text-slate-500">
                {["Extract PDF text", "Chunk knowledge", "Generate embeddings", "Store in ChromaDB"].map((step) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {step}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {message && <p className="alert-success">{message}</p>}
              {error && <p className="alert-error">{error}</p>}
              <Button type="submit" variant="ai" disabled={uploading} className="w-full">
                {uploading ? "Indexing PDF..." : "Upload and index"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Uploaded documents</h2>
            <p className="mt-1 text-sm text-slate-500">{documents.length} files connected to hiring intelligence.</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            className="field-control mt-0 md:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="p-5"><Loader label="Loading documents..." /></div>
        ) : documents.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No knowledge documents uploaded" description="Upload company hiring PDFs so job generation and interview context can use your internal standards." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Uploaded By</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((document) => (
                  <tr key={document._id}>
                    <td className="font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-xs font-bold text-red-600">
                          PDF
                        </span>
                        <span>{document.originalFileName}</span>
                      </div>
                    </td>
                    <td>
                      {document.uploadedBy?.name || "Unknown"}
                    </td>
                    <td>
                      <StatusBadge status={document.status} />
                    </td>
                    <td>
                      {new Date(document.uploadedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Button
                        type="button"
                        onClick={() => handleDelete(document._id)}
                        variant="danger"
                        className="px-3 py-1.5 text-xs"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default KnowledgeBase;
