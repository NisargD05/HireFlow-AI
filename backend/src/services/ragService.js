const KnowledgeBaseChunk = require("../models/KnowledgeBaseChunk");

const ROLE_SCOPES = {
  machine_learning: [
    "machine learning",
    "ml",
    "ai",
    "artificial intelligence",
    "deep learning",
    "model",
    "nlp",
    "computer vision"
  ],
  frontend: ["frontend", "front end", "front-end", "react", "ui", "ux", "web"],
  backend: ["backend", "back end", "back-end", "node", "api", "server", "database"],
  data_science: ["data science", "data scientist", "analytics", "statistical", "data analysis"],
  qa: ["qa", "quality assurance", "quality analyst", "test automation", "testing", "sdet"]
};

const tokenize = (value) => {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
};

const normalize = (value) => String(value || "").toLowerCase();

const inferScope = (value) => {
  const text = normalize(value);
  const compact = text.replace(/[^a-z0-9]+/g, " ");

  for (const [scope, aliases] of Object.entries(ROLE_SCOPES)) {
    if (aliases.some((alias) => {
      if (alias.length <= 3) {
        return new RegExp(`\\b${alias}\\b`).test(compact);
      }
      return compact.includes(alias);
    })) {
      return scope;
    }
  }

  if (/\bml\b/.test(compact)) {
    return "machine_learning";
  }

  return "";
};

const inferJobScope = (jobDetails) => {
  return inferScope([
    jobDetails.roleName,
    jobDetails.department,
    jobDetails.skills,
    jobDetails.mandatoryRequirements
  ].filter(Boolean).join(" "));
};

const inferSourceScope = (chunk) => {
  return inferScope([
    chunk.sourceFileName,
    chunk.document?.originalFileName,
    chunk.text?.slice(0, 500)
  ].filter(Boolean).join(" "));
};

const buildSearchQuery = (jobDetails) => {
  return [
    jobDetails.roleName,
    jobDetails.department,
    jobDetails.skills,
    jobDetails.seniorityLevel,
    jobDetails.mandatoryRequirements
  ]
    .filter(Boolean)
    .join(" ");
};

const scoreChunk = (chunkText, queryTokens) => {
  const lowerChunk = chunkText.toLowerCase();

  return queryTokens.reduce((score, token) => {
    return lowerChunk.includes(token) ? score + 1 : score;
  }, 0);
};

const retrieveRelevantKnowledge = async (jobDetails, limit = 6) => {
  const searchQuery = buildSearchQuery(jobDetails);
  const queryTokens = tokenize(searchQuery);
  const jobScope = inferJobScope(jobDetails);

  if (queryTokens.length === 0) {
    return [];
  }

  const chunks = await KnowledgeBaseChunk.find({
    $text: { $search: searchQuery }
  })
    .populate("document", "originalFileName")
    .limit(30);

  const scoredChunks = chunks
    .map((chunk) => ({
      document: chunk.document?._id,
      sourceFileName: chunk.sourceFileName,
      chunkText: chunk.text,
      scope: inferSourceScope(chunk),
      score: scoreChunk(chunk.text, queryTokens)
    }))
    .filter((chunk) => chunk.score > 0);

  const scopedChunks = jobScope
    ? scoredChunks.filter((chunk) => chunk.scope === jobScope)
    : scoredChunks;

  return (scopedChunks.length ? scopedChunks : scoredChunks)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

module.exports = {
  inferJobScope,
  inferSourceScope,
  retrieveRelevantKnowledge
};
